import { IsString, IsOptional, IsInt, Min, IsArray, IsEnum } from 'class-validator';

export class CreateQueueDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    maxParticipants?: number;

    @IsInt()
    @Min(1)
    @IsOptional()
    avgServiceTime?: number;

    @IsArray()
    @IsOptional()
    customFields?: Record<string, any>[];
}

export class JoinQueueDto {
    @IsInt()
    queueId: number;

    @IsOptional()
    customData?: Record<string, any>;
}

export class PrioritizeUserDto {
    @IsInt()
    userId: number; // The user to prioritize

    @IsInt()
    newPosition: number;
}
