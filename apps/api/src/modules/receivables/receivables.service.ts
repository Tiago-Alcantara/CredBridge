import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ReceivablesRepository } from './receivables.repository';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { BlockchainService, BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';

@Injectable()
export class ReceivablesService {
  constructor(
    private readonly repo: ReceivablesRepository,
    @Inject(BLOCKCHAIN_SERVICE) private readonly blockchain: BlockchainService,
  ) {}

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

  async activate(id: string) {
    const receivable = await this.repo.findOne(id);
    if (!receivable) throw new NotFoundException(`Receivable ${id} not found`);

    const txHash = await this.blockchain.tokenizeNfe({
      key: receivable.id,
      value: receivable.value,
      dueDate: receivable.dueDate,
      xmlHash: receivable.documentHash ?? null,
      ownerUserId: receivable.userId,
    });

    return this.repo.updateStatus(id, 'active', txHash);
  }

  async getPoolStats() {
    return this.repo.getPoolStats();
  }
}
