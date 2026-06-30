/**
 * @file index.ts
 * @description Barrel file that re-exports all Auth DTOs for cleaner imports.
 *
 * @example
 * // Instead of importing from individual files:
 * // import { RegisterDto } from './dto/register.dto';
 * // You can import from the barrel:
 * // import { RegisterDto, LoginDto } from './dto';
 */

export * from './register.dto';
export * from './forgot-password.dto';
export * from './reset-password.dto';
export * from './login.dto';
export * from './guest-register.dto';
export * from './verify-email.dto';
export * from './update-profile.dto';
