import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MAIL_QUEUE } from '../common/constants/queue.constant';
import { MailService }   from './mail.service';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [
    // ── BullMQ queue ─────────────────────────────────────────
    BullModule.registerQueue({ name: MAIL_QUEUE }),

    // ── Nodemailer + Handlebars via @nestjs-modules/mailer ──
    MailerModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host:   config.get<string>('mail.host'),
          port:   config.get<number>('mail.port'),
          secure: config.get<boolean>('mail.secure'),
          auth: {
            user: config.get<string>('mail.auth.user'),
            pass: config.get<string>('mail.auth.pass'),
          },
          pool:                true,
          maxConnections:      5,
          rateDelta:           1_000,
          rateLimit:           10,
          connectionTimeout:   10_000,
          greetingTimeout:     10_000,
          socketTimeout:       15_000,
        },
        defaults: {
          from: `"${config.get<string>('mail.fromName')}" <${config.get<string>('mail.fromAddress')}>`,
        },
        template: {
          dir:     join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(undefined, {
            inlineCssEnabled: true,
          }),
          options: { strict: true },
        },
        preview: config.get<string>('app.nodeEnv') === 'development',
      }),
    }),
  ],
  providers: [MailService, MailProcessor],
  exports:   [MailService, BullModule],
})
export class MailModule {}
