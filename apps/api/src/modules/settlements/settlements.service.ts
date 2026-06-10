import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { SettlementsRepository } from './settlements.repository';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { BlockchainService } from '../../shared/blockchain/blockchain.interface';
import { BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    private readonly repo: SettlementsRepository,
    private readonly prisma: PrismaService,
    @Inject(BLOCKCHAIN_SERVICE) private readonly blockchain: BlockchainService,
  ) {}

  async create(data: CreateSettlementDto) {
    return this.repo.create(data);
  }

  async findAll() {
    return this.repo.findAll();
  }

  async findByReceivable(receivableId: string) {
    return this.repo.findByReceivable(receivableId);
  }

  async settleInvoice(receivableId: string): Promise<string | null> {
    const receivable = await this.prisma.receivable.findUnique({
      where: { id: receivableId },
    });
    if (!receivable) {
      throw new NotFoundException(`Receivable ${receivableId} not found`);
    }

    if (receivable.status === 'settled') {
      this.logger.log(`Receivable ${receivableId} already settled`);
      return receivable.paymentTxHash;
    }

    // 1. Settle on-chain
    this.logger.log(`Settling invoice ${receivableId} on-chain...`);
    const txHash = await this.blockchain.settleInvoiceInPool(
      receivable.id,
      receivable.value,
    );

    // 2. Update status in db
    await this.prisma.receivable.update({
      where: { id: receivableId },
      data: { status: 'settled', paymentTxHash: txHash },
    });

    // 3. Create a Settlement database record
    await this.prisma.settlement.create({
      data: {
        receivableId,
        amount: receivable.value,
        method: 'pix',
        status: 'completed',
        txHash,
        settledAt: new Date(),
      },
    });

    this.logger.log(`Receivable ${receivableId} settled successfully. TxHash: ${txHash}`);
    return txHash;
  }
}
