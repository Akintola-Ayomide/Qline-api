import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto';
import { LocalAuthGuard, JwtAuthGuard, GoogleAuthGuard } from './guards';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res) {
    const result = await this.authService.register(registerDto);
    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return result;
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req, @Res({ passthrough: true }) res) {
    const result = await this.authService.login(req.user);
    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return result;
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleAuth() {
    // Guard redirects to Google
  }

  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthCallback(@Req() req, @Res() res) {
    const result = await this.authService.googleLogin(req.user);

    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    // Check for state to determine redirect
    if (req.query.state) {
      try {
        const state = JSON.parse(req.query.state as string);
        if (state.redirectUri) {
          // If it's a mobile deep link/scheme, append the token
          // Mobile apps usually need the token in the URL since they can't easily sync the cookie jar from the system browser
          if (state.redirectUri.startsWith('appfrontend://') || state.redirectUri.startsWith('exp://')) {
            return res.redirect(`${state.redirectUri}?token=${result.accessToken}`);
          }
          // Use the provided redirect uri (could be different web path)
          return res.redirect(`${state.redirectUri}`);
        }
      } catch (e) {
        // failed to parse state, ignore
      }
    }

    res.redirect(`${frontendUrl}/auth/callback`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req) {
    return this.authService.getProfile(req.user.id);
  }
  @Post('logout')
  async logout(@Res({ passthrough: true }) res) {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    return { message: 'Logged out successfully' };
  }
}
