import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { Queue, QueueStatus } from '../entities/queue.entity';
import { QueueEntry, QueueEntryStatus } from '../entities/queue-entry.entity';
import { CreateQueueDto, JoinQueueDto, PrioritizeUserDto } from './dto/queue.dto';
import { User } from '../entities/user.entity';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueueService {
    constructor(
        @InjectRepository(Queue)
        private queueRepository: Repository<Queue>,
        @InjectRepository(QueueEntry)
        private queueEntryRepository: Repository<QueueEntry>,
        private dataSource: DataSource,
        private configService: ConfigService,
    ) { }

    // --- Queue Creation & Management ---

    async createQueue(user: User, createQueueDto: CreateQueueDto): Promise<Queue> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const queuesCreatedToday = await this.queueRepository.count({
            where: {
                ownerId: user.id,
                createdAt: MoreThan(today),
            },
        });

        if (queuesCreatedToday >= 3) {
            throw new BadRequestException('You can only create 3 queues per day.');
        }

        const queue = this.queueRepository.create({
            ...createQueueDto,
            owner: user,
        });

        return this.queueRepository.save(queue);
    }

    async getMyQueues(user: User): Promise<Queue[]> {
        return this.queueRepository.find({ where: { ownerId: user.id } });
    }

    async getQueueById(id: number): Promise<Queue> {
        const queue = await this.queueRepository.findOne({
            where: { id },
            relations: ['owner'],
        });
        if (!queue) {
            throw new NotFoundException('Queue not found');
        }
        return queue;
    }

    // --- Joining Logic ---

    async joinQueue(user: User, joinQueueDto: JoinQueueDto): Promise<{ entry: QueueEntry; qrCode: string; estimatedWaitTime: number }> {
        const { queueId, customData } = joinQueueDto;

        return this.dataSource.transaction(async (manager) => {
            // 1. Checks
            const queue = await manager.findOne(Queue, { where: { id: queueId } });
            if (!queue) throw new NotFoundException('Queue not found');
            if (queue.status !== QueueStatus.ACTIVE) throw new BadRequestException('Queue is not active');

            // Global Limit: Max 2 active queues
            const activeEntriesCount = await manager.count(QueueEntry, {
                where: {
                    userId: user.id,
                    status: QueueEntryStatus.WAITING,
                },
            });
            if (activeEntriesCount >= 2) throw new BadRequestException('You can only join 2 queues at a time.');

            // Duplicate Check
            const existingEntry = await manager.findOne(QueueEntry, {
                where: {
                    queueId,
                    userId: user.id,
                    status: QueueEntryStatus.WAITING, // Only check active status
                },
            });
            if (existingEntry) throw new ConflictException('You are already in this queue.');

            // Queue Capacity Check
            const currentParticipants = await manager.count(QueueEntry, {
                where: { queueId, status: QueueEntryStatus.WAITING },
            });
            if (currentParticipants >= (queue.maxParticipants || 50)) {
                throw new BadRequestException('Queue is full.');
            }

            // 2. Validate Custom Fields (Basic Validation)
            // In a real app, strict schema validation would happen here based on queue.customFields
            if (queue.customFields && queue.customFields.length > 0) {
                // Simple check: make sure provided keys exist in requirement
                // skipping deep validation for brevity, but this is where it goes.
            }

            // 3. Assign Position
            // Get the max position currently in WAITING or SERVING to append
            const lastEntry = await manager.findOne(QueueEntry, {
                where: { queueId },
                order: { position: 'DESC' },
            });
            const newPosition = lastEntry ? lastEntry.position + 1 : 1;

            // 4. Generate QR Code Token
            // Secure token signed or hashed. simple HMAC for now.
            const qrPayload = `${user.id}:${queueId}:${Date.now()}`;
            const signature = crypto
                .createHmac('sha256', this.configService.get<string>('JWT_SECRET') || 'secret')
                .update(qrPayload)
                .digest('hex');
            const qrCodeToken = `${qrPayload}.${signature}`;

            // 5. Create Entry
            const entry = manager.create(QueueEntry, {
                queue,
                user,
                position: newPosition,
                customData,
                qrCodeToken,
                status: QueueEntryStatus.WAITING,
                joinedAt: new Date(),
            });

            const savedEntry = await manager.save(QueueEntry, entry);

            // 6. Calculate Estimate
            // (Position in line) * Avg Service Time
            // Position in line = currentParticipants + 1 (basically) works if strictly sequential
            // Better: Count how many are ahead of me
            const peopleAhead = currentParticipants; // Since we are appending, everyone currently waiting is ahead
            const estimatedWaitTime = peopleAhead * queue.avgServiceTime;

            return { entry: savedEntry, qrCode: qrCodeToken, estimatedWaitTime };
        });
    }

    // --- Queue Status & Verification ---

    async getQueueStatus(user: User, queueId: number) {
        // Return user's position, estimated time, real-time updates
        const queue = await this.queueRepository.findOne({ where: { id: queueId } });
        if (!queue) throw new NotFoundException('Queue not found');

        const entry = await this.queueEntryRepository.findOne({
            where: { queueId, userId: user.id, status: QueueEntryStatus.WAITING },
        });

        if (!entry) return { status: 'not_joined', queue };

        const split = await this.queueEntryRepository.count({
            where: {
                queueId,
                status: QueueEntryStatus.WAITING,
                position: MoreThan(0) // hack to allow proper query syntax construction if needed, but really we want "position < entry.position"
            }
        });
        // TypeORM doesn't support "Less Than Column" easily in find options without QueryBuilder for dynamic comparison
        // So we do:
        const peopleAhead = await this.queueEntryRepository
            .createQueryBuilder('entry')
            .where('entry.queueId = :queueId', { queueId })
            .andWhere('entry.status = :status', { status: QueueEntryStatus.WAITING })
            .andWhere('entry.position < :position', { position: entry.position })
            .getCount();

        return {
            status: 'joined',
            position: entry.position,
            peopleAhead,
            estimatedWaitTime: peopleAhead * queue.avgServiceTime,
            entry
        };
    }

    async verifyQrCode(token: string, ownerId: number) {
        // 1. Verify Signature
        const [userIdStr, queueIdStr, timestamp, signature] = token.split(/[:.]/);
        // Reconstruct payload to verify
        const payload = `${userIdStr}:${queueIdStr}:${timestamp}`;
        const expectedSignature = crypto
            .createHmac('sha256', this.configService.get<string>('JWT_SECRET') || 'secret')
            .update(payload)
            .digest('hex');

        if (signature !== expectedSignature) {
            throw new ForbiddenException('Invalid QR Code');
        }

        const queueId = parseInt(queueIdStr);

        // 2. Check Queue Ownership
        const queue = await this.queueRepository.findOne({ where: { id: queueId } });
        if (!queue) throw new NotFoundException('Queue not found');
        if (queue.ownerId !== ownerId) {
            throw new ForbiddenException('You do not own this queue');
        }

        // 3. Retrieve Entry
        const entry = await this.queueEntryRepository.findOne({
            where: { qrCodeToken: token },
            relations: ['user'],
        });

        if (!entry) throw new NotFoundException('Entry not found or invalid token');

        return entry;
    }

    // --- Owner Management ---

    async prioritizeUser(ownerId: number, queueId: number, dto: PrioritizeUserDto) {
        // Move user to specific position, shift others down
        return this.dataSource.transaction(async (manager) => {
            const queue = await manager.findOne(Queue, { where: { id: queueId } });
            if (!queue || queue.ownerId !== ownerId) throw new ForbiddenException('Not owner');

            const targetEntry = await manager.findOne(QueueEntry, {
                where: { userId: dto.userId, queueId, status: QueueEntryStatus.WAITING }
            });
            if (!targetEntry) throw new NotFoundException('User not in queue');

            const oldPosition = targetEntry.position;
            const newPosition = dto.newPosition;

            if (oldPosition === newPosition) return targetEntry;

            // Logic:
            // If moving UP (e.g. 5 -> 2): Shift entities 2..4 to 3..5 (+1)
            // If moving DOWN (e.g. 2 -> 5): Shift entities 3..5 to 2..4 (-1)

            if (newPosition < oldPosition) {
                // Moving UP
                await manager
                    .createQueryBuilder()
                    .update(QueueEntry)
                    .set({ position: () => "position + 1" })
                    .where("queueId = :queueId", { queueId })
                    .andWhere("status = :status", { status: QueueEntryStatus.WAITING })
                    .andWhere("position >= :newPos", { newPos: newPosition })
                    .andWhere("position < :oldPos", { oldPos: oldPosition })
                    .execute();
            } else {
                // Moving DOWN
                await manager
                    .createQueryBuilder()
                    .update(QueueEntry)
                    .set({ position: () => "position - 1" })
                    .where("queueId = :queueId", { queueId })
                    .andWhere("status = :status", { status: QueueEntryStatus.WAITING })
                    .andWhere("position > :oldPos", { oldPos: oldPosition })
                    .andWhere("position <= :newPos", { newPos: newPosition })
                    .execute();
            }

            targetEntry.position = newPosition;
            return await manager.save(targetEntry);
        });
    }
}
