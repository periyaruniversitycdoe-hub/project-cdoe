import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MAIL_QUEUE, MailJobName } from '../common/constants/queue.constant';
import {
  WelcomeEmailJobData,
  VerificationEmailJobData,
} from './interfaces/mail-job.interface';

@Injectable()
export class MailService {
  constructor(
    @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  // ── Public API ───────────────────────────────────────────────

  async queueWelcomeEmail(data: WelcomeEmailJobData): Promise<void> {
    await this.mailQueue.add(MailJobName.SEND_WELCOME_EMAIL, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: 100,
      removeOnFail:     50,
    });
    this.logger.log(
      `Welcome email queued for ${data.email}`,
      'MailService',
    );
  }

  async queueVerificationEmail(data: VerificationEmailJobData): Promise<void> {
    await this.mailQueue.add(MailJobName.SEND_VERIFICATION_EMAIL, data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 3_000 },
      removeOnComplete: 100,
      removeOnFail:     50,
      // De-dupe: one active verification per user at a time
      jobId: `verify-${data.userId}`,
    });
    this.logger.log(
      `Verification email queued for ${data.email}`,
      'MailService',
    );
  }
}
