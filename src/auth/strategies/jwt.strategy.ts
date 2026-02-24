/**
 * @file jwt.strategy.ts
 * @description Passport JWT strategy for validating JSON Web Tokens.
 * The token is extracted from HTTP-only cookies first, falling back
 * to the `Authorization: Bearer <token>` header. Once validated,
 * the decoded payload is attached to `req.user`.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Shape of the decoded JWT payload.
 *
 * - `sub`   — The user's database ID (set during token signing).
 * - `email` — The user's email address.
 */
export interface JwtPayload {
    sub: number;
    email: string;
}

/**
 * Passport strategy that validates JWT tokens.
 *
 * Token extraction order:
 * 1. Reads the `token` cookie from the request (set during login/register).
 * 2. Falls back to the `Authorization: Bearer <token>` header (useful for mobile apps).
 *
 * If the token is valid and not expired, the {@link validate} method
 * returns the user object that will be attached to `req.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    /**
     * Configures the JWT strategy with the signing secret and extraction logic.
     *
     * @param configService - NestJS ConfigService used to read `JWT_SECRET` from environment variables.
     * @throws Error if `JWT_SECRET` is not defined in the environment.
     */
    constructor(configService: ConfigService) {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }

        super({
            // Define multiple token extractors — cookie first, then Authorization header.
            jwtFromRequest: ExtractJwt.fromExtractors([
                // Extractor 1: Read token from HTTP-only cookie named 'token'.
                (req: Request) => {
                    return req?.cookies?.['token'] ?? null;
                },
                // Extractor 2: Read token from 'Authorization: Bearer <token>' header.
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: secret,
        });
    }

    /**
     * Called by Passport after the JWT is decoded and verified.
     *
     * @param payload - The decoded JWT payload containing the user's ID and email.
     * @returns An object with `id` and `email` that will be attached to `req.user`.
     * @throws UnauthorizedException if the payload does not contain a valid `sub` claim.
     */
    async validate(payload: JwtPayload): Promise<{ id: number; email: string }> {
        if (!payload.sub) {
            throw new UnauthorizedException();
        }

        return { id: payload.sub, email: payload.email };
    }
}
