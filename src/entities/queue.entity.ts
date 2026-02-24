/**
 * @file queue.entity.ts
 * @description TypeORM entity representing a queue in the Qline system.
 * A queue is created by a user (the owner) and can be joined by other users.
 * It tracks capacity, status, custom data fields, and average service time.
 */

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity.js';
import { QueueEntry } from './queue-entry.entity.js';

/**
 * Enum representing the current operational status of a queue.
 *
 * - `ACTIVE` — The queue is open and accepting new participants.
 * - `PAUSED` — The queue is temporarily paused; no new joins allowed.
 * - `CLOSED` — The queue is permanently closed.
 */
export enum QueueStatus {
    ACTIVE = 'active',
    PAUSED = 'paused',
    CLOSED = 'closed',
}

/**
 * Queue entity mapped to the `queues` database table.
 *
 * Represents a single queue owned by a {@link User}. Participants join
 * the queue by creating {@link QueueEntry} records.
 */
@Entity('queues')
export class Queue {
    /** Auto-generated primary key. */
    @PrimaryGeneratedColumn()
    id: number;

    /** Human-readable name of the queue (e.g. "Customer Service"). */
    @Column()
    name: string;

    /** Optional description providing more details about the queue. */
    @Column({ type: 'text', nullable: true })
    description: string;

    /**
     * Maximum number of participants allowed in the queue at one time.
     * Defaults to 50 if not specified during queue creation.
     */
    @Column({ type: 'int', default: 50 })
    maxParticipants: number;

    /**
     * Array of custom field definitions that participants must fill in when joining.
     * Each entry describes a field (e.g. `{ label: 'Phone', type: 'text' }`).
     */
    @Column({ type: 'jsonb', default: [] })
    customFields: Record<string, any>[];

    /**
     * Average service time per participant, in minutes.
     * Used to calculate estimated wait times. Defaults to 5 minutes.
     */
    @Column({ type: 'int', default: 5 })
    avgServiceTime: number;

    /** Current operational status of the queue. Defaults to ACTIVE. */
    @Column({
        type: 'enum',
        enum: QueueStatus,
        default: QueueStatus.ACTIVE,
    })
    status: QueueStatus;

    /**
     * The user who owns and manages this queue.
     * Defined as a many-to-one relationship to the {@link User} entity.
     */
    @ManyToOne(() => User, (user) => user.id)
    @JoinColumn({ name: 'ownerId' })
    owner: User;

    /** Foreign key referencing the owner's user ID. */
    @Column()
    ownerId: number;

    /**
     * List of entries (participants) in this queue.
     * Defined as a one-to-many relationship to the {@link QueueEntry} entity.
     */
    @OneToMany('QueueEntry', (entry: any) => entry.queue)
    entries: QueueEntry[];

    /** Timestamp when the queue was created. */
    @CreateDateColumn()
    createdAt: Date;

    /** Timestamp when the queue was last updated. */
    @UpdateDateColumn()
    updatedAt: Date;
}
