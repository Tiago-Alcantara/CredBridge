import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { InvestmentsRepository } from './investments.repository';
import { CreateInvestmentDto } from './dto/create-investment.dto';

const DISCOUNT_RATE = 0.03;
const ALLOWED_STATUSES = new Set(['validated', 'active']);

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: InvestmentsRepository,
  ) {}

  async create(investorUserId: string, dto: CreateInvestmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const receivable = await this.repo.findReceivableForUpdate(tx, dto.receivableId);
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

      const investment = await this.repo.createInvestment(tx, {
        investorUserId,
        receivableId: receivable.id,
        faceValue,
        amountPaid,
        discountRate: DISCOUNT_RATE,
        pixTxId: dto.pixTxId,
      });

      await this.repo.setReceivableActive(tx, receivable.id);
      await this.repo.recordAudit(tx, {
        investmentId: investment.id,
        investorUserId,
        receivableId: receivable.id,
        amountPaid,
        faceValue,
      });

      return investment;
    });
  }
}
