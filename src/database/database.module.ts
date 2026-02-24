/**
 * @file database.module.ts
 * @description NestJS module that configures the TypeORM PostgreSQL database connection.
 * Connection settings (URL, SSL, synchronize mode) are read from environment variables
 * via {@link ConfigService}.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Queue } from '../entities/queue.entity';
import { QueueEntry } from '../entities/queue-entry.entity';

/**
 * Database module.
 *
 * Configures a TypeORM connection to a PostgreSQL database using the
 * `DATABASE_URL` environment variable. All application entities are
 * registered here so TypeORM can discover them.
 *
 * **Important notes:**
 * - `synchronize` is enabled in non-production environments only.
 *   In production, use database migrations instead to avoid data loss.
 * - SSL is enabled with `rejectUnauthorized: false` for cloud-hosted databases
 *   that use self-signed certificates (e.g. Render, Railway, Supabase).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),

        // Register all entities so TypeORM can create and manage their tables.
        entities: [User, Queue, QueueEntry],

        // Auto-sync schema in development only. NEVER use in production.
        synchronize: configService.get('NODE_ENV') !== 'production',

        // Enable SSL for cloud-hosted databases.
        ssl: {
          rejectUnauthorized: false,
        },
      }),
    }),
  ],
})
export class DatabaseModule { }
