import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor(private configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
            port: this.configService.get<number>('SMTP_PORT', 587),
            secure: false, // true for 465, false for other ports
            auth: {
                user: this.configService.get<string>('SMTP_USER'),
                pass: this.configService.get<string>('SMTP_PASS'),
            },
        });
    }

    async sendPasswordResetEmail(email: string, resetToken: string) {
        const frontendUrl = this.configService.get<string>(
            'FRONTEND_URL',
            'http://localhost:3000',
        );
        const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: this.configService.get<string>('EMAIL_FROM', 'noreply@qline.com'),
            to: email,
            subject: 'Password Reset Request - Qline',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 32px;">
              <span style="font-family: 'Georgia', serif; font-style: italic; font-weight: 800;">Q</span>line
            </h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
            
            <p style="color: #64748b; font-size: 16px;">
              We received a request to reset your password for your Qline account. Click the button below to set a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; margin-bottom: 10px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="color: #3b82f6; font-size: 14px; word-break: break-all;">
              ${resetUrl}
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 13px; margin: 5px 0;">
                This link will expire in <strong>1 hour</strong> for security reasons.
              </p>
              <p style="color: #94a3b8; font-size: 13px; margin: 5px 0;">
                If you didn't request a password reset, please ignore this email or contact support if you have concerns.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} Qline, Inc. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
            text: `
        Password Reset Request - Qline
        
        We received a request to reset your password. Click the link below to reset your password:
        
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request a password reset, please ignore this email.
        
        © ${new Date().getFullYear()} Qline, Inc.
      `,
        };

        await this.transporter.sendMail(mailOptions);
    }
}
