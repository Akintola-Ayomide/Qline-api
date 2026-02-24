/**
 * @file google-auth.guard.ts
 * @description Guard that initiates Google OAuth 2.0 authentication.
 * It extends Passport's built-in `AuthGuard` and uses the 'google' strategy
 * defined in {@link GoogleStrategy}. It also supports an optional `redirect_uri`
 * query parameter that is forwarded as Google OAuth `state` so the callback
 * knows where to redirect the user after authentication.
 */

import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Google OAuth 2.0 authentication guard.
 *
 * When applied, this guard:
 * 1. Redirects the user to Google's consent screen for authentication.
 * 2. Optionally reads a `redirect_uri` query parameter and passes it through
 *    as OAuth `state` so the callback handler can redirect to the correct client.
 * 3. On callback, attaches the authenticated user to `req.user`.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    /**
     * Builds custom authentication options for the Google OAuth flow.
     *
     * If the incoming request contains a `redirect_uri` query parameter,
     * it is serialized into the `state` parameter so it can be recovered
     * in the OAuth callback and used to redirect the user appropriately
     * (e.g. back to a mobile app or a specific web page).
     *
     * @param context - The current execution context containing the HTTP request.
     * @returns An object with the `state` property (or `undefined` if no redirect URI was provided).
     */
    getAuthenticateOptions(context: ExecutionContext): { state?: string } {
        const request = context.switchToHttp().getRequest();
        const redirectUri = request.query.redirect_uri as string | undefined;

        return {
            state: redirectUri ? JSON.stringify({ redirectUri }) : undefined,
        };
    }
}
