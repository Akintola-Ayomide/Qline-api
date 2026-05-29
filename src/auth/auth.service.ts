/**
 * @file auth.service.ts
 * @description Service handling all authentication business logic including
 * user registration, login, Google OAuth, profile retrieval, and password reset.
 */

import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, AuthProvider } from '../entities/user.entity';
import { RegisterDto, GuestRegisterDto } from './dto';
import { EmailService } from '../email/email.service';

/**
 * Shape of the data extracted from a Google OAuth profile.
 * Used internally to create or link a user account.
 */
interface GoogleUserData {
    /** The user's unique Google account ID. */
    googleId: string;
    /** The user's email address from their Google profile. */
    email: string;
    /** The user's display name from their Google profile. */
    name: string;
    /** Optional URL to the user's Google profile photo. */
    avatar?: string;
}

/**
 * Shape of the response returned after successful authentication.
 * Includes a safe subset of user data and the signed JWT access token.
 */
export interface AuthResponse {
    user: {
        id: number;
        email: string;
        name: string;
        avatar: string | null;
        provider: AuthProvider;
    };
    accessToken: string;
}

/** Number of salt rounds used by bcrypt for password hashing. */
const BCRYPT_SALT_ROUNDS = 10;

/** Duration (in milliseconds) before a password-reset token expires. (1 hour) */
const PASSWORD_RESET_EXPIRY_MS = 3_600_000;

/**
 * Authentication service.
 *
 * Provides methods for:
 * - **Registration** — creating a new local user with hashed password.
 * - **Login** — validating credentials and issuing JWT tokens.
 * - **Google OAuth** — creating/linking accounts from Google profile data.
 * - **Profile retrieval** — fetching user data (excluding sensitive fields).
 * - **Password reset** — generating, validating, and consuming reset tokens.
 */
