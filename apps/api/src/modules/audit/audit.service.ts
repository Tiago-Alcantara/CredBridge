import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

export interface AuditLogInput {
  event: string;
  entityId: string;
  entityType: 'receivable' | 'document' | 'settlement' | 'user' | 'financial_authorization';
  userId: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    this.logger.log(`[${input.event}] entity=${input.entityId} user=${input.userId}`);
    await this.prisma.auditLog.create({
      data: {
        event: input.event,
        entityId: input.entityId,
        entityType: input.entityType,
        userId: input.userId,
        txHash: input.txHash,
        metadata: input.metadata !== undefined
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
  }

  async findByEntity(entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUser(userId: string, limit = 20) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
