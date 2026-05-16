/**
 * @file queue.dto.ts
 * @description Data Transfer Objects for queue-related endpoints.
 * Validated via `class-validator` decorators before reaching the service layer.
 */

import { IsString, IsOptional, IsInt, Min, Max, IsArray, IsEnum } from 'class-validator';
import { QueueStatus } from '../../entities/queue.entity';

/**
 * DTO for the `PATCH /queues/:id/status` endpoint — updates queue status.
 */
export class UpdateQueueStatusDto {
    @IsEnum(QueueStatus)
    status: QueueStatus;
}

/**
 * DTO for the `POST /queues` endpoint — creates a new queue.
 *
 * Only `name` is required. All other fields have sensible defaults
 * defined on the {@link Queue} entity.
 */
export class CreateQueueDto {
    /** Human-readable name for the queue (e.g. "Customer Service"). */
    @IsString()
    name: string;

    /** Optional description providing more context about the queue. */
    @IsString()
    @IsOptional()
    description?: string;

    /**
     * Maximum number of participants allowed in the queue.
     * Must be at least 1. Defaults to 50 if not specified.
     */
    @IsInt()
    @Min(1)
    @Max(1000)
    @IsOptional()
    maxParticipants?: number;

    /**
     * Average service time per participant, in minutes.
     * Used to estimate wait times. Must be at least 1. Defaults to 5.
     */
    @IsInt()
    @Min(1)
    @IsOptional()
    avgServiceTime?: number;

    /**
     * Optional array of custom field definitions that participants
     * must fill in when joining the queue.
     *
     * @example
     * [{ label: "Phone Number", type: "text", required: true }]
     */
    @IsArray()
    @IsOptional()
    customFields?: Record<string, any>[];
}

/**
 * DTO for the `POST /queues/join` endpoint — joins an existing queue.
 */
export class JoinQueueDto {
    /** The ID of the queue to join. */
    @IsInt()
    queueId: number;

    /**
     * Optional custom data submitted by the user when joining.
     * Should match the queue's `customFields` schema.
     */
    @IsOptional()
    customData?: Record<string, any>;
}

/**
 * DTO for the `PATCH /queues/:id/prioritize` endpoint — moves a user to a new position.
 *
 * Only the queue owner can use this endpoint.
 */
export class PrioritizeUserDto {
    /** The ID of the user to move within the queue. */
    @IsInt()
    userId: number;

    /** The new position to assign to the user. */
    @IsInt()
    newPosition: number;
}
