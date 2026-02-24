/**
 * @file login.dto.ts
 * @description Data Transfer Object for user login.
 * Validated via `class-validator` decorators before reaching the service layer.
 */

import { IsString, IsEmail } from 'class-validator';

/**
 * DTO for the `POST /auth/login` endpoint.
 *
 * Contains the credentials needed to authenticate a user via local strategy.
 */
export class LoginDto {
    /** The user's email address. Must be a valid email format. */
    @IsEmail()
    email: string;

    /** The user's password in plain text (will be compared against the stored hash). */
    @IsString()
    password: string;
}
