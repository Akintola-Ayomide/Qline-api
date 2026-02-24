/**
 * @file jwt-auth.guard.ts
 * @description Guard that protects routes using JWT (JSON Web Token) authentication.
 * It extends Passport's built-in `AuthGuard` and uses the 'jwt' strategy
 * defined in {@link JwtStrategy} to validate the token.
 *
 * @example
 * // Apply to a single route:
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile() { ... }
 *
 * // Apply to an entire controller:
 * @UseGuards(JwtAuthGuard)
 * @Controller('protected')
 * export class ProtectedController { ... }
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT authentication guard.
 *
 * When applied, this guard:
 * 1. Extracts the JWT from the request (cookie or `Authorization` header).
 * 2. Verifies the token's signature and expiration using the {@link JwtStrategy}.
 * 3. Attaches the decoded user payload to `req.user`.
 * 4. Rejects the request with a `401 Unauthorized` if the token is missing or invalid.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }
