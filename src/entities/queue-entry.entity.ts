import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity.js';
import { Queue } from './queue.entity.js';

export enum QueueEntryStatus {
    WAITING = 'waiting',
    SERVING = 'serving',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

@Entity('queue_entries')
@Index(['queueId', 'userId', 'status'], { unique: true, where: "status IN ('waiting', 'serving')" }) // Prevent duplicate active entries
export class QueueEntry {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne('Queue', (queue: any) => queue.entries, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'queueId' })
    queue: Queue;

    @Column()
    queueId: number;

    @ManyToOne(() => User, (user) => user.id)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: number;

    @Column({ type: 'int' })
    position: number;

    @Column({ type: 'jsonb', nullable: true })
    customData: Record<string, any>;

    @Column({ type: 'text', unique: true })
    qrCodeToken: string;

    @Column({
        type: 'enum',
        enum: QueueEntryStatus,
        default: QueueEntryStatus.WAITING,
    })
    status: QueueEntryStatus;

    @Column({ type: 'timestamp', nullable: true })
    joinedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    servedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
