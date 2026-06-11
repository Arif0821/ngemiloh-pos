import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { escapeHtml, escapeHtmlForEmail } from '../common/utils/html';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    // Support both variable naming conventions
    const smtpUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const smtpPass = process.env.EMAIL_APP_PASSWORD || process.env.SMTP_PASS;

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  async sendAlert(subject: string, message: string) {
    try {
      const smtpPass = process.env.EMAIL_APP_PASSWORD || process.env.SMTP_PASS;
      if (smtpPass === 'GANTI_DENGAN_APP_PASSWORD_GMAIL' || !smtpPass) {
        this.logger.warn(
          `Email alert skipped (App password not configured): ${subject}`,
        );
        return;
      }

      // SECURITY: Require admin email to be configured in production
      const adminEmail = process.env.EMAIL_ALERT_TO || process.env.SMTP_USER;
      if (!adminEmail) {
        this.logger.warn(
          `Email alert skipped (no admin email configured): ${subject}`,
        );
        return;
      }
      const fromEmail = process.env.EMAIL_USER || process.env.SMTP_USER;

      // SECURITY: Escape HTML to prevent XSS in email
      const safeMessage = escapeHtmlForEmail(message);

      await this.transporter.sendMail({
        from: `"Ngemiloh POS Alert" <${fromEmail}>`,
        to: adminEmail,
        subject: `[ALERT] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ff4444; border-radius: 8px;">
            <h2 style="color: #ff4444;">Ngemiloh POS - Security Alert</h2>
            <p><strong>Waktu:</strong> ${new Date().toLocaleString('id-ID')}</p>
            <p style="font-size: 16px;">${safeMessage}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888;">Email ini di-*generate* otomatis oleh sistem Ngemiloh POS.</p>
          </div>
        `,
      });
      this.logger.log(`Alert email sent: ${subject}`);
    } catch (error) {
      this.logger.error('Failed to send email alert', error);
    }
  }

  async sendReminder(subject: string, message: string) {
    try {
      const smtpPass = process.env.EMAIL_APP_PASSWORD || process.env.SMTP_PASS;
      if (smtpPass === 'GANTI_DENGAN_APP_PASSWORD_GMAIL' || !smtpPass) {
        this.logger.warn(
          `Reminder email skipped (App password not configured): ${subject}`,
        );
        return;
      }

      // SECURITY: Require admin email to be configured in production
      const adminEmail = process.env.EMAIL_ALERT_TO || process.env.SMTP_USER;
      if (!adminEmail) {
        this.logger.warn(
          `Email alert skipped (no admin email configured): ${subject}`,
        );
        return;
      }
      const fromEmail = process.env.EMAIL_USER || process.env.SMTP_USER;

      // SECURITY: Escape HTML to prevent XSS in email
      const safeMessage = escapeHtmlForEmail(message);

      await this.transporter.sendMail({
        from: `"Ngemiloh POS Reminder" <${fromEmail}>`,
        to: adminEmail,
        subject: `[REMINDER] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #4f46e5; border-radius: 8px;">
            <h2 style="color: #4f46e5;">Ngemiloh POS - System Reminder</h2>
            <p><strong>Waktu:</strong> ${new Date().toLocaleString('id-ID')}</p>
            <p style="font-size: 16px;">${safeMessage}</p>
          </div>
        `,
      });
      this.logger.log(`Reminder email sent: ${subject}`);
    } catch (error) {
      this.logger.error('Failed to send reminder email', error);
    }
  }
}
