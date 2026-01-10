import {
    Injectable,
    ConflictException,
    UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, AuthProvider } from '../entities/user.entity';
import { RegisterDto } from './dto';

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
}
