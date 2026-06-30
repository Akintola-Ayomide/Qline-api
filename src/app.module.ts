/**
 * @file app.module.ts
 * @description Root module of the Qline application.
 * Imports all feature modules and configures global settings such as
 * environment variable loading via {@link ConfigModule}.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { QueueModule } from './queue/queue.module';
import { UploadModule } from './upload/upload.module';

/**
 * The root application module that ties together all feature modules.
 *
 * - **ConfigModule** — Loads environment variables from `.env` and makes them
 *   globally available via `ConfigService`.
 * - **DatabaseModule** — Configures the TypeORM PostgreSQL database connection.
 * - **AuthModule** — Handles user registration, login, Google OAuth, and password reset.
 * - **QueueModule** — Manages queue creation, joining, status, and owner operations.
 * - **UploadModule** — Manages image and file uploading.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    QueueModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
