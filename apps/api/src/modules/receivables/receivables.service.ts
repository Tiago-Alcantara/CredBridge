import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ReceivablesRepository } from './receivables.repository';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { toReceivableResponse } from './dto/receivable-response.dto';
import { AuditService } from '../audit/audit.service';
import type { BlockchainService } from '../../shared/blockchain/blockchain.interface';
import { BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';

@Injectable()
export class ReceivablesService {
  constructor(
    private readonly repo: ReceivablesRepository,
    private readonly audit: AuditService,
    @Inject(BLOCKCHAIN_SERVICE) private readonly blockchain: BlockchainService,
  ) {}

  async create(userId: string, data: CreateReceivableDto) {
    const receivable = await this.repo.create(userId, data);

    await this.audit.log({
      event: 'receivable.created',
      entityId: receivable.id,
      entityType: 'receivable',
      userId,
      metadata: {
        value: receivable.value,
        type: receivable.type,
        debtorName: receivable.debtorName,
        debtorDocument: receivable.debtorDocument,
        dueDate: receivable.dueDate.toISOString(),
      },
    });

    const validated = await this.repo.updateStatus(receivable.id, 'validated');
    await this.audit.log({
      event: 'receivable.validated',
      entityId: receivable.id,
      entityType: 'receivable',
      userId,
      metadata: {
        checks: ['document_hash', 'debtor_document', 'due_date'],
        result: 'passed',
      },
    });

    return toReceivableResponse(validated);
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

    await this.audit.log({
      event: 'receivable.ready_for_blockchain',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      metadata: { network: 'stellar', contract: 'soroban-nft' },
    });

    await this.audit.log({
      event: 'receivable.nft_minting',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      metadata: { value: receivable.value, xmlHash: receivable.documentHash ?? null },
    });

    const txHash = await this.blockchain.tokenizeNfe({
      key: receivable.id,
      value: receivable.value,
      dueDate: receivable.dueDate,
      xmlHash: receivable.documentHash ?? null,
      ownerUserId: receivable.userId,
    });

    await this.repo.updateStatus(id, 'active', txHash);

    await this.audit.log({
      event: 'receivable.nft_minted',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      txHash,
      metadata: { network: 'stellar' },
    });

    await this.audit.log({
      event: 'receivable.tx_confirmed',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      txHash,
      metadata: { network: 'stellar', status: 'success' },
    });

    const paymentTxHash = await this.blockchain.payPme({
      pmeUserId: receivable.userId,
      amountBrl: receivable.value,
      memo: receivable.id,
    });

    const updated = await this.repo.setPaymentTxHash(id, paymentTxHash);

    await this.audit.log({
      event: 'receivable.pme_paid',
      entityId: receivable.id,
      entityType: 'receivable',
      userId: receivable.userId,
      txHash: paymentTxHash,
      metadata: {
        network: 'stellar',
        asset: 'TESOURO',
        amount: receivable.value,
      },
    });

    return toReceivableResponse(updated);
  }

  async getPoolStats() {
    return this.repo.getPoolStats();
  }
}
