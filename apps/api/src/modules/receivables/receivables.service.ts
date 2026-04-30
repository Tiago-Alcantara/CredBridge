import { Injectable } from '@nestjs/common';
import { ReceivablesRepository } from './receivables.repository';
import { CreateReceivableDto } from './dto/create-receivable.dto';

@Injectable()
export class ReceivablesService {
  constructor(private readonly repo: ReceivablesRepository) {}

  async create(data: CreateReceivableDto) {
    return this.repo.create(data);
  }

  async findAll() {
    return this.repo.findAll();
  }

  async findOne(id: string) {
    return this.repo.findOne(id);
  }
}
