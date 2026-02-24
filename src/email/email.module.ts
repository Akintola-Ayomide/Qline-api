/**
 * @file email.module.ts
 * @description NestJS module that provides the {@link EmailService} for sending
 * transactional emails (e.g. password-reset emails).
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';

/**
 * Email module.
 *
 * Imports {@link ConfigModule} so the {@link EmailService} can read
 * SMTP configuration from environment variables. Exports the service
 * for use in other modules (e.g. {@link AuthModule}).
 */
@Module({
    imports: [ConfigModule],
    providers: [EmailService],
    exports: [EmailService],
})
export class EmailModule { }
