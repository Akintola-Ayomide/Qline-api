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
     * @param email    - The email from the request body.
     * @param password - The plain-text password from the request body.
     * @returns The authenticated {@link User} object (attached to `req.user` by Passport).
     * @throws UnauthorizedException if the email/password combination is invalid.
     */
    async validate(email: string, password: string): Promise<any> {
        const user = await this.authService.validateUser(email, password);

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }
}
