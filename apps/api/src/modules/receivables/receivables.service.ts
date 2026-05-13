import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ReceivablesRepository } from './receivables.repository';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { toReceivableResponse } from './dto/receivable-response.dto';
import type { BlockchainService } from '../../shared/blockchain/blockchain.interface';
import { BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';

@Injectable()
export class ReceivablesService {
  constructor(
    private readonly repo: ReceivablesRepository,
    @Inject(BLOCKCHAIN_SERVICE) private readonly blockchain: BlockchainService,
  ) {}

  async create(userId: string, data: CreateReceivableDto) {
    return toReceivableResponse(await this.repo.create(userId, data));
  }

  async findAll(userId: string) {
    return (await this.repo.findAll(userId)).map(toReceivableResponse);
  }

  async findOne(id: string) {
    const r = await this.repo.findOne(id);
    return r ? toReceivableResponse(r) : null;
  }

  async findPool() {
    return (await this.repo.findPool()).map(toReceivableResponse);
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

    return toReceivableResponse(await this.repo.updateStatus(id, 'active', txHash));
  }

  async getPoolStats() {
    return this.repo.getPoolStats();
  }
}
