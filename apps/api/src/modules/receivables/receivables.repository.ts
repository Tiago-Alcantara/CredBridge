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
      where: { status: { in: ['validated', 'active'] } },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });
  }

  async getPoolStats() {
    const [active, validated, totalAgg] = await Promise.all([
      this.prisma.receivable.count({ where: { status: 'active' } }),
      this.prisma.receivable.count({ where: { status: 'validated' } }),
      this.prisma.receivable.aggregate({
        where: { status: { in: ['validated', 'active'] } },
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
}
