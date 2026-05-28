import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, LoggerService } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MAIL_QUEUE, MailJobName } from '../common/constants/queue.constant';
import {
  WelcomeEmailJobData,
  VerificationEmailJobData,
} from './interfaces/mail-job.interface';

@Processor(MAIL_QUEUE, {
  concurrency: 5, // process up to 5 jobs simultaneously
})
export class MailProcessor extends WorkerHost {
  constructor(
    private readonly mailerService: MailerService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    super();
  }

  // ── Job Router ───────────────────────────────────────────────
  async process(job: Job): Promise<void> {
    this.logger.log(
      `Processing mail job [${job.name}] id=${job.id}`,
      'MailProcessor',
    );

    switch (job.name) {
      case MailJobName.SEND_WELCOME_EMAIL:
        return this.handleWelcomeEmail(job as Job<WelcomeEmailJobData>);

      case MailJobName.SEND_VERIFICATION_EMAIL:
        return this.handleVerificationEmail(
          job as Job<VerificationEmailJobData>,
        );

      default:
        this.logger.warn(`Unknown mail job: ${job.name}`, 'MailProcessor');
    }
  }

  // ── Welcome Email ────────────────────────────────────────────
  private async handleWelcomeEmail(
    job: Job<WelcomeEmailJobData>,
  ): Promise<void> {
    const { email, fullName } = job.data;

    await this.mailerService.sendMail({
      to:       email,
      subject:  'Welcome to Periyar University ERP — Your Account is Ready',
      template: 'welcome',
      context: {
        fullName,
        email,
        loginUrl:      `${process.env.FRONTEND_URL}/login`,
        supportEmail:  'support@periyaruniversity.ac.in',
        universityName: 'Periyar University',
        year:           new Date().getFullYear(),
      },
    });

    this.logger.log(`Welcome email sent → ${email}`, 'MailProcessor');
  }

  // ── Verification Email ───────────────────────────────────────
  private async handleVerificationEmail(
    job: Job<VerificationEmailJobData>,
  ): Promise<void> {
    const { email, fullName, verifyLink, expiresInHours } = job.data;

    await this.mailerService.sendMail({
      to:       email,
      subject:  'Verify Your Email — Periyar University ERP',
      template: 'verify-email',
      context: {
        fullName,
        verifyLink,
        expiresInHours,
        supportEmail:   'support@periyaruniversity.ac.in',
        universityName: 'Periyar University',
        year:            new Date().getFullYear(),
      },
    });

    this.logger.log(`Verification email sent → ${email}`, 'MailProcessor');
  }

  // ── Worker Events ────────────────────────────────────────────
  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(
      `Mail job completed [${job.name}] id=${job.id}`,
      'MailProcessor',
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Mail job failed [${job.name}] id=${job.id} attempt=${job.attemptsMade}: ${error.message}`,
      error.stack,
      'MailProcessor',
    );
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string): void {
    this.logger.warn(`Mail job stalled id=${jobId}`, 'MailProcessor');
  }
}
