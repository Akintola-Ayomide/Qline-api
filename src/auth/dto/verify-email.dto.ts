/**
 * @file verify-email.dto.ts
 * @description DTO for the `POST /auth/verify-email` endpoint.
 * Carries the OTP code along with the full registration payload so the
 * user is created in a single atomic step once verification succeeds.
 */

import { IsString, IsEmail, MinLength, Length } from 'class-validator';

/**
 * DTO for verifying a signup OTP and completing account creation.
 */
export class VerifyEmailDto {
    /** The user's email address (must match the one the code was sent to). */
    @IsEmail()
    email: string;

    /** The 6-digit OTP received via email. */
    @IsString()
    @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
    code: string;

    /** The user's chosen display name. */
    @IsString()
    name: string;

    /**
     * The user's chosen password.
     * Must be at least 8 characters long for security.
     */
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password: string;
}
