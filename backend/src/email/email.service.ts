import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendAlert(subject: string, message: string) {
    try {
      if (process.env.SMTP_PASS === 'GANTI_DENGAN_APP_PASSWORD_GMAIL') {
        this.logger.warn(`Email alert skipped (App password not configured): ${subject}`);
        return;
      }
      
      const adminEmail = process.env.SMTP_USER || 'a.gaul0812@gmail.com';
      
      await this.transporter.sendMail({
        from: `"Ngemiloh POS Alert" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        subject: `[ALERT] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ff4444; border-radius: 8px;">
            <h2 style="color: #ff4444;">Ngemiloh POS - Security Alert</h2>
            <p><strong>Waktu:</strong> ${new Date().toLocaleString('id-ID')}</p>
            <p style="font-size: 16px;">${message}</p>
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
      if (process.env.SMTP_PASS === 'GANTI_DENGAN_APP_PASSWORD_GMAIL') {
        this.logger.warn(`Reminder email skipped (App password not configured): ${subject}`);
        return;
      }
      
      const adminEmail = process.env.SMTP_USER || 'a.gaul0812@gmail.com';
      
      await this.transporter.sendMail({
        from: `"Ngemiloh POS Reminder" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        subject: `[REMINDER] ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #4f46e5; border-radius: 8px;">
            <h2 style="color: #4f46e5;">Ngemiloh POS - System Reminder</h2>
            <p><strong>Waktu:</strong> ${new Date().toLocaleString('id-ID')}</p>
            <p style="font-size: 16px;">${message}</p>
          </div>
        `,
      });
      this.logger.log(`Reminder email sent: ${subject}`);
    } catch (error) {
      this.logger.error('Failed to send reminder email', error);
    }
  }
}
