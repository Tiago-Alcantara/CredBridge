import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@Injectable()
export class SettlementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSettlementDto) {
    return this.prisma.settlement.create({ data });
  }

  async findAll() {
    return this.prisma.settlement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findByReceivable(receivableId: string) {
    return this.prisma.settlement.findMany({ where: { receivableId } });
  }
}
