import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StellarService } from '../../shared/blockchain/stellar.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { ReceivablesService } from '../receivables/receivables.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
    private readonly receivables: ReceivablesService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new BadRequestException('E-mail já cadastrado na plataforma');
    }

    return this.prisma.user.create({
      data: {
        email: dto.email,
        role: dto.role,
        name: dto.name,
        cnpj: dto.cnpj ?? null,
        companyName: dto.companyName ?? null,
        monthlyRevenue: dto.monthlyRevenue ?? null,
        riskProfile: dto.riskProfile ?? null,
        operationalLimit: dto.operationalLimit ?? null,
        provider: 'privy', // Default provider
      },
    });
  }

  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        cnpj: true,
        companyName: true,
        operationalLimit: true,
        createdAt: true,
        stellarWalletId: true,
        privyStellarWalletAddress: true,
      },
    });
  }

  async listPendingReceivables() {
    return this.prisma.receivable.findMany({
      where: { status: 'pending' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveReceivable(id: string, operatorId: string) {
    const receivable = await this.prisma.receivable.findUnique({
      where: { id },
    });

    if (!receivable) {
      throw new NotFoundException('Recebível não encontrado');
    }

    if (receivable.status !== 'pending') {
      throw new BadRequestException(
        'Este recebível não está com status pendente',
      );
    }

    // Change status to validated (approved)
    await this.prisma.receivable.update({
      where: { id },
      data: { status: 'validated' },
    });

    // Register in audit log
    await this.prisma.auditLog.create({
      data: {
        event: 'receivable.validated',
        entityId: id,
        entityType: 'receivable',
        userId: operatorId,
        metadata: { approvedByOperator: true },
      },
    });

    // Minta a nota fiscal on-chain para a carteira da PME
    this.logger.log(
      `Aprovação concluída. Disparando mint da nota ${id} on-chain para a carteira do cliente.`,
    );
    const tokenized = await this.receivables.tokenize(id);

    return tokenized;
  }

  async rejectReceivable(id: string, operatorId: string) {
    const receivable = await this.prisma.receivable.findUnique({
      where: { id },
    });

    if (!receivable) {
      throw new NotFoundException('Recebível não encontrado');
    }

    if (receivable.status !== 'pending') {
      throw new BadRequestException(
        'Este recebível não está com status pendente',
      );
    }

    // Change status to rejected
    const updated = await this.prisma.receivable.update({
      where: { id },
      data: { status: 'rejected' },
    });

    // Register in audit log
    await this.prisma.auditLog.create({
      data: {
        event: 'receivable.rejected',
        entityId: id,
        entityType: 'receivable',
        userId: operatorId,
        metadata: { rejectedByOperator: true },
      },
    });

    return updated;
  }

  async listPendingTransactions() {
    return this.prisma.transaction.findMany({
      where: {
        status: {
          in: ['PENDING', 'PAYMENT_SUBMITTED'],
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDeposit(dto: CreateDepositDto, operatorId: string) {
    const investor = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!investor) {
      throw new NotFoundException('Investidor não encontrado');
    }

    const transaction = await this.prisma.transaction.create({
      data: {
        userId: dto.userId,
        type: 'DEPOSIT',
        amount: dto.amount,
        status: 'PENDING_PAYMENT',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        event: 'pool.deposit_order_created',
        entityId: transaction.id,
        entityType: 'transaction',
        userId: operatorId,
        metadata: { amount: dto.amount, investorId: dto.userId },
      },
    });

    return transaction;
  }

  async approveTransaction(
    id: string,
    operatorId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (transaction.status !== 'PENDING' && transaction.status !== 'PAYMENT_SUBMITTED') {
      throw new BadRequestException('Esta transação não está pendente de aprovação');
    }

    if (status === 'REJECTED') {
      return this.prisma.transaction.update({
        where: { id },
        data: {
          status: 'REJECTED',
          approvedBy: operatorId,
        },
      });
    }

    // Process APPROVED transaction on-chain
    this.logger.log(
      `Processing on-chain pool action for tx: ${transaction.id} (${transaction.type})`,
    );

    let txHash = '';
    if (transaction.type === 'DEPOSIT') {
      // O Admin aprova o recebimento do Pix e faz o MINT do BRLT on-chain para a carteira do investidor.
      // O investidor assinará o depósito real na Pool posteriormente.
      const user = await this.prisma.user.findUnique({
        where: { id: transaction.userId },
      });
      if (!user) {
        throw new NotFoundException('Usuário investidor não encontrado');
      }
      const walletAddress = user.privyStellarWalletAddress || user.stellarWalletId;
      if (!walletAddress) {
        throw new BadRequestException('Investidor não possui uma carteira Stellar configurada');
      }

      this.logger.log(`Minting BRLT for approved deposit to: ${walletAddress}`);
      txHash = await this.stellar.mintBrlt(
        walletAddress,
        transaction.amount,
      );
    } else if (transaction.type === 'WITHDRAWAL') {
      txHash = await this.stellar.withdrawFromPool(
        transaction.userId,
        transaction.amount,
      );
    } else {
      throw new BadRequestException('Tipo de transação inválido');
    }

    // Save approved status and transaction hash to DB
    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: operatorId,
        txHash,
      },
    });

    // Record in audit log
    await this.prisma.auditLog.create({
      data: {
        event: `pool.${transaction.type.toLowerCase()}`,
        entityId: id,
        entityType: 'transaction',
        userId: transaction.userId,
        txHash,
        metadata: { amount: transaction.amount, approvedBy: operatorId },
      },
    });

    return updated;
  }
}
