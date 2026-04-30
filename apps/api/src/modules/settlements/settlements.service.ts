import { Injectable } from '@nestjs/common';
import { SettlementsRepository } from './settlements.repository';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@Injectable()
export class SettlementsService {
  constructor(private readonly repo: SettlementsRepository) {}

  async create(data: CreateSettlementDto) {
    return this.repo.create(data);
  }

  async findByReceivable(receivableId: string) {
    return this.repo.findByReceivable(receivableId);
  }
}
