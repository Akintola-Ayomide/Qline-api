/**
 * @file queue.service.ts
 * @description Service handling all queue-related business logic including
 * queue creation, joining, status retrieval, QR code verification,
 * and participant prioritization.
 */

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

/** Maximum number of queues a user can create per day. */
const MAX_QUEUES_PER_DAY = 3;

/** Maximum number of active queue entries a user can have simultaneously. */
const MAX_ACTIVE_ENTRIES_PER_USER = 2;

/**
 * Shape of the response returned when a user joins a queue.
 */
export interface JoinQueueResponse {
    /** The created queue entry record. */
    entry: QueueEntry;
    /** The unique QR code token string for verification. */
    qrCode: string;
    /** Estimated wait time in minutes based on position and average service time. */
    estimatedWaitTime: number;
}

/**
 * Shape of the response returned for a user's queue status.
 */
export interface QueueStatusResponse {
    /** Whether the user has joined ('joined') or not ('not_joined'). */
    status: 'joined' | 'not_joined';
    /** The queue entity (always included). */
    queue?: Queue;
    /** The user's current position (only if joined). */
    position?: number;
    /** Number of people ahead in the queue (only if joined). */
    peopleAhead?: number;
    /** Estimated wait time in minutes (only if joined). */
    estimatedWaitTime?: number;
    /** The user's queue entry (only if joined). */
    entry?: QueueEntry;
}

/**
 * Queue service.
 *
 * Manages the full lifecycle of queues and queue entries:
 * - **Queue CRUD** — create, list, and retrieve queues.
 * - **Join logic** — capacity checks, duplicate prevention, position assignment, QR code generation.
 * - **Status** — real-time position and wait-time estimation.
 * - **Verification** — HMAC-based QR code token validation.
 * - **Owner management** — re-prioritize (reorder) participants.
 */
@Injectable()
export class QueueService {
    constructor(
        @InjectRepository(Queue)
        private readonly queueRepository: Repository<Queue>,
        @InjectRepository(QueueEntry)
        private readonly queueEntryRepository: Repository<QueueEntry>,
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
    ) { }

    // ──────────────────────────────────────────────
    // Queue Creation & Retrieval
    // ──────────────────────────────────────────────

    /**
     * Creates a new queue owned by the authenticated user.
     *
     * Enforces a daily creation limit of {@link MAX_QUEUES_PER_DAY} queues per user
     * to prevent abuse.
     *
     * @param user           - The authenticated user creating the queue.
     * @param createQueueDto - The queue details (name, description, capacity, etc.).
     * @returns The newly created {@link Queue} entity.
     * @throws BadRequestException if the user has already created the maximum number of queues today.
     */
    async createQueue(
        user: User,
        createQueueDto: CreateQueueDto,
    ): Promise<Queue> {
        // Calculate the start of today (midnight) to count queues created today.
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const queuesCreatedToday = await this.queueRepository.count({
            where: {
                ownerId: user.id,
                createdAt: MoreThan(today),
            },
        });

        if (queuesCreatedToday >= MAX_QUEUES_PER_DAY) {
            throw new BadRequestException(
                `You can only create ${MAX_QUEUES_PER_DAY} queues per day.`,
            );
        }

        // Create the queue entity with the provided data and assign ownership.
        const queue = this.queueRepository.create({
            ...createQueueDto,
            owner: user,
        });

        return this.queueRepository.save(queue);
    }

    /**
     * Retrieves all queues owned by the authenticated user.
     *
     * @param user - The authenticated user.
     * @returns An array of {@link Queue} entities owned by the user.
     */
    async getMyQueues(user: User): Promise<Queue[]> {
        return this.queueRepository.find({ where: { ownerId: user.id } });
    }

    /**
     * Retrieves a single queue by its ID, including the owner relationship.
     *
     * @param id - The queue's database ID.
     * @returns The {@link Queue} entity with the `owner` relation loaded.
     * @throws NotFoundException if no queue exists with the given ID.
     */
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

    // ──────────────────────────────────────────────
    // Joining Logic
    // ──────────────────────────────────────────────

