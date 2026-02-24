/**
 * @file register.dto.ts
 * @description Data Transfer Object for user registration.
 * Validated via `class-validator` decorators before reaching the service layer.
 */

import { IsString, IsEmail, MinLength } from 'class-validator';

/**
 * DTO for the `POST /auth/register` endpoint.
 *
 * Contains the required fields a user must provide to create a new account.
 */
export class RegisterDto {
    /** The user's display name. Must be a non-empty string. */
    @IsString()
    name: string;

    /** The user's email address. Must be a valid email format. */
    @IsEmail()
    email: string;

    /**
     * The user's chosen password.
     * Must be at least 8 characters long for security.
     */
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password: string;
}
