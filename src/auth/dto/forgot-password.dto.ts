/**
 * @file forgot-password.dto.ts
 * @description Data Transfer Object for requesting a password reset.
 * Validated via `class-validator` decorators before reaching the service layer.
 */

import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * DTO for the `POST /auth/forgot-password` endpoint.
 *
 * Contains the email address of the account requesting a password reset.
 */
export class ForgotPasswordDto {
    /**
     * The email address associated with the account.
     * Must be a valid, non-empty email format.
     */
    @IsEmail()
    @IsNotEmpty()
    email: string;
}
