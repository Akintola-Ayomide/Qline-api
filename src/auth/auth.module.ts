/**
 * @file auth.module.ts
 * @description NestJS module that configures and provides all authentication
 * related functionality including Passport strategies, JWT signing,
 * and the auth controller/service.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../entities/user.entity';
import { LocalStrategy, JwtStrategy, GoogleStrategy } from './strategies';
import { EmailModule } from '../email/email.module';

/**
 * Authentication module.
 *
 * Responsibilities:
 * - Registers the {@link User} entity for TypeORM repository injection.
 * - Configures {@link PassportModule} for strategy-based authentication.
 * - Configures {@link JwtModule} asynchronously to read the signing secret
 *   and expiration from environment variables.
 * - Imports {@link EmailModule} for sending password-reset emails.
 * - Provides the three Passport strategies: Local, JWT, and Google OAuth.
 * - Exports {@link AuthService} so other modules can reuse auth logic.
 */
@Module({
  imports: [
    // Register the User entity so it can be injected with @InjectRepository(User).
    TypeOrmModule.forFeature([User]),

    // Enable Passport-based authentication.
    PassportModule,

    // Import the email module for password-reset email delivery.
    EmailModule,

    // Configure JWT signing asynchronously with environment variable values.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error(
            'JWT_SECRET is not defined in environment variables',
          );
        }

        // Read expiration in seconds (default: 7 days = 604,800 seconds).
        // Using a numeric seconds value avoids Passport/JWT string-parsing issues.
        const expiresInSeconds =
          configService.get<number>('JWT_EXPIRES_IN_SECONDS') || 604800;

        return {
          secret,
          signOptions: {
            expiresIn: expiresInSeconds,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule { }
