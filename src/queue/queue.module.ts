/**
 * @file queue.module.ts
 * @description NestJS module that configures and provides all queue-related
 * functionality including the controller, service, and TypeORM entity registration.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { Queue } from '../entities/queue.entity';
import { QueueEntry } from '../entities/queue-entry.entity';

/**
 * Queue module.
 *
 * Registers the {@link Queue} and {@link QueueEntry} entities for TypeORM
 * repository injection, and provides the queue controller and service.
 */
@Module({
  imports: [
    // Register Queue and QueueEntry entities for @InjectRepository() usage.
    TypeOrmModule.forFeature([Queue, QueueEntry]),
  ],
  providers: [QueueService],
  controllers: [QueueController],
})
export class QueueModule { }
