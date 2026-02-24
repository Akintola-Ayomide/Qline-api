/**
 * @file google.strategy.ts
 * @description Passport Google OAuth 2.0 strategy for authenticating users via Google.
 * On successful authentication, it creates or links a user account in the database.
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * Passport strategy for Google OAuth 2.0 authentication.
 *
 * Flow:
 * 1. User is redirected to Google's consent screen (triggered by {@link GoogleAuthGuard}).
 * 2. Google redirects back to the callback URL with an authorization code.
 * 3. Passport exchanges the code for tokens and calls {@link validate}.
 * 4. {@link validate} creates or links the user account in the database.
 * 5. The authenticated user is attached to `req.user`.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    /**
     * Configures the Google OAuth strategy with credentials from environment variables.
     *
     * @param configService - NestJS ConfigService to read Google OAuth credentials.
     * @param authService   - AuthService to create/link the user account after authentication.
     * @throws Error if any of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_CALLBACK_URL` is missing.
     */
    constructor(
        configService: ConfigService,
        private readonly authService: AuthService,
    ) {
        const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
        const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
        const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

        if (!clientID || !clientSecret || !callbackURL) {
            throw new Error(
                'Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL) must be defined in environment variables',
            );
        }

        super({
            clientID,
            clientSecret,
            callbackURL,
            scope: ['email', 'profile'],
        });
    }

    /**
     * Called by Passport after Google returns the user's profile.
     *
     * Extracts the user's Google ID, email, display name, and avatar photo,
     * then delegates to {@link AuthService.validateGoogleUser} to find or create
     * the corresponding user record in the database.
     *
     * @param accessToken  - Google access token (not stored; used by Google APIs if needed).
     * @param refreshToken - Google refresh token (not stored).
     * @param profile      - The user's Google profile containing `id`, `emails`, `displayName`, and `photos`.
     * @param done         - Passport verify callback. Call `done(null, user)` on success or `done(error)` on failure.
     */
    async validate(
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
    ): Promise<void> {
        const { id, emails, displayName, photos } = profile;

        // Google must provide at least one email address.
        if (!emails || emails.length === 0) {
            done(new Error('No email found in Google profile'), undefined);
            return;
        }

        // Create or link the user account in the database.
        const user = await this.authService.validateGoogleUser({
            googleId: id,
            email: emails[0].value,
            name: displayName,
            avatar: photos?.[0]?.value,
        });

        done(null, user);
    }
}
