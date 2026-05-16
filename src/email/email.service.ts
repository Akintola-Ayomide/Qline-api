/**
 * @file email.service.ts
 * @description Service responsible for sending transactional emails
 * using Nodemailer. Currently supports password-reset emails
 * with a branded HTML template.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Email service for sending transactional emails.
 *
 * Uses Nodemailer with SMTP credentials configured via environment variables:
 * - `SMTP_HOST` — SMTP server hostname (default: `smtp.gmail.com`).
 * - `SMTP_PORT` — SMTP server port (default: `587`).
 * - `SMTP_USER` — SMTP authentication username.
 * - `SMTP_PASS` — SMTP authentication password.
 * - `EMAIL_FROM` — Sender address for outgoing emails (default: `noreply@qline.com`).
 */
@Injectable()
export class EmailService {
  /** Nodemailer transport instance used to send emails. */
  private readonly transporter: nodemailer.Transporter;

  /**
   * Creates the Nodemailer transporter with SMTP settings from environment variables.
   *
   * @param configService - NestJS ConfigService for reading SMTP credentials.
   */
  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: false, // `true` for port 465 (SSL), `false` for port 587 (STARTTLS).
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Sends a password-reset email to the specified address.
   *
   * The email includes:
   * - A branded HTML template with the Qline logo and a "Reset Password" button.
   * - A plain-text fallback for email clients that don't support HTML.
   * - The reset link expires in 1 hour (as configured in {@link AuthService}).
   *
   * @param email      - The recipient's email address.
   * @param resetToken - The plain-text reset token to include in the reset URL.
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FRONTEND_URL is not defined in environment variables');
      }
      console.warn('FRONTEND_URL not set, falling back to http://localhost:3000');
    }
    const resolvedUrl = frontendUrl || 'http://localhost:3000';
    const resetUrl = `${resolvedUrl}/auth/reset-password?token=${resetToken}`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get<string>(
        'EMAIL_FROM',
        'noreply@qline.com',
      ),
      to: email,
      subject: 'Reset your Qline password',
      html: this.buildPasswordResetHtml(resolvedUrl, resetUrl),
      text: this.buildPasswordResetText(resetUrl),
    };

    await this.transporter.sendMail(mailOptions);
  }

  // ──────────────────────────────────────────────
  // Private Email Template Builders
  // ──────────────────────────────────────────────

  /**
   * Builds the HTML body for the password-reset email.
   *
   * @param frontendUrl - The base URL of the frontend (used for branding links).
   * @param resetUrl    - The full password-reset URL with the token.
   * @returns The complete HTML string for the email body.
   */
  private buildPasswordResetHtml(
    frontendUrl: string,
    resetUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">

          <!-- Header with Logo -->
          <div style="padding: 40px 0; text-align: center; border-bottom: 1px solid #f3f4f6;">
            <a href="${frontendUrl}" style="text-decoration: none; display: inline-block; vertical-align: middle;">
              <span style="font-family: serif; font-size: 48px; font-weight: 800; font-style: italic; color: #2563eb; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; padding-right: 4px;">Q</span><span style="font-family: sans-serif; font-size: 32px; font-weight: 700; color: #0f172a; letter-spacing: -0.025em;">line</span>
            </a>
          </div>

          <!-- Content -->
          <div style="padding: 40px 40px; color: #334155;">
            <h1 style="margin: 0 0 24px; font-size: 24px; font-weight: 700; color: #0f172a; text-align: center;">Reset Your Password</h1>

            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #475569; text-align: center;">
              We received a request to reset the password for your Qline account. If you made this request, please click the button below to secure your account.
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); border: 1px solid rgba(0,0,0,0.05);">
                Reset Password
              </a>
            </div>

            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #475569; text-align: center;">
              For security, this link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">

            <p style="margin: 0 0 12px; font-size: 14px; color: #64748b;">
              If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin: 0; font-size: 13px; word-break: break-all; font-family: 'Menlo', 'Monaco', 'Courier New', monospace;">
              <a href="${resetUrl}" style="color: #2563eb; text-decoration: underline;">${resetUrl}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 24px; background-color: #f8fafc; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 13px; color: #94a3b8;">
              &copy; ${new Date().getFullYear()} Qline. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Builds the plain-text fallback body for the password-reset email.
   *
   * @param resetUrl - The full password-reset URL with the token.
   * @returns The plain-text email body.
   */
  private buildPasswordResetText(resetUrl: string): string {
    return `
Reset your Qline password

We received a request to reset the password for your Qline account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Qline
    `.trim();
  }
}
