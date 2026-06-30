/**
 * @file user.entity.ts
 * @description TypeORM entity representing a user in the Qline system.
 * Users can register via local email/password or Google OAuth.
 * This entity also stores optional password-reset token data
 * and email-verification OTP fields used during the signup flow.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Enum representing the authentication provider used to create the user account.
 *
 * - `LOCAL`  — User registered with email and password.
 * - `GOOGLE` — User signed in via Google OAuth.
 */
export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  GUEST = 'guest',
}

/**
 * User entity mapped to the `users` database table.
 *
 * Stores core user information (email, name, avatar), authentication details
 * (password hash, Google ID, auth provider), and optional password-reset fields.
 */
@Entity('users')
export class User {
  /** Auto-generated primary key. */
  @PrimaryGeneratedColumn()
  id: number;

  /** Unique email address used for authentication and contact. */
  @Column({ unique: true })
  email: string;

  /** Display name of the user. */
  @Column()
  name: string;

  /**
   * Hashed password for local authentication.
   * `null` when the user signed up exclusively via Google OAuth.
   */
  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  /** The authentication provider that was used to create this account. */
  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  provider: AuthProvider;

  /**
   * Google account ID.
   * `null` for users who haven't linked a Google account.
   */
  @Column({ type: 'varchar', nullable: true })
  googleId: string | null;

  /** URL to the user's profile picture (populated by Google OAuth or manual upload). */
  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  /**
   * Hashed token used for password-reset verification.
   * Set when a user requests a password reset; cleared after the reset completes.
   */
  @Column({ type: 'varchar', nullable: true })
  resetPasswordToken: string | null;

  /**
   * Expiration timestamp for the password-reset token.
   * The token is only valid before this date.
   */
  @Column({ type: 'timestamp', nullable: true })
  resetPasswordExpires: Date | null;

  /**
   * Bcrypt-hashed 6-digit OTP sent to the user's email during signup.
   * Cleared once the account is verified.
   */
  @Column({ type: 'varchar', nullable: true })
  emailVerificationCode: string | null;

  /**
   * Expiry timestamp for the email-verification OTP.
   * The code is only accepted before this date.
   */
  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires: Date | null;

  /**
   * Whether the user's email address has been verified.
   * Local accounts must be verified before they can log in.
   * Google OAuth accounts are considered verified by default.
   */
  @Column({ default: false })
  isEmailVerified: boolean;

  /** Timestamp when the user record was created. */
  @CreateDateColumn()
  createdAt: Date;

  /** Timestamp when the user record was last updated. */
  @UpdateDateColumn()
  updatedAt: Date;
}
