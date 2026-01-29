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
import { RegisterDto } from './dto';
import { EmailService } from '../email/email.service';

interface GoogleUserData {
    googleId: string;
    email: string;
    name: string;
    avatar?: string;
}

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private jwtService: JwtService,
        private emailService: EmailService,
    ) { }

    async register(registerDto: RegisterDto) {
        const { email, password, name } = registerDto;

        // Check if user already exists
        const existingUser = await this.userRepository.findOne({
            where: { email },
        });

        if (existingUser) {
            throw new ConflictException('Email already registered');
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user
        const user = this.userRepository.create({
            email,
            name,
            password: hashedPassword,
            provider: AuthProvider.LOCAL,
        });

        await this.userRepository.save(user);

        // Return tokens
        return this.generateTokens(user);
    }

    async validateUser(email: string, password: string): Promise<User | null> {
        const user = await this.userRepository.findOne({ where: { email } });

        if (!user || !user.password) {
            return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return null;
        }

        return user;
    }

    async login(user: User) {
        return this.generateTokens(user);
    }

    async validateGoogleUser(googleUserData: GoogleUserData): Promise<User> {
        const { googleId, email, name, avatar } = googleUserData;

        // Check if user exists with this Google ID
        let user = await this.userRepository.findOne({ where: { googleId } });

        if (user) {
            return user;
        }

        // Check if user exists with this email (maybe registered locally)
        user = await this.userRepository.findOne({ where: { email } });

        if (user) {
            // Link Google account to existing user
            user.googleId = googleId;
            user.provider = AuthProvider.GOOGLE;
            if (avatar) user.avatar = avatar;
            await this.userRepository.save(user);
            return user;
        }

        // Create new user with Google account
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

    async googleLogin(user: User) {
        return this.generateTokens(user);
    }

    async getProfile(userId: number): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id: userId } });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // Remove password from response
        const { password, ...result } = user;
        return result as User;
    }

    private generateTokens(user: User) {
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

    async requestPasswordReset(email: string) {
        const user = await this.userRepository.findOne({ where: { email } });

        // For security, always return success even if email doesn't exist
        if (!user) {
            return { message: 'If an account with that email exists, a password reset link has been sent.' };
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(resetToken, 10);

        // Set token and expiration (1 hour from now)
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

        await this.userRepository.save(user);

        // Send email
        await this.emailService.sendPasswordResetEmail(email, resetToken);

        return { message: 'If an account with that email exists, a password reset link has been sent.' };
    }

    async validateResetToken(token: string): Promise<User> {
        // Find users with non-expired tokens
        const users = await this.userRepository
            .createQueryBuilder('user')
            .where('user.resetPasswordToken IS NOT NULL')
            .andWhere('user.resetPasswordExpires > :now', { now: new Date() })
            .getMany();

        // Check if token matches any user
        for (const user of users) {
            const isValidToken = await bcrypt.compare(token, user.resetPasswordToken!);
            if (isValidToken) {
                return user;
            }
        }

        throw new BadRequestException('Invalid or expired password reset token');
    }

    async resetPassword(token: string, newPassword: string) {
        const user = await this.validateResetToken(token);

        // Hash new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password and clear reset token fields
        user.password = hashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;

        await this.userRepository.save(user);

        return { message: 'Password has been reset successfully' };
    }
}