@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly emailService: EmailService,
    ) { }

    // ──────────────────────────────────────────────
    // Registration & Login
    // ──────────────────────────────────────────────

    /**
     * Registers a new user with email and password (local auth).
     *
     * Steps:
     * 1. Checks if the email is already taken.
     * 2. Hashes the password with bcrypt.
     * 3. Creates and saves the new user record.
     * 4. Returns the signed JWT tokens.
     *
     * @param registerDto - The registration data (name, email, password).
     * @returns An {@link AuthResponse} with the user object and access token.
     * @throws ConflictException if the email is already registered.
     */
    async register(registerDto: RegisterDto): Promise<AuthResponse> {
        const { email, password, name } = registerDto;

        // Check if a user with this email already exists.
        const existingUser = await this.userRepository.findOne({
            where: { email },
        });

        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        // Hash the plain-text password before storing it.
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // Create the user entity and persist it to the database.
        const user = this.userRepository.create({
            email,
            name,
            password: hashedPassword,
            provider: AuthProvider.LOCAL,
        });

        await this.userRepository.save(user);

        // Generate and return JWT tokens for the newly registered user.
        return this.generateAuthResponse(user);
    }

    /**
     * Registers a new guest user with a display name.
     *
     * @param registerDto - The guest registration data (name, optional phone).
     * @returns An AuthResponse with the guest user object and access token.
     */
    async registerGuest(registerDto: GuestRegisterDto): Promise<AuthResponse> {
        const { name } = registerDto;
        const uuid = crypto.randomUUID();
        // Generate a unique email placeholder since email is unique and required in the DB schema
        const email = `guest_${uuid}@qline.guest`;

        const user = this.userRepository.create({
            email,
            name,
            password: null,
            provider: AuthProvider.GUEST,
        });

        const savedUser = await this.userRepository.save(user);

        return this.generateAuthResponse(savedUser);
    }

    /**
     * Validates a user's email and password combination.
     *
     * Used internally by the {@link LocalStrategy} during the login flow.
     *
     * @param email    - The email address to look up.
     * @param password - The plain-text password to compare against the stored hash.
     * @returns The {@link User} entity if credentials are valid, or `null` if not.
     */
    async validateUser(email: string, password: string): Promise<User | null> {
        const user = await this.userRepository.findOne({ where: { email } });

        // If no user found or user has no password (Google-only account), return null.
        if (!user || !user.password) {
            return null;
        }

        // Compare the provided password with the stored bcrypt hash.
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return null;
        }

        return user;
    }

    /**
     * Generates JWT tokens for an authenticated user (local login).
     *
     * Called after the {@link LocalAuthGuard} successfully validates credentials.
     *
     * @param user - The authenticated user entity (attached to `req.user` by Passport).
     * @returns An {@link AuthResponse} with the user object and access token.
     */
    async login(user: User): Promise<AuthResponse> {
        return this.generateAuthResponse(user);
    }

    // ──────────────────────────────────────────────
    // Google OAuth
    // ──────────────────────────────────────────────

    /**
     * Finds or creates a user account based on Google OAuth profile data.
     *
     * Handles three scenarios:
     * 1. **Existing Google user** — returns the user as-is.
     * 2. **Existing local user** — links the Google account to the existing record.
     * 3. **New user** — creates a new user with Google credentials (no password).
     *
     * @param googleUserData - Profile data extracted from the Google OAuth response.
     * @returns The found or newly created {@link User} entity.
     */
    async validateGoogleUser(googleUserData: GoogleUserData): Promise<User> {
        const { googleId, email, name, avatar } = googleUserData;

        // Scenario 1: User already has a linked Google account.
        let user = await this.userRepository.findOne({ where: { googleId } });

        if (user) {
            return user;
        }

        // Scenario 2: A user with this email exists but hasn't linked Google yet.
        user = await this.userRepository.findOne({ where: { email } });

        if (user) {
            // Link the Google account to the existing user record.
            user.googleId = googleId;
            user.provider = AuthProvider.GOOGLE;
            if (avatar) user.avatar = avatar;
            await this.userRepository.save(user);
            return user;
        }

        // Scenario 3: No existing user — create a brand new account.
        user = this.userRepository.create({
            email,
            name,
            googleId,
            avatar,
            provider: AuthProvider.GOOGLE,
        });

        await this.userRepository.save(user);
        return user;
    }

    /**
     * Generates JWT tokens for a Google-authenticated user.
     *
     * Called after {@link GoogleStrategy.validate} successfully finds/creates a user.
     *
     * @param user - The authenticated Google user entity.
     * @returns An {@link AuthResponse} with the user object and access token.
     */
    async googleLogin(user: User): Promise<AuthResponse> {
        return this.generateAuthResponse(user);
    }

    // ──────────────────────────────────────────────
    // Profile
    // ──────────────────────────────────────────────

    /**
     * Retrieves a user's profile by their ID, excluding the password hash.
     *
     * @param userId - The database ID of the user to fetch.
     * @returns The user entity without the `password` field.
     * @throws UnauthorizedException if the user is not found.
     */
    async getProfile(userId: number): Promise<Omit<User, 'password'>> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Destructure to remove the password hash from the response.
        const { password, ...safeUser } = user;
        return safeUser as User;
    }

    // ──────────────────────────────────────────────
    // Password Reset
    // ──────────────────────────────────────────────

    /**
     * Initiates a password-reset flow by generating a reset token and sending it via email.
     *
     * For security, this method always returns a success message regardless of whether
     * the email exists in the database (prevents user enumeration attacks).
     *
     * Steps:
     * 1. Looks up the user by email.
     * 2. Generates a random 32-byte token and hashes it with bcrypt.
     * 3. Stores the hashed token and expiry timestamp on the user record.
     * 4. Sends the un-hashed token to the user's email.
     *
     * @param email - The email address requesting a password reset.
     * @returns A generic success message.
     */
    async requestPasswordReset(email: string): Promise<{ message: string }> {
        const user = await this.userRepository.findOne({ where: { email } });

        // Always return a generic message to prevent user enumeration.
        if (!user) {
            return {
                message:
                    'If an account with that email exists, a password reset link has been sent.',
            };
        }

        // Generate a cryptographically secure random reset token.
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(resetToken, BCRYPT_SALT_ROUNDS);

        // Store the hashed token and set the expiration to 1 hour from now.
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

        await this.userRepository.save(user);

        // Send the un-hashed token to the user via email.
        await this.emailService.sendPasswordResetEmail(email, resetToken);

        return {
            message:
                'If an account with that email exists, a password reset link has been sent.',
        };
    }

    /**
     * Validates a password-reset token by finding users with non-expired tokens
     * and comparing the provided token against each stored hash.
     *
     * @param token - The plain-text reset token received from the user's email link.
     * @returns The {@link User} entity that matches the token.
     * @throws BadRequestException if the token is invalid or expired.
     */
    async validateResetToken(token: string): Promise<User> {
        // Find all users whose reset tokens haven't expired yet.
        const users = await this.userRepository
            .createQueryBuilder('user')
            .where('user.resetPasswordToken IS NOT NULL')
            .andWhere('user.resetPasswordExpires > :now', { now: new Date() })
            .getMany();

        // Compare the provided token against each user's hashed token.
        for (const user of users) {
            const isValidToken = await bcrypt.compare(
                token,
                user.resetPasswordToken!,
            );
            if (isValidToken) {
                return user;
            }
        }

        throw new BadRequestException('Invalid or expired password reset token');
    }

    /**
     * Resets a user's password using a valid reset token.
     *
     * Steps:
     * 1. Validates the reset token via {@link validateResetToken}.
     * 2. Hashes the new password with bcrypt.
     * 3. Updates the user's password and clears the reset token fields.
     *
     * @param token       - The plain-text reset token from the email link.
     * @param newPassword - The new password to set on the account.
     * @returns A success message confirming the password has been reset.
     */
    async resetPassword(
        token: string,
        newPassword: string,
    ): Promise<{ message: string }> {
        const user = await this.validateResetToken(token);

        // Hash the new password before storing it.
        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

        // Update the password and clear the reset token fields.
        user.password = hashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;

        await this.userRepository.save(user);

        return { message: 'Password has been reset successfully' };
    }

    // ──────────────────────────────────────────────
    // Private Helpers
    // ──────────────────────────────────────────────

    /**
     * Builds the standard authentication response containing a safe user object
     * and a signed JWT access token.
     *
     * The JWT payload contains `sub` (user ID) and `email`.
     *
     * @param user - The authenticated user entity.
     * @returns An {@link AuthResponse} with user data and a signed access token.
     */
    private generateAuthResponse(user: User): AuthResponse {
        const payload = { sub: user.id, email: user.email };

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                provider: user.provider,
            },
            accessToken: this.jwtService.sign(payload),
        };
    }
}
