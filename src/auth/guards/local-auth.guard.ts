/**
 * @file local-auth.guard.ts
 * @description Guard that protects the login route using local (email + password) authentication.
 * It extends Passport's built-in `AuthGuard` and uses the 'local' strategy
 * defined in {@link LocalStrategy} to validate credentials.
 *
 * @example
 * // Apply to the login endpoint:
 * @UseGuards(LocalAuthGuard)
 * @Post('login')
 * login(@Req() req) { ... }
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local authentication guard.
 *
 * When applied, this guard:
 * 1. Reads `email` and `password` from the request body.
 * 2. Passes them to the {@link LocalStrategy} for validation.
 * 3. Attaches the authenticated user to `req.user` if credentials are valid.
 * 4. Rejects the request with a `401 Unauthorized` if credentials are invalid.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') { }
