import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../../email/email.service';

export interface EmailJobData {
  type: 'alert' | 'reminder' | 'otp' | 'custom';
  subject: string;
  message: string;
  recipientEmail?: string;
  otpCode?: string;
}

@Processor('SEND_EMAIL')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(`Processing email job ${job.id} - type: ${job.data.type}`);

    try {
      switch (job.data.type) {
        case 'alert':
          await this.emailService.sendAlert(job.data.subject, job.data.message);
          break;

        case 'reminder':
          await this.emailService.sendReminder(
            job.data.subject,
            job.data.message,
          );
          break;

        case 'otp':
          if (!job.data.recipientEmail || !job.data.otpCode) {
            throw new Error('Missing recipientEmail or otpCode for OTP email');
          }
          await this.emailService.sendOtp(
            job.data.recipientEmail,
            job.data.otpCode,
          );
          break;

        case 'custom':
          // For custom emails, we'd need a more flexible email service
          this.logger.warn('Custom email type not fully implemented yet');
          break;

        default:
          // TypeScript exhaustive check guarantees job.data.type is never here
          // Cast needed for logging purposes only
          this.logger.warn(`Unknown email type: ${String(job.data.type)}`);
      }

      this.logger.log(`Email job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Email job ${job.id} failed: ${error.message}`);
      throw error; // Re-throw to trigger BullMQ retry mechanism
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailJobData>) {
    this.logger.log(`Email job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJobData>, error: Error) {
    this.logger.error(
      `Email job ${job.id} failed with error: ${error.message}`,
    );
  }

  @OnWorkerEvent('active')
  onActive(job: Job<EmailJobData>) {
    this.logger.debug(`Email job ${job.id} is now active`);
  }
}
