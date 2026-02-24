/**
 * @file reset-password.dto.ts
 * @description Data Transfer Object for resetting a user's password.
 * Validated via `class-validator` decorators before reaching the service layer.
 */

import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * DTO for the `POST /auth/reset-password` endpoint.
 *
 * Contains the reset token (received via email) and the new password.
 */
export class ResetPasswordDto {
    /** The password-reset token the user received in their email. */
    @IsString()
    @IsNotEmpty()
    token: string;

    /**
     * The new password to set on the user's account.
     * Must be at least 6 characters long.
     */
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    @IsNotEmpty()
    password: string;
}
