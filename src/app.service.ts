/**
 * @file app.service.ts
 * @description Root service providing basic application-level operations.
 */

import { Injectable } from '@nestjs/common';

/**
 * Root application service.
 *
 * Contains simple utility methods used by the {@link AppController}.
 */
@Injectable()
export class AppService {
  /**
   * Returns a simple greeting message.
   *
   * @returns The string "Hello World!".
   */
  getHello(): string {
    return 'Hello World!';
  }
}
