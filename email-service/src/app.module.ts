import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { WinstonModule } from 'nest-winston';

// Config
import appConfig  from './config/app.config';
import mailConfig from './config/mail.config';
import jwtConfig  from './config/jwt.config';
import redisConfig from './config/redis.config';

// Common
import { createWinstonOptions }  from './common/logger/winston.logger';
import { AllExceptionsFilter }   from './common/filters/all-exceptions.filter';

// Feature modules
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule }  from './audit/audit.module';
import { MailModule }   from './mail/mail.module';
import { UsersModule }  from './users/users.module';
import { AuthModule }   from './auth/auth.module';

@Module({
  imports: [
    // ── Environment config ────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal:    true,
      load:        [appConfig, mailConfig, jwtConfig, redisConfig],
      envFilePath: ['.env', '.env.local'],
      cache:       true,
    }),

    // ── Structured logging ────────────────────────────────────
    WinstonModule.forRoot(createWinstonOptions()),

    // ── Rate limiting (applied globally via ThrottlerGuard) ───
    ThrottlerModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl:   config.get<number>('THROTTLE_TTL', 60) * 1_000,
            limit: config.get<number>('THROTTLE_LIMIT', 10),
          },
        ],
      }),
    }),

    // ── BullMQ (Redis-backed queue for background jobs) ───────
    BullModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host:     config.get<string>('redis.host',     '127.0.0.1'),
          port:     config.get<number>('redis.port',     6379),
          password: config.get<string>('redis.password') || undefined,
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff:  { type: 'exponential', delay: 5_000 },
        },
      }),
    }),

    // ── Feature modules ───────────────────────────────────────
    PrismaModule,
    AuditModule,
    MailModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    // Apply throttler guard globally
    { provide: APP_GUARD,  useClass: ThrottlerGuard },
    // Apply exception filter globally (needs Winston injected)
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
