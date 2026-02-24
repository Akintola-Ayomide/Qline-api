/**
 * @file app.controller.ts
 * @description Root controller that provides a basic health-check endpoint.
 * This is the default controller created by NestJS and can be used
 * to verify the server is running.
 */

import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Root controller for the application.
 *
 * Provides a simple `GET /` endpoint that returns a greeting message.
 * Useful as a health-check or liveness probe.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  /**
   * Health-check endpoint.
   *
   * @returns A greeting string confirming the server is running.
   *
   * @example
   * // GET /
   * // Response: "Hello World!"
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
