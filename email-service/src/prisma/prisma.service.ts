import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    // Wire Prisma query/error events → Winston
    (this as any).$on('error', (e: any) => {
      this.logger.error(`Prisma error: ${e.message}`, e.target, 'PrismaService');
    });

    (this as any).$on('warn', (e: any) => {
      this.logger.warn(`Prisma warn: ${e.message}`, 'PrismaService');
    });

    await this.$connect();
    this.logger.log('Database connected', 'PrismaService');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected', 'PrismaService');
  }

  // Utility for clean test teardown
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') return;
    const models = Reflect.ownKeys(this).filter((k) => typeof k === 'string' && k[0] !== '_');
    await Promise.all(models.map((m) => (this as any)[m].deleteMany()));
  }
}