    /**
     * Allows a user to join an active queue.
     *
     * This operation runs inside a database transaction to ensure consistency.
     *
     * Steps:
     * 1. Validates the queue exists and is active.
     * 2. Checks the user hasn't exceeded the global active-entry limit.
     * 3. Checks the user isn't already in this specific queue.
     * 4. Checks the queue hasn't reached its capacity.
     * 5. Assigns the next sequential position.
     * 6. Generates an HMAC-signed QR code token for verification.
     * 7. Calculates the estimated wait time.
     *
     * @param user         - The authenticated user joining the queue.
     * @param joinQueueDto - Contains the `queueId` and optional `customData`.
     * @returns The created entry, QR code token, and estimated wait time.
     * @throws NotFoundException   if the queue does not exist.
     * @throws BadRequestException if the queue is not active, full, or the user has too many active entries.
     * @throws ConflictException   if the user is already waiting in this queue.
     */
    async joinQueue(
        user: User,
        joinQueueDto: JoinQueueDto,
    ): Promise<JoinQueueResponse> {
        const { queueId, customData } = joinQueueDto;

        return this.dataSource.transaction(async (manager) => {
            // Step 1: Validate the queue exists and is currently active.
            const queue = await manager.findOne(Queue, { where: { id: queueId } });

            if (!queue) {
                throw new NotFoundException('Queue not found');
            }
            if (queue.status !== QueueStatus.ACTIVE) {
                throw new BadRequestException('Queue is not active');
            }

            // Step 2: Check global limit — a user can be in at most 2 queues at once.
            const activeEntriesCount = await manager.count(QueueEntry, {
                where: {
                    userId: user.id,
                    status: QueueEntryStatus.WAITING,
                },
            });

            if (activeEntriesCount >= MAX_ACTIVE_ENTRIES_PER_USER) {
                throw new BadRequestException(
                    `You can only join ${MAX_ACTIVE_ENTRIES_PER_USER} queues at a time.`,
                );
            }

            // Step 3: Check for duplicate — prevent joining the same queue twice.
            const existingEntry = await manager.findOne(QueueEntry, {
                where: {
                    queueId,
                    userId: user.id,
                    status: QueueEntryStatus.WAITING,
                },
            });

            if (existingEntry) {
                throw new ConflictException('You are already in this queue.');
            }

            // Step 4: Check queue capacity.
            const currentParticipants = await manager.count(QueueEntry, {
                where: { queueId, status: QueueEntryStatus.WAITING },
            });

            if (currentParticipants >= (queue.maxParticipants || 50)) {
                throw new BadRequestException('Queue is full.');
            }

            // Step 5: Assign the next position (append to end of queue).
            const lastEntry = await manager.findOne(QueueEntry, {
                where: { queueId },
                order: { position: 'DESC' },
            });
            const newPosition = lastEntry ? lastEntry.position + 1 : 1;

            // Step 6: Generate a unique, HMAC-signed QR code token.
            const qrCodeToken = this.generateQrCodeToken(user.id, queueId);

            // Step 7: Create and save the queue entry.
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

            // Step 8: Calculate estimated wait time.
            // Everyone currently waiting is ahead of the new joiner.
            const estimatedWaitTime = currentParticipants * queue.avgServiceTime;

            return {
                entry: savedEntry,
                qrCode: qrCodeToken,
                estimatedWaitTime,
            };
        });
    }

    // ──────────────────────────────────────────────
    // Queue Status & Verification
    // ──────────────────────────────────────────────

    /**
     * Retrieves the authenticated user's status within a specific queue.
     *
     * Returns:
     * - `{ status: 'not_joined' }` if the user is not in the queue.
     * - Position, people ahead, estimated wait time, and entry if they are.
     *
     * @param user    - The authenticated user.
     * @param queueId - The ID of the queue to check.
     * @returns A {@link QueueStatusResponse} with position and wait-time info.
     * @throws NotFoundException if the queue does not exist.
     */
    async getQueueStatus(
        user: User,
        queueId: number,
    ): Promise<QueueStatusResponse> {
        const queue = await this.queueRepository.findOne({
            where: { id: queueId },
        });

        if (!queue) {
            throw new NotFoundException('Queue not found');
        }

        // Find the user's active entry in this queue.
        const entry = await this.queueEntryRepository.findOne({
            where: {
                queueId,
                userId: user.id,
                status: QueueEntryStatus.WAITING,
            },
        });

        // If the user hasn't joined this queue, return a simple status.
        if (!entry) {
            return { status: 'not_joined', queue };
        }

        // Count how many participants are ahead (have a lower position number).
        // Using QueryBuilder because TypeORM's find options don't support
        // "less than another column's value" comparisons.
        const peopleAhead = await this.queueEntryRepository
            .createQueryBuilder('entry')
            .where('entry.queueId = :queueId', { queueId })
            .andWhere('entry.status = :status', {
                status: QueueEntryStatus.WAITING,
            })
            .andWhere('entry.position < :position', { position: entry.position })
            .getCount();

        return {
            status: 'joined',
            position: entry.position,
            peopleAhead,
            estimatedWaitTime: peopleAhead * queue.avgServiceTime,
            entry,
        };
    }

