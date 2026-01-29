import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { Queue } from '../entities/queue.entity';
import { QueueEntry } from '../entities/queue-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Queue, QueueEntry])],
  providers: [QueueService],
  controllers: [QueueController],
})
export class QueueModule { }
