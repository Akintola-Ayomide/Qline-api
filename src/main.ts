/**
 * @file main.ts
 * @description Application entry point. Bootstraps the NestJS application,
 * configures global middleware (CORS, cookie parsing, validation),
 * and starts the HTTP server on the configured port.
 */

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { join } from 'path';

/**
 * Bootstraps and starts the NestJS application.
 *
 * Steps performed:
 * 1. Creates the NestJS application instance from {@link AppModule}.
 * 2. Enables CORS to allow cross-origin requests (reflects request origin).
 * 3. Registers the `cookie-parser` middleware so cookies can be read from requests.
 * 4. Applies global validation pipes to automatically validate incoming DTOs.
 * 5. Listens on the port defined by the `PORT` environment variable (defaults to 8000).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Serve static uploads
  app.useStaticAssets(join(process.cwd(), 'public', 'uploads'), {
    prefix: '/uploads',
  });

  // Enable CORS — allows the frontend to make credentialed cross-origin requests.
  // In production, only the configured FRONTEND_URL is allowed as an origin.
  // `credentials: true` is required for cookies; `allowedHeaders` must include
  // 'Authorization' so the Bearer token strategy works cross-domain.
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  app.enableCors({
    origin: frontendUrl
      ? [frontendUrl, 'http://localhost:3000']
      : true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Register cookie-parser so we can read JWT tokens stored in HTTP-only cookies.
  app.use(cookieParser());

  // Apply global validation pipes:
  // - `transform: true`  → automatically transforms payloads to DTO class instances.
  // - `whitelist: true`   → strips any properties not defined in the DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Apply global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Start the server on the configured port (default: 8000).
  const port = configService.get<number>('PORT', 8000);
  await app.listen(port);
}

bootstrap();