    /**
     * Verifies a QR code token scanned by the queue owner.
     *
     * Steps:
     * 1. Validates the HMAC signature to ensure the token hasn't been tampered with.
     * 2. Confirms the queue exists and the scanner is the owner.
     * 3. Retrieves and returns the queue entry associated with the token.
     *
     * @param token   - The full QR code token string (format: `userId:queueId:timestamp.signature`).
     * @param ownerId - The ID of the user scanning the QR code (must be the queue owner).
     * @returns The {@link QueueEntry} with the `user` relation loaded.
     * @throws ForbiddenException if the signature is invalid or the scanner is not the owner.
     * @throws NotFoundException  if the queue or entry is not found.
     */
    async verifyQrCode(
        token: string,
        ownerId: number,
    ): Promise<QueueEntry> {
        // Step 1: Extract components and verify the HMAC signature.
        const [userIdStr, queueIdStr, timestamp, signature] = token.split(/[:.]/);
        const payload = `${userIdStr}:${queueIdStr}:${timestamp}`;
        const expectedSignature = this.computeHmacSignature(payload);

        if (signature !== expectedSignature) {
            throw new ForbiddenException('Invalid QR Code');
        }

        const queueId = parseInt(queueIdStr, 10);

        // Step 2: Verify queue ownership.
        const queue = await this.queueRepository.findOne({
            where: { id: queueId },
        });

        if (!queue) {
            throw new NotFoundException('Queue not found');
        }

        if (queue.ownerId !== ownerId) {
            throw new ForbiddenException('You do not own this queue');
        }

        // Step 3: Retrieve the queue entry by token.
        const entry = await this.queueEntryRepository.findOne({
            where: { qrCodeToken: token },
            relations: ['user'],
        });

        if (!entry) {
            throw new NotFoundException('Entry not found or invalid token');
        }

        return entry;
    }

    // ──────────────────────────────────────────────
    // Owner Management
    // ──────────────────────────────────────────────

    /**
     * Moves a participant to a new position in the queue (owner-only).
     *
     * This operation runs inside a database transaction to ensure
     * position consistency. When a user is moved:
     * - **Moving UP** (e.g. position 5 → 2): Participants at positions 2–4 shift down by 1.
     * - **Moving DOWN** (e.g. position 2 → 5): Participants at positions 3–5 shift up by 1.
     *
     * @param ownerId - The ID of the user performing the action (must be the queue owner).
     * @param queueId - The ID of the queue to reorder.
     * @param dto     - Contains `userId` (the participant to move) and `newPosition`.
     * @returns The updated {@link QueueEntry} with the new position.
     * @throws ForbiddenException if the caller is not the queue owner.
     * @throws NotFoundException  if the target user is not in the queue.
     */
    async prioritizeUser(
        ownerId: number,
        queueId: number,
        dto: PrioritizeUserDto,
    ): Promise<QueueEntry> {
        return this.dataSource.transaction(async (manager) => {
            // Verify queue ownership.
            const queue = await manager.findOne(Queue, { where: { id: queueId } });

            if (!queue || queue.ownerId !== ownerId) {
                throw new ForbiddenException('Not owner');
            }

            // Find the target user's entry in the queue.
            const targetEntry = await manager.findOne(QueueEntry, {
                where: {
                    userId: dto.userId,
                    queueId,
                    status: QueueEntryStatus.WAITING,
                },
            });

            if (!targetEntry) {
                throw new NotFoundException('User not in queue');
            }

            const oldPosition = targetEntry.position;
            const newPosition = dto.newPosition;

            // If the position hasn't changed, return early.
            if (oldPosition === newPosition) {
                return targetEntry;
            }

            if (newPosition < oldPosition) {
                // Moving UP: shift entries between newPosition and oldPosition down (+1).
                await manager
                    .createQueryBuilder()
                    .update(QueueEntry)
                    .set({ position: () => 'position + 1' })
                    .where('queueId = :queueId', { queueId })
                    .andWhere('status = :status', {
                        status: QueueEntryStatus.WAITING,
                    })
                    .andWhere('position >= :newPos', { newPos: newPosition })
                    .andWhere('position < :oldPos', { oldPos: oldPosition })
                    .execute();
            } else {
                // Moving DOWN: shift entries between oldPosition and newPosition up (-1).
                await manager
                    .createQueryBuilder()
                    .update(QueueEntry)
                    .set({ position: () => 'position - 1' })
                    .where('queueId = :queueId', { queueId })
                    .andWhere('status = :status', {
                        status: QueueEntryStatus.WAITING,
                    })
                    .andWhere('position > :oldPos', { oldPos: oldPosition })
                    .andWhere('position <= :newPos', { newPos: newPosition })
                    .execute();
            }

            // Update the target entry's position.
            targetEntry.position = newPosition;
            return manager.save(targetEntry);
        });
    }

    // ──────────────────────────────────────────────
    // Private Helpers
    // ──────────────────────────────────────────────

    /**
     * Generates a unique, HMAC-signed QR code token for a queue entry.
     *
     * The token format is: `userId:queueId:timestamp.hmacSignature`
     *
     * @param userId  - The ID of the user joining the queue.
     * @param queueId - The ID of the queue being joined.
     * @returns The complete QR code token string.
     */
    private generateQrCodeToken(userId: number, queueId: number): string {
        const payload = `${userId}:${queueId}:${Date.now()}`;
        const signature = this.computeHmacSignature(payload);
        return `${payload}.${signature}`;
    }

    /**
     * Computes an HMAC-SHA256 signature for the given payload.
     *
     * Uses the `JWT_SECRET` environment variable as the signing key.
     *
     * @param payload - The string to sign.
     * @returns The hex-encoded HMAC signature.
     */
    private computeHmacSignature(payload: string): string {
        const secret = this.configService.get<string>('JWT_SECRET') || 'secret';
        return crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    }
}
