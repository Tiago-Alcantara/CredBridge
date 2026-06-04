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
}
