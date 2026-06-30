/**
 * @file email.service.ts
 * @description Service responsible for sending transactional emails
 * using Nodemailer. Supports password-reset and email-verification
 * emails with branded HTML templates.
 */

import { Injectable, Logger } from '@nestjs/common';
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

  private readonly logger = new Logger(EmailService.name);

  /**
   * Creates the Nodemailer transporter with SMTP settings from environment variables.
   * Verifies the connection on startup so misconfiguration is caught early.
   *
   * @param configService - NestJS ConfigService for reading SMTP credentials.
   */
  constructor(private readonly configService: ConfigService) {
    // NOTE: ConfigService always returns env vars as strings regardless of the
    // generic type parameter. We must explicitly parse the port as an integer.
    const smtpPort = parseInt(
      this.configService.get<string>('SMTP_PORT', '587'),
      10,
    );

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: smtpPort,
      secure: smtpPort === 465, // true for SSL (port 465), false for STARTTLS (port 587)
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      tls: {
        // Allow self-signed certs in dev; in production this should be true.
        rejectUnauthorized: this.configService.get<string>('NODE_ENV') === 'production',
      },
    });

    // Verify the SMTP connection on startup so issues surface immediately in logs.
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error(`SMTP connection failed: ${error.message}`, error.stack);
      } else {
        this.logger.log('SMTP server connection verified — ready to send emails.');
      }
    });
  }

  /**
   * Sends a password-reset email to the specified address.
   *
   * The email includes:
   * - A branded HTML template with the Flowgate logo and a "Reset Password" button.
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
      subject: 'Reset your Flowgate password',
      html: this.buildPasswordResetHtml(resolvedUrl, resetUrl),
      text: this.buildPasswordResetText(resetUrl),
    };

    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Sends a 6-digit email-verification OTP to the user during signup.
   *
   * @param email - The recipient's email address.
   * @param code  - The plain-text 6-digit OTP to display in the email.
   */
  async sendEmailVerificationCode(email: string, code: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get<string>('EMAIL_FROM', 'noreply@qline.com'),
      to: email,
      subject: 'Verify your Flowgate email',
      html: this.buildVerificationHtml(frontendUrl, code),
      text: this.buildVerificationText(code),
    };

    await this.transporter.sendMail(mailOptions);
  }

  // ──────────────────────────────────────────────
  // Queue Activity Notifications
  // ──────────────────────────────────────────────

  /**
   * Sends a queue-join confirmation email to the user.
   *
   * @param email         - The recipient's email address.
   * @param userName      - The user's display name.
   * @param queueName     - The name of the queue they joined.
   * @param position      - The user's assigned position number.
   * @param estimatedWait - Estimated wait time in minutes.
   */
  async sendQueueJoinConfirmation(
    email: string,
    userName: string,
    queueName: string,
    position: number,
    estimatedWait: number,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get<string>('EMAIL_FROM', 'noreply@qline.com'),
      to: email,
      subject: `You've joined the queue: ${queueName}`,
      html: this.buildQueueJoinHtml(frontendUrl, userName, queueName, position, estimatedWait),
      text: `Hi ${userName}, you joined "${queueName}" at position #${position}. Estimated wait: ~${estimatedWait} min.`,
    };
    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Sends an alert email when the user has 3 people ahead of them in the queue.
   *
   * @param email     - The recipient's email address.
   * @param userName  - The user's display name.
   * @param queueName - The name of the queue.
   */
  async sendPositionAlert(
    email: string,
    userName: string,
    queueName: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get<string>('EMAIL_FROM', 'noreply@qline.com'),
      to: email,
      subject: `Almost your turn in "${queueName}" — 3 people ahead`,
      html: this.buildPositionAlertHtml(frontendUrl, userName, queueName),
      text: `Hi ${userName}, only 3 people are ahead of you in "${queueName}". Get ready — your turn is coming soon!`,
    };
    await this.transporter.sendMail(mailOptions);
  }

  /**
   * Sends an alert email when the user has 5 minutes or less of estimated wait remaining.
   *
   * @param email         - The recipient's email address.
   * @param userName      - The user's display name.
   * @param queueName     - The name of the queue.
   * @param minutesLeft   - Estimated minutes remaining.
   */
  async sendWaitTimeAlert(
    email: string,
    userName: string,
    queueName: string,
    minutesLeft: number,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get<string>('EMAIL_FROM', 'noreply@qline.com'),
      to: email,
      subject: `Your turn in "${queueName}" is less than ${minutesLeft} min away!`,
      html: this.buildWaitTimeAlertHtml(frontendUrl, userName, queueName, minutesLeft),
      text: `Hi ${userName}, you have approximately ${minutesLeft} minute(s) left before your turn in "${queueName}". Please be ready!`,
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
        <title>Reset Your Password — Flowgate</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAFAF8; color: #1C1C1A; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 560px; margin: 40px auto; background-color: #ffffff; border: 1px solid #E5E4DF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(28, 28, 26, 0.03);">

          <!-- Header with Logo -->
          <div style="padding: 32px 40px; border-bottom: 1px solid #E5E4DF; background-color: #ffffff; text-align: left;">
            <a href="${frontendUrl}" style="text-decoration: none; display: inline-block;">
              <span style="font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 700; color: #0D9488; letter-spacing: -0.03em;">flow<span style="color: #1C1C1A;">gate</span></span>
            </a>
          </div>

          <!-- Content -->
          <div style="padding: 40px; background-color: #ffffff;">
            <h1 style="margin: 0 0 16px; font-family: 'DM Sans', sans-serif; font-size: 24px; font-weight: 700; color: #1C1C1A; tracking-tight: -0.02em;">Reset your password</h1>

            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #575752;">
              We received a request to reset the password for your Flowgate account. Click the button below to choose a new password.
            </p>

            <div style="margin: 32px 0;">
              <a href="${resetUrl}" style="display: inline-block; background-color: #0D9488; color: #ffffff; font-size: 12px; font-weight: 600; padding: 12px 28px; border-radius: 6px; text-decoration: none; border: 1px solid #0D9488; letter-spacing: 0.02em; text-transform: uppercase;">
                Reset Password
              </a>
            </div>

            <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #8A8A82;">
              For security, this link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
            </p>

            <div style="border-top: 1px solid #E5E4DF; margin: 32px 0; padding-top: 20px;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #8A8A82;">
                If the button above does not work, copy and paste this URL into your browser:
              </p>
              <p style="margin: 0; font-size: 13px; word-break: break-all; font-family: monospace; color: #0D9488;">
                <a href="${resetUrl}" style="color: #0D9488; text-decoration: underline;">${resetUrl}</a>
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 24px 40px; background-color: #F0EFEB; border-top: 1px solid #E5E4DF; text-align: left;">
            <p style="margin: 0; font-size: 12px; color: #8A8A82; font-weight: 500; letter-spacing: 0.01em;">
              &copy; ${new Date().getFullYear()} Flowgate. All rights reserved.
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
Reset your Flowgate password
===========================

We received a request to reset the password for your Flowgate account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Flowgate
    `.trim();
  }

  /**
   * Builds the HTML body for the email-verification OTP email.
   */
  private buildVerificationHtml(frontendUrl: string, code: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email — Flowgate</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAFAF8; color: #1C1C1A; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 560px; margin: 40px auto; background-color: #ffffff; border: 1px solid #E5E4DF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(28, 28, 26, 0.03);">

          <!-- Header with Logo -->
          <div style="padding: 32px 40px; border-bottom: 1px solid #E5E4DF; background-color: #ffffff; text-align: left;">
            <a href="${frontendUrl}" style="text-decoration: none; display: inline-block;">
              <span style="font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 700; color: #0D9488; letter-spacing: -0.03em;">flow<span style="color: #1C1C1A;">gate</span></span>
            </a>
          </div>

          <!-- Content -->
          <div style="padding: 40px; background-color: #ffffff;">
            <h1 style="margin: 0 0 16px; font-family: 'DM Sans', sans-serif; font-size: 24px; font-weight: 700; color: #1C1C1A; tracking-tight: -0.02em;">Verify your email</h1>

            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #575752;">
              Use the 6-digit verification code below to complete your Flowgate account setup. This code will expire in <strong>10 minutes</strong>.
            </p>

            <!-- OTP Box -->
            <div style="margin: 32px 0; text-align: left;">
              <div style="display: inline-block; background-color: #F0EFEB; border: 1px solid #E5E4DF; border-radius: 8px; padding: 16px 28px;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.15em; color: #0D9488;">${code}</span>
              </div>
            </div>

            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #8A8A82;">
              If you did not request this code, you can safely ignore this email.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 24px 40px; background-color: #F0EFEB; border-top: 1px solid #E5E4DF; text-align: left;">
            <p style="margin: 0; font-size: 12px; color: #8A8A82; font-weight: 500; letter-spacing: 0.01em;">
              &copy; ${new Date().getFullYear()} Flowgate. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Builds the plain-text fallback body for the email-verification OTP email.
   */
  private buildVerificationText(code: string): string {
    return `
Verify your Flowgate email
==========================

Your 6-digit verification code is: ${code}

This code expires in 10 minutes.

If you didn't create a Flowgate account, you can safely ignore this email.

© ${new Date().getFullYear()} Flowgate
    `.trim();
  }

  /**
   * Builds HTML for the queue-join confirmation email.
   */
  private buildQueueJoinHtml(
    frontendUrl: string,
    userName: string,
    queueName: string,
    position: number,
    estimatedWait: number,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Joined Queue — Flowgate</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAFAF8; color: #1C1C1A; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 560px; margin: 40px auto; background-color: #ffffff; border: 1px solid #E5E4DF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(28, 28, 26, 0.03);">

          <!-- Header with Logo -->
          <div style="padding: 32px 40px; border-bottom: 1px solid #E5E4DF; background-color: #ffffff; text-align: left;">
            <a href="${frontendUrl}" style="text-decoration: none; display: inline-block;">
              <span style="font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 700; color: #0D9488; letter-spacing: -0.03em;">flow<span style="color: #1C1C1A;">gate</span></span>
            </a>
          </div>

          <!-- Content -->
          <div style="padding: 40px; background-color: #ffffff;">
            <h1 style="margin: 0 0 8px; font-family: 'DM Sans', sans-serif; font-size: 24px; font-weight: 700; color: #1C1C1A; tracking-tight: -0.02em;">You're in the queue!</h1>
            <p style="margin: 0 0 32px; font-size: 15px; color: #575752;">Hi ${userName}, you have successfully joined <strong>${queueName}</strong>.</p>

            <table style="width: 100%; border-collapse: collapse; margin: 32px 0;">
              <tr>
                <td style="width: 50%; padding-right: 12px;">
                  <div style="background-color: #F0EFEB; border: 1px solid #E5E4DF; border-radius: 8px; padding: 20px; text-align: center;">
                    <div style="font-size: 36px; font-weight: 700; color: #0D9488; font-family: monospace;">#${position}</div>
                    <div style="font-size: 11px; font-weight: 700; color: #8A8A82; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;">Your Position</div>
                  </div>
                </td>
                <td style="width: 50%; padding-left: 12px;">
                  <div style="background-color: #F0EFEB; border: 1px solid #E5E4DF; border-radius: 8px; padding: 20px; text-align: center;">
                    <div style="font-size: 36px; font-weight: 700; color: #F59E0B; font-family: monospace;">~${estimatedWait}m</div>
                    <div style="font-size: 11px; font-weight: 700; color: #8A8A82; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;">Est. Wait Time</div>
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #575752;">
              We will notify you as your turn approaches. You can check your live ticket status anytime in the Flowgate app.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 24px 40px; background-color: #F0EFEB; border-top: 1px solid #E5E4DF; text-align: left;">
            <p style="margin: 0; font-size: 12px; color: #8A8A82; font-weight: 500; letter-spacing: 0.01em;">
              &copy; ${new Date().getFullYear()} Flowgate. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Builds HTML for the "3 people ahead" position alert email.
   */
  private buildPositionAlertHtml(
    frontendUrl: string,
    userName: string,
    queueName: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Almost Your Turn — Flowgate</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAFAF8; color: #1C1C1A; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 560px; margin: 40px auto; background-color: #ffffff; border: 1px solid #E5E4DF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(28, 28, 26, 0.03);">

          <!-- Header with Logo -->
          <div style="padding: 32px 40px; border-bottom: 1px solid #E5E4DF; background-color: #ffffff; text-align: left;">
            <a href="${frontendUrl}" style="text-decoration: none; display: inline-block;">
              <span style="font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 700; color: #0D9488; letter-spacing: -0.03em;">flow<span style="color: #1C1C1A;">gate</span></span>
            </a>
          </div>

          <!-- Content -->
          <div style="padding: 40px; background-color: #ffffff;">
            <div style="font-size: 40px; margin-bottom: 16px;">⏳</div>
            <h1 style="margin: 0 0 12px; font-family: 'DM Sans', sans-serif; font-size: 24px; font-weight: 700; color: #1C1C1A; tracking-tight: -0.02em;">Almost your turn!</h1>
            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #575752;">
              Hi ${userName}, there are only <strong>3 people</strong> ahead of you in <strong>${queueName}</strong>.
            </p>

            <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #B45309;">
                Get ready — your turn is coming very soon.
              </p>
            </div>

            <p style="margin: 0; font-size: 13px; color: #8A8A82;">
              Please make sure you are nearby and ready to be served.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 24px 40px; background-color: #F0EFEB; border-top: 1px solid #E5E4DF; text-align: left;">
            <p style="margin: 0; font-size: 12px; color: #8A8A82; font-weight: 500; letter-spacing: 0.01em;">
              &copy; ${new Date().getFullYear()} Flowgate. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Builds HTML for the "≤5 minutes remaining" wait-time alert email.
   */
  private buildWaitTimeAlertHtml(
    frontendUrl: string,
    userName: string,
    queueName: string,
    minutesLeft: number,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Turn Soon — Flowgate</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FAFAF8; color: #1C1C1A; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 560px; margin: 40px auto; background-color: #ffffff; border: 1px solid #E5E4DF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(28, 28, 26, 0.03);">

          <!-- Header with Logo -->
          <div style="padding: 32px 40px; border-bottom: 1px solid #E5E4DF; background-color: #ffffff; text-align: left;">
            <a href="${frontendUrl}" style="text-decoration: none; display: inline-block;">
              <span style="font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 700; color: #0D9488; letter-spacing: -0.03em;">flow<span style="color: #1C1C1A;">gate</span></span>
            </a>
          </div>

          <!-- Content -->
          <div style="padding: 40px; background-color: #ffffff;">
            <div style="font-size: 40px; margin-bottom: 16px;">🔔</div>
            <h1 style="margin: 0 0 12px; font-family: 'DM Sans', sans-serif; font-size: 24px; font-weight: 700; color: #1C1C1A; tracking-tight: -0.02em;">Your turn is coming!</h1>
            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #575752;">
              Hi ${userName}, you have approximately <strong>${minutesLeft} minute(s)</strong> left before your turn in <strong>${queueName}</strong>.
            </p>

            <div style="background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #991B1B;">
                Please be ready now!
              </p>
            </div>

            <p style="margin: 0; font-size: 13px; color: #8A8A82;">
              Missing your turn may result in losing your spot in the queue.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 24px 40px; background-color: #F0EFEB; border-top: 1px solid #E5E4DF; text-align: left;">
            <p style="margin: 0; font-size: 12px; color: #8A8A82; font-weight: 500; letter-spacing: 0.01em;">
              &copy; ${new Date().getFullYear()} Flowgate. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
