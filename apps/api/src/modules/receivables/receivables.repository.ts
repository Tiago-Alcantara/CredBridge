import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';

@Injectable()
export class ReceivablesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: CreateReceivableDto) {
    return this.prisma.receivable.create({
      data: {
        userId,
        value: data.value,
        type: data.type,
        debtorName: data.debtorName,
        debtorDocument: data.debtorDocument,
        dueDate: new Date(data.dueDate),
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.receivable.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.receivable.findUnique({ where: { id } });
  }

  async findPool(limit = 50) {
    return this.prisma.receivable.findMany({
      where: {
        status: 'active',
        investment: null,
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });
  }

  async updateStatus(id: string, status: string, txHash?: string) {
    return this.prisma.receivable.update({
      where: { id },
      data: { status, ...(txHash ? { txHash } : {}) },
    });
  }

  async setTokenized(id: string, txHash: string) {
    return this.prisma.receivable.update({
      where: { id },
      data: { status: 'tokenized', txHash },
    });
  }

  async setAssignmentPending(id: string) {
    return this.prisma.receivable.update({
      where: { id },
      data: { status: 'assignment_pending' },
    });
  }

  async setActive(id: string) {
    return this.prisma.receivable.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async setPaymentTxHash(id: string, paymentTxHash: string) {
    return this.prisma.receivable.update({
      where: { id },
      data: { paymentTxHash },
    });
  }

  async getPoolStats() {
    const [active, validated, totalAgg] = await Promise.all([
      this.prisma.receivable.count({
        where: { status: 'active', investment: null },
      }),
      this.prisma.receivable.count({
        where: {
          status: { in: ['validated', 'tokenized', 'assignment_pending'] },
          investment: null,
        },
      }),
      this.prisma.receivable.aggregate({
        where: {
          status: 'active',
          investment: null,
        },
        _sum: { value: true },
      }),
    ]);
    return {
      totalValue: totalAgg._sum.value ?? 0,
      activeCount: active,
      validatedCount: validated,
      poolCount: active + validated,
    };
  }

  async findUserStellarWallet(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { privyStellarWalletAddress: true },
    });
  }
}
