/**
 * @file index.ts
 * @description Barrel file that re-exports all Auth Guards for cleaner imports.
 *
 * @example
 * // Import multiple guards from a single path:
 * import { LocalAuthGuard, JwtAuthGuard, GoogleAuthGuard } from './guards';
 */

export * from './local-auth.guard';
export * from './jwt-auth.guard';
export * from './google-auth.guard';
