import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';

@Injectable()
export class ReceivablesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateReceivableDto) {
    return this.prisma.receivable.create({
      data: {
        userId: data.userId,
        value: data.value,
        type: data.type,
        debtorName: data.debtorName,
        debtorDocument: data.debtorDocument,
        dueDate: new Date(data.dueDate),
      },
    });
  }

  async findAll() {
    return this.prisma.receivable.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    return this.prisma.receivable.findUnique({ where: { id } });
  }
}
