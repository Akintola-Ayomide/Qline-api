/**
 * @file main.ts
 * @description Application entry point. Bootstraps the NestJS application,
 * configures global middleware (CORS, cookie parsing, validation),
 * and starts the HTTP server on the configured port.
 */

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

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
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS — reflects the request origin so all origins are allowed.
  // `credentials: true` ensures cookies are included in cross-origin requests.
  app.enableCors({
    origin: true,
    credentials: true,
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

  // Start the server on the configured port (default: 8000).
  const port = configService.get<number>('PORT', 8000);
  await app.listen(port);
}

bootstrap();
