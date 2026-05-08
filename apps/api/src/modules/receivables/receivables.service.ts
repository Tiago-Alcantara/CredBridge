import { Injectable } from '@nestjs/common';
import { ReceivablesRepository } from './receivables.repository';
import { CreateReceivableDto } from './dto/create-receivable.dto';

@Injectable()
export class ReceivablesService {
  constructor(private readonly repo: ReceivablesRepository) {}

  async create(userId: string, data: CreateReceivableDto) {
    return this.repo.create(userId, data);
  }

  async findAll(userId: string) {
    return this.repo.findAll(userId);
  }

  async findOne(id: string) {
    return this.repo.findOne(id);
  }

  async findPool() {
    return this.repo.findPool();
  }

  async getPoolStats() {
    return this.repo.getPoolStats();
  }
}
