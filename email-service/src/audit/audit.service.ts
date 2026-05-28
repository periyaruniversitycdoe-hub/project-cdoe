import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActionType } from '../common/constants/audit-actions.constant';

export interface CreateAuditLogInput {
  action:    AuditActionType;
  userId?:   string;
  email?:    string;
  ipAddress?: string;
  userAgent?: string;
  metadata?:  Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async log(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action:    input.action,
          userId:    input.userId,
          email:     input.email,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          metadata:  (input.metadata ?? {}) as any,
        },
      });

      this.logger.log(
        `AUDIT | ${input.action} | user=${input.userId ?? 'anon'} | email=${input.email ?? '-'} | ip=${input.ipAddress ?? '-'}`,
        'AuditService',
      );
    } catch (err) {
      // Audit failures must never crash the main flow
      this.logger.error(
        `Failed to write audit log for action ${input.action}: ${(err as Error).message}`,
        'AuditService',
      );
    }
  }
}
