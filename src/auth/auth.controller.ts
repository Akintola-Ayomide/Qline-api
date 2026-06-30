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
  Patch,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto, GuestRegisterDto, ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto, UpdateProfileDto } from './dto';
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
 * | Method | Route                        | Description                        | Auth Required |
 * |--------|------------------------------|------------------------------------|---------------|
 * | POST   | `/auth/send-verification`    | Send OTP to email (step 1 signup)  | No            |
 * | POST   | `/auth/verify-email`         | Verify OTP & create account        | No            |
 * | POST   | `/auth/login`                | Login with email & password        | No            |
 * | POST   | `/auth/logout`               | Clear the auth cookie              | No            |
 * | POST   | `/auth/guest`                | Register as a guest user           | No            |
 * | GET    | `/auth/google`               | Redirect to Google OAuth           | No            |
 * | GET    | `/auth/google/callback`      | Handle Google OAuth callback       | No            |
 * | GET    | `/auth/profile`              | Get the logged-in user's profile   | Yes (JWT)     |
 * | GET    | `/auth/me`                   | Alias for `/auth/profile`          | Yes (JWT)     |
 * | POST   | `/auth/forgot-password`      | Request a password reset email     | No            |
 * | POST   | `/auth/reset-password`       | Reset password using a token       | No            |
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Step 1 of the signup flow.
   *
   * Generates a 6-digit OTP, saves a hashed copy to the (unverified) user record,
   * and emails the plain-text code to the provided address.
   *
   * @param body - JSON body containing the `email` field.
   * @returns A generic success message.
   */
  @Post('send-verification')
  async sendVerification(@Body() body: { email: string }) {
    return this.authService.sendVerificationCode(body.email);
  }

  /**
   * Step 2 of the signup flow.
   *
   * Validates the OTP, completes the user record, and returns a JWT token
   * so the frontend can log the user in immediately after verification.
   *
   * @param verifyEmailDto - Contains email, code, name, and password.
   * @param res            - The Express response object (used to set the cookie).
   * @returns The auth response containing user data and the access token.
   */
  @Post('verify-email')
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Res({ passthrough: true }) res,
  ) {
    const result = await this.authService.verifyAndRegister(verifyEmailDto);
    res.cookie('token', result.accessToken, TOKEN_COOKIE_OPTIONS);
    return result;
  }

  /**
   * Registers a new guest user.
   *
   * On success, sets an HTTP-only JWT cookie and returns the user data + access token.
   *
   * @param guestRegisterDto - The validated guest registration data from the request body.
   * @param res              - The Express response object (used to set the cookie).
   * @returns The auth response containing user data and the access token.
   */
  @Post('guest')
  async guest(@Body() guestRegisterDto: GuestRegisterDto, @Res({ passthrough: true }) res) {
    const result = await this.authService.registerGuest(guestRegisterDto);

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
   * Sets both an HttpOnly cookie (for same-domain / dev scenarios) AND appends
   * the JWT as a `?token=` query parameter in the redirect URL.
   *
   * Why the query param?
   * In production, the backend and frontend are often on different domains
   * (e.g. api.example.com vs app.example.com). The HttpOnly cookie is scoped
   * to the backend domain and is therefore invisible to the frontend. Passing
   * the token in the URL lets the frontend JavaScript read it, store it in
   * localStorage, and use it as a Bearer token on subsequent API calls.
   *
   * The frontend callback page immediately removes the token from the URL
   * (via history.replaceState) so it is not stored in the browser history.
   *
   * @param req - The Express request (contains `req.user` set by GoogleAuthGuard).
   * @param res - The Express response (used to set cookie and redirect).
   */
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  async googleAuthCallback(@Req() req, @Res() res) {
    const result = await this.authService.googleLogin(req.user);

    // Set the JWT as an HttpOnly cookie — works for same-domain setups.
    res.cookie('token', result.accessToken, TOKEN_COOKIE_OPTIONS);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl && process.env.NODE_ENV === 'production') {
      throw new Error('FRONTEND_URL is not defined in environment variables');
    }
    const resolvedFrontendUrl = frontendUrl || DEV_FRONTEND_URL;

    // Handle mobile deep-link redirects from state param.
    if (req.query.state) {
      try {
        const state = JSON.parse(req.query.state as string);
        if (state.redirectUri) {
          if (
            state.redirectUri.startsWith('appfrontend://') ||
            state.redirectUri.startsWith('exp://')
          ) {
            // Mobile: pass token in URL (can't use cookies across apps).
            return res.redirect(`${state.redirectUri}?token=${result.accessToken}`);
          }
          // Custom web redirect: append token for cross-domain safety.
          const url = new URL(state.redirectUri);
          url.searchParams.set('token', result.accessToken);
          return res.redirect(url.toString());
        }
      } catch {
        // State parse failed — fall through to default redirect.
      }
    }

    // Default: redirect to the frontend auth callback page WITH the token in the URL.
    // The frontend JS will read it, store it, and then remove it from the URL.
    res.redirect(`${resolvedFrontendUrl}/auth/callback?token=${result.accessToken}`);
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
   * Updates the authenticated user's profile metadata (name, avatar).
   *
   * @param req - The Express request (contains `req.user` set by JwtAuthGuard).
   * @param updateProfileDto - The validated profile metadata to update.
   * @returns The updated user profile (excluding the password hash).
   */
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Req() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, updateProfileDto);
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
