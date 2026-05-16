import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class InvestmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findReceivableForUpdate(tx: Prisma.TransactionClient, id: string) {
    return tx.receivable.findUnique({
      where: { id },
      include: { investment: true },
    });
  }

  createInvestment(
    tx: Prisma.TransactionClient,
    data: {
      investorUserId: string;
      receivableId: string;
      faceValue: number;
      amountPaid: number;
      discountRate: number;
      pixTxId?: string;
    },
  ) {
    return tx.investment.create({
      data: {
        investorUserId: data.investorUserId,
        receivableId: data.receivableId,
        faceValue: data.faceValue,
        amountPaid: data.amountPaid,
        discountRate: data.discountRate,
        pixTxId: data.pixTxId,
      },
    });
  }

  setReceivableActive(tx: Prisma.TransactionClient, receivableId: string) {
    return tx.receivable.update({
      where: { id: receivableId },
      data: { status: 'active' },
    });
  }

  recordAudit(
    tx: Prisma.TransactionClient,
    data: {
      investmentId: string;
      investorUserId: string;
      receivableId: string;
      amountPaid: number;
      faceValue: number;
    },
  ) {
    return tx.auditLog.create({
      data: {
        event: 'investment.created',
        entityType: 'investment',
        entityId: data.investmentId,
        userId: data.investorUserId,
        metadata: {
          receivableId: data.receivableId,
          amountPaid: data.amountPaid,
          faceValue: data.faceValue,
        },
      },
    });
  }

  setBlockchainTxHashes(
    investmentId: string,
    data: { paymentTxHash: string; nftTransferTxHash: string },
  ) {
    return this.prisma.investment.update({
      where: { id: investmentId },
      data: {
        paymentTxHash: data.paymentTxHash,
        nftTransferTxHash: data.nftTransferTxHash,
      },
    });
  }

  findManyByInvestor(investorUserId: string) {
    return this.prisma.investment.findMany({
      where: { investorUserId },
      orderBy: { paidAt: 'desc' },
      include: { receivable: true },
    });
  }

  async getStatsByInvestor(investorUserId: string) {
    const [agg, count] = await Promise.all([
      this.prisma.investment.aggregate({
        where: { investorUserId, status: 'active' },
        _sum: { amountPaid: true, faceValue: true },
      }),
      this.prisma.investment.count({
        where: { investorUserId, status: 'active' },
      }),
    ]);
    const totalInvested = agg._sum.amountPaid ?? 0;
    const totalFace = agg._sum.faceValue ?? 0;
    return {
      totalInvested,
      expectedReturn: totalFace - totalInvested,
      activePositions: count,
    };
  }
}
