/**
 * @file queue-entry.entity.ts
 * @description TypeORM entity representing a single participant's entry in a queue.
 * Each entry tracks the user's position, status, custom data, QR code token,
 * and relevant timestamps throughout the queue lifecycle.
 */

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

/**
 * Enum representing the lifecycle status of a queue entry.
 *
 * - `WAITING`   — The user is in line and waiting to be served.
 * - `SERVING`   — The user is currently being served.
 * - `COMPLETED` — The user has been served and left the queue.
 * - `CANCELLED` — The user (or owner) cancelled the entry before being served.
 */
export enum QueueEntryStatus {
    WAITING = 'waiting',
    SERVING = 'serving',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

/**
 * QueueEntry entity mapped to the `queue_entries` database table.
 *
 * Represents a single user's participation in a specific {@link Queue}.
 * A unique partial index prevents duplicate active entries
 * (same user in the same queue with a `waiting` or `serving` status).
 */
@Entity('queue_entries')
@Index(
    ['queueId', 'userId', 'status'],
    { unique: true, where: "status IN ('waiting', 'serving')" },
)
export class QueueEntry {
    /** Auto-generated primary key. */
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * The queue this entry belongs to.
     * Cascades on delete — if the queue is removed, all entries are removed too.
     */
    @ManyToOne('Queue', (queue: any) => queue.entries, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'queueId' })
    queue: Queue;

    /** Foreign key referencing the parent queue's ID. */
    @Column()
    queueId: number;

    /** The user who holds this queue entry. */
    @ManyToOne(() => User, (user) => user.id)
    @JoinColumn({ name: 'userId' })
    user: User;

    /** Foreign key referencing the participant's user ID. */
    @Column()
    userId: number;

    /**
     * The user's current position in the queue.
     * A lower number means they are closer to being served.
     */
    @Column({ type: 'int' })
    position: number;

    /**
     * Custom data submitted by the user when joining the queue,
     * based on the queue's `customFields` definition.
     */
    @Column({ type: 'jsonb', nullable: true })
    customData: Record<string, any>;

    /**
     * Unique HMAC-signed token used to generate a QR code.
     * The queue owner scans this token to verify the participant.
     */
    @Column({ type: 'text', unique: true })
    qrCodeToken: string;

    /** Current lifecycle status of this queue entry. Defaults to WAITING. */
    @Column({
        type: 'enum',
        enum: QueueEntryStatus,
        default: QueueEntryStatus.WAITING,
    })
    status: QueueEntryStatus;

    /** Flag indicating whether the "3 people ahead" position alert email was sent. */
    @Column({ type: 'boolean', default: false })
    positionAlertSent: boolean;

    /** Flag indicating whether the "≤5 min remaining" wait-time alert email was sent. */
    @Column({ type: 'boolean', default: false })
    waitTimeAlertSent: boolean;

    /** Timestamp when the user joined the queue. */
    @Column({ type: 'timestamp', nullable: true })
    joinedAt: Date;

    /** Timestamp when the user started being served. */
    @Column({ type: 'timestamp', nullable: true })
    servedAt: Date;

    /** Timestamp when service was completed. */
    @Column({ type: 'timestamp', nullable: true })
    completedAt: Date;

    /** Timestamp when the record was created in the database. */
    @CreateDateColumn()
    createdAt: Date;
}
