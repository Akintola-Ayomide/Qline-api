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

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local authentication guard.
 *
 * When applied, this guard:
 * 1. Reads `email` and `password` from the request body.
 * 2. Passes them to the {@link LocalStrategy} for validation.
 * 3. Attaches the authenticated user to `req.user` if credentials are valid.
 * 4. Rejects the request with the specific error from the strategy if invalid,
 *    rather than Passport's generic 401 message.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
    /**
     * Override handleRequest to preserve specific error messages thrown by
     * LocalStrategy (e.g. "Email not verified") instead of Passport replacing
     * them with a generic "Unauthorized" response.
     */
    handleRequest(err: any, user: any, info: any) {
        // If the strategy threw a specific error, re-throw it as-is.
        if (err) {
            throw err;
        }
        // If no user was returned (null), throw with the strategy's info message
        // or a generic fallback.
        if (!user) {
            const message =
                info?.message || 'Invalid email or password';
            throw new UnauthorizedException(message);
        }
        return user;
    }
}
