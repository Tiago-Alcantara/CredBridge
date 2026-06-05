import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { FinancialAuthorizationsService } from '../financial-authorizations/financial-authorizations.service';
import { InvestmentsRepository } from './investments.repository';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import {
  BLOCKCHAIN_SERVICE,
  type BlockchainService,
} from '../../shared/blockchain/blockchain.interface';
import {
  type DepositStage,
  type SubmitDepositStageDto,
} from './dto/onchain-deposit.dto';

const DISCOUNT_RATE = 0.03;
const ALLOWED_STATUSES = new Set(['active']);

@Injectable()
export class InvestmentsService {
  private readonly logger = new Logger(InvestmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: InvestmentsRepository,
    @Inject(BLOCKCHAIN_SERVICE)
    private readonly blockchain: BlockchainService,
    private readonly financialAuthorizations: FinancialAuthorizationsService,
  ) {}

  async create(investorUserId: string, dto: CreateInvestmentDto) {
    let investment: { id: string; receivableId: string; amountPaid: number };
    try {
      investment = await this.prisma.$transaction(async (tx) => {
        const receivable = await this.repo.findReceivableForUpdate(
          tx,
          dto.receivableId,
        );
        if (!receivable) {
          throw new NotFoundException('Recebível não encontrado');
        }
        if (receivable.investment) {
          throw new ConflictException('Recebível indisponível');
        }
        if (!ALLOWED_STATUSES.has(receivable.status)) {
          throw new ConflictException('Recebível indisponível');
        }
        if (receivable.userId === investorUserId) {
          throw new BadRequestException(
            'Você não pode comprar um recebível que cadastrou',
          );
        }

        const faceValue = receivable.value;
        const amountPaid = Number((faceValue * (1 - DISCOUNT_RATE)).toFixed(2));

        const created = await this.repo.createInvestment(tx, {
          investorUserId,
          receivableId: receivable.id,
          faceValue,
          amountPaid,
          discountRate: DISCOUNT_RATE,
          pixTxId: dto.pixTxId,
        });

        await this.repo.setReceivableActive(tx, receivable.id);
        await this.repo.recordAudit(tx, {
          investmentId: created.id,
          investorUserId,
          receivableId: receivable.id,
          amountPaid,
          faceValue,
        });

        return { id: created.id, receivableId: receivable.id, amountPaid };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Recebível indisponível');
      }
      throw e;
    }

    // On-chain settlement: investor pays XLM, platform transfers NFT
    this.logger.log(
      `Investment ${investment.id} reserved — charging investor + transferring NFT`,
    );
    await this.financialAuthorizations.consume({
      authorizationId: dto.authorizationId,
      userId: investorUserId,
      operation: 'investment.purchase',
      resourceId: investment.receivableId,
      amount: investment.amountPaid.toFixed(2),
      destination: null,
    });

    const paymentTxHash = await this.blockchain.chargeInvestor({
      investorUserId,
      amountBrl: investment.amountPaid,
      memo: investment.receivableId,
    });
    const nftTransferTxHash = await this.blockchain.transferNftToInvestor({
      receivableKey: investment.receivableId,
      investorUserId,
    });

    return this.repo.setBlockchainTxHashes(investment.id, {
      paymentTxHash,
      nftTransferTxHash,
    });
  }

  findMine(investorUserId: string) {
    return this.repo.findManyByInvestor(investorUserId);
  }

  getMyStats(investorUserId: string) {
    return this.repo.getStatsByInvestor(investorUserId);
  }

  async findMyTransactions(investorUserId: string) {
    return this.prisma.transaction.findMany({
      where: {
        userId: investorUserId,
        status: {
          in: ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'APPROVED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsPaid(transactionId: string, investorUserId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId: investorUserId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (transaction.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Esta transação não está pendente de pagamento');
    }

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'PAYMENT_SUBMITTED',
      },
    });
  }

  private async resolveInvestorAddress(investorUserId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: investorUserId },
      select: { privyStellarWalletAddress: true, stellarWalletId: true },
    });
    const address = user?.privyStellarWalletAddress ?? user?.stellarWalletId;
    if (!address) {
      throw new BadRequestException('Investidor não possui carteira Stellar configurada');
    }
    return address;
  }

  private async loadApprovedDeposit(transactionId: string, investorUserId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId: investorUserId },
    });
    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }
    if (transaction.type !== 'DEPOSIT') {
      throw new BadRequestException('Transação não é um depósito');
    }
    if (transaction.status !== 'APPROVED') {
      throw new BadRequestException('Esta transação ainda não foi aprovada pelo admin');
    }
    return transaction;
  }

  async buildDepositStage(
    transactionId: string,
    investorUserId: string,
    stage: DepositStage,
  ) {
    const transaction = await this.loadApprovedDeposit(transactionId, investorUserId);
    const investorAddress = await this.resolveInvestorAddress(investorUserId);
    return stage === 'approve'
      ? this.blockchain.buildApproveTx(investorAddress, transaction.amount)
      : this.blockchain.buildDepositTx(investorAddress, transaction.amount);
  }

  async submitDepositStage(
    transactionId: string,
    investorUserId: string,
    dto: SubmitDepositStageDto,
  ) {
    const transaction = await this.loadApprovedDeposit(transactionId, investorUserId);
    const investorAddress = await this.resolveInvestorAddress(investorUserId);

    const hash = await this.blockchain.submitSignedTx({
      xdr: dto.xdr,
      signerPublicKey: investorAddress,
      signatureHex: dto.signature,
    });

    if (dto.stage === 'approve') {
      return { hash, status: transaction.status };
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'COMPLETED', txHash: hash },
    });

    await this.prisma.auditLog.create({
      data: {
        event: 'pool.deposit_completed',
        entityId: transactionId,
        entityType: 'transaction',
        userId: investorUserId,
        txHash: hash,
        metadata: { amount: transaction.amount },
      },
    });

    return { hash, status: updated.status };
  }
}
