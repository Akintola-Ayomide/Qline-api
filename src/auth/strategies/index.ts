/**
 * @file index.ts
 * @description Barrel file that re-exports all Passport strategies for cleaner imports.
 *
 * @example
 * import { LocalStrategy, JwtStrategy, GoogleStrategy } from './strategies';
 */

export * from './local.strategy';
export * from './jwt.strategy';
export * from './google.strategy';
