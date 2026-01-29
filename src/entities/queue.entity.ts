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

export enum QueueStatus {
    ACTIVE = 'active',
    PAUSED = 'paused',
    CLOSED = 'closed',
}

@Entity('queues')
export class Queue {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'int', default: 50 })
    maxParticipants: number;

    @Column({ type: 'jsonb', default: [] })
    customFields: Record<string, any>[];

    @Column({ type: 'int', default: 5 }) // Average service time in minutes
    avgServiceTime: number;

    @Column({
        type: 'enum',
        enum: QueueStatus,
        default: QueueStatus.ACTIVE,
    })
    status: QueueStatus;

    // Ownership
    @ManyToOne(() => User, (user) => user.id)
    @JoinColumn({ name: 'ownerId' })
    owner: User;

    @Column()
    ownerId: number;

    @OneToMany('QueueEntry', (entry: any) => entry.queue)
    entries: QueueEntry[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
