/**
 * @file auth.controller.ts
 * @description Controller handling all authentication-related HTTP endpoints.
 * Includes registration, login/logout, Google OAuth, profile retrieval,
 * and password reset flows.
 */

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
import { RegisterDto, ForgotPasswordDto, ResetPasswordDto } from './dto';
import { LocalAuthGuard, JwtAuthGuard, GoogleAuthGuard } from './guards';

/** Default frontend URL used for redirects during local development only. */
const DEV_FRONTEND_URL = 'http://localhost:3000';

/**
 * Shared cookie options for the JWT token cookie.
 * Extracted as a constant to avoid duplication across endpoints.
 */
const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

/**
 * Authentication controller.
 *
 * Exposes the following endpoints under the `/auth` prefix:
 *
 * | Method | Route                  | Description                        | Auth Required |
 * |--------|------------------------|------------------------------------|---------------|
 * | POST   | `/auth/register`       | Create a new user account          | No            |
 * | POST   | `/auth/login`          | Login with email & password        | No            |
 * | POST   | `/auth/logout`         | Clear the auth cookie              | No            |
 * | GET    | `/auth/google`         | Redirect to Google OAuth           | No            |
 * | GET    | `/auth/google/callback` | Handle Google OAuth callback      | No            |
 * | GET    | `/auth/profile`        | Get the logged-in user's profile   | Yes (JWT)     |
 * | GET    | `/auth/me`             | Alias for `/auth/profile`          | Yes (JWT)     |
 * | POST   | `/auth/forgot-password` | Request a password reset email    | No            |
 * | POST   | `/auth/reset-password` | Reset password using a token       | No            |
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Registers a new user with email, name, and password.
   *
   * On success, sets an HTTP-only JWT cookie and returns the user data + access token.
   *
   * @param registerDto - The validated registration data from the request body.
   * @param res         - The Express response object (used to set the cookie).
   * @returns The auth response containing user data and the access token.
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res) {
    const result = await this.authService.register(registerDto);

    // Set the JWT token as an HTTP-only cookie for secure, automatic auth on future requests.
    res.cookie('token', result.accessToken, TOKEN_COOKIE_OPTIONS);

    return result;
  }

  /**
   * Authenticates a user with email and password.
   *
   * The {@link LocalAuthGuard} validates credentials via Passport before this
   * handler is called. On success, sets an HTTP-only JWT cookie.
   *
   * @param req - The Express request object (contains `req.user` set by Passport).
   * @param res - The Express response object (used to set the cookie).
   * @returns The auth response containing user data and the access token.
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req, @Res({ passthrough: true }) res) {
    const result = await this.authService.login(req.user);

    // Set the JWT token as an HTTP-only cookie.
    res.cookie('token', result.accessToken, TOKEN_COOKIE_OPTIONS);

    return result;
  }

  /**
   * Initiates the Google OAuth 2.0 login flow.
   *
   * The {@link GoogleAuthGuard} redirects the user to Google's consent screen.
   * This handler body is intentionally empty — the guard handles the redirect.
   */
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  async googleAuth(): Promise<void> {
    // The GoogleAuthGuard handles the redirect to Google's OAuth consent screen.
    // This method body is intentionally left empty.
  }

  /**
   * Handles the callback from Google OAuth after the user grants consent.
   *
   * Sets the JWT cookie and redirects the user to the appropriate frontend URL.
   * Supports three redirect scenarios:
   * 1. **Mobile deep link** — If `state.redirectUri` starts with `appfrontend://` or `exp://`,
   *    the token is appended as a query parameter (mobile apps can't share cookies with the browser).
   * 2. **Custom web redirect** — If a `redirectUri` is provided in state, redirects there.
   * 3. **Default** — Redirects to `FRONTEND_URL/auth/callback`.
   *
   * @param req - The Express request (contains `req.user` and `req.query.state`).
   * @param res - The Express response (used to set cookie and redirect).
   */
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthCallback(@Req() req, @Res() res) {
    const result = await this.authService.googleLogin(req.user);

    // Set the JWT token as an HTTP-only cookie.
    res.cookie('token', result.accessToken, TOKEN_COOKIE_OPTIONS);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FRONTEND_URL is not defined in environment variables');
      }
      console.warn('FRONTEND_URL not set, falling back to dev default');
    }
    const resolvedFrontendUrl = frontendUrl || DEV_FRONTEND_URL;

    // Check if the OAuth state contains a custom redirect URI.
    if (req.query.state) {
      try {
        const state = JSON.parse(req.query.state as string);

        if (state.redirectUri) {
          // Mobile apps (Expo/React Native) need the token in the URL
          // because they can't share the browser's cookie jar.
          if (
            state.redirectUri.startsWith('appfrontend://') ||
            state.redirectUri.startsWith('exp://')
          ) {
            return res.redirect(
              `${state.redirectUri}?token=${result.accessToken}`,
            );
          }

          // Web redirect: cookie is already set, just redirect.
          return res.redirect(state.redirectUri);
        }
      } catch {
        // If state JSON parsing fails, fall through to the default redirect.
      }
    }

    // Default redirect to the web frontend's auth callback page.
    res.redirect(`${resolvedFrontendUrl}/auth/callback`);
  }

  /**
   * Returns the authenticated user's profile.
   *
   * Requires a valid JWT token (cookie or `Authorization` header).
   *
   * @param req - The Express request (contains `req.user` set by JwtAuthGuard).
   * @returns The user profile (excluding the password hash).
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Alias for `/auth/profile`. Returns the authenticated user's profile.
   *
   * This endpoint exists for frontend convenience — some clients expect
   * a `/me` endpoint for fetching the current user.
   *
   * @param req - The Express request (contains `req.user` set by JwtAuthGuard).
   * @returns The user profile (excluding the password hash).
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req) {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Logs out the user by clearing the JWT cookie.
   *
   * @param res - The Express response (used to clear the cookie).
   * @returns A success message confirming logout.
   */
  @Post('logout')
  async logout(@Res({ passthrough: true }) res) {
    // Clear the JWT cookie by setting it with the same options used to create it.
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Initiates a password-reset flow by sending a reset link to the user's email.
   *
   * For security, always returns a generic success message regardless of
   * whether the email exists in the database.
   *
   * @param forgotPasswordDto - Contains the email address requesting a reset.
   * @returns A generic success message.
   */
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(forgotPasswordDto.email);
  }

  /**
   * Resets a user's password using a valid reset token.
   *
   * The token is validated against the stored hashed token and expiry date.
   * On success, the password is updated and the reset token is cleared.
   *
   * @param resetPasswordDto - Contains the reset token and the new password.
   * @returns A success message confirming the password has been changed.
   */
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );
  }
}
