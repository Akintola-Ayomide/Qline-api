/**
 * @file local.strategy.ts
 * @description Passport local strategy for validating email + password credentials.
 * Used by the {@link LocalAuthGuard} on the `POST /auth/login` endpoint.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/**
 * Passport strategy for local (email + password) authentication.
 *
 * By default, `passport-local` expects `username` and `password` fields in the
 * request body. We override `usernameField` to `'email'` so Passport reads the
 * `email` field instead.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    /**
     * @param authService - Injected AuthService used to validate user credentials.
     */
    constructor(private readonly authService: AuthService) {
        // Tell passport-local to look for 'email' instead of 'username' in the request body.
        super({ usernameField: 'email' });
    }

    /**
     * Called by Passport to validate the provided credentials.
     *
     * Specific exceptions thrown by validateUser (e.g. unverified email) are
     * allowed to bubble through so the client sees the real reason rather than
     * a generic "Invalid credentials" message.
     *
     * @param email    - The email from the request body.
     * @param password - The plain-text password from the request body.
     * @returns The authenticated {@link User} object (attached to `req.user` by Passport).
     * @throws UnauthorizedException if the email/password combination is invalid.
     */
    async validate(email: string, password: string): Promise<any> {
        // validateUser may throw its own UnauthorizedException with a specific
        // message (e.g. unverified email). Let those bubble through so the client
        // receives the real reason rather than a generic "Invalid credentials".
        const user = await this.authService.validateUser(email, password);

        if (!user) {
            // null means wrong password or user not found.
            throw new UnauthorizedException('Invalid email or password');
        }

        return user;
    }
}
