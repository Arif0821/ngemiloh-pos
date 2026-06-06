import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.initDummyAccount();
  }

  private async initDummyAccount() {
    try {
      // Generate test SMTP service account from ethereal.email
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      this.logger.log(`Ethereal Email initialized. Test Account: ${testAccount.user}`);
    } catch (e) {
      this.logger.error('Failed to initialize Ethereal Email', e);
    }
  }

  async sendAlert(subject: string, htmlContent: string, to: string = 'superadmin@ngemiloh.com') {
    if (!this.transporter) {
      this.logger.warn(`Email system not ready. Attempted to send: ${subject}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: '"Ngemiloh POS Alert" <noreply@ngemiloh.com>',
        to,
        subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f43f5e; padding: 20px; color: white;">
              <h2 style="margin: 0;">POS Alert Notification</h2>
            </div>
            <div style="padding: 20px; background-color: #ffffff; color: #334155; line-height: 1.6;">
              ${htmlContent}
            </div>
            <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              This is an automated message from Ngemiloh POS System. Please do not reply.
            </div>
          </div>
        `,
      });

      this.logger.log(`Alert Email Sent: ${info.messageId}`);
      this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    } catch (e) {
      this.logger.error('Failed to send alert email', e);
    }
  }
}
