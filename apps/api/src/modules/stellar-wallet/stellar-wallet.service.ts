import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Injectable()
export class StellarWalletService {
  private readonly logger = new Logger(StellarWalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createWallet(userId: string, dto: CreateWalletDto): Promise<{ contractId: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.stellarWalletId) {
      return { contractId: user.stellarWalletId };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        stellarWalletId: dto.contractId,
        passkeyId: dto.keyId,
        passkeyPublicKey: dto.publicKey,
        walletType: 'smart_account',
        walletStatus: 'ready',
      },
    });

    try {
      await this.audit.log({
        event: 'wallet.setup_completed',
        entityId: userId,
        entityType: 'user',
        userId,
        metadata: {
          contractId: dto.contractId,
          passkeyId: dto.keyId,
          walletType: 'smart_account',
          walletStatus: 'ready',
        },
      });
    } catch (err) {
      this.logger.warn(`Wallet setup audit failed for user ${userId}: ${(err as Error).message}`);
    }

    return { contractId: dto.contractId };
  }

  async getWallet(userId: string): Promise<{
    contractId: string;
    passkeyId: string | null;
    walletType: string | null;
    walletStatus: string | null;
  } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        stellarWalletId: true,
        passkeyId: true,
        walletType: true,
        walletStatus: true,
      },
    });
    if (!user?.stellarWalletId) return null;
    return {
      contractId: user.stellarWalletId,
      passkeyId: user.passkeyId,
      walletType: user.walletType,
      walletStatus: user.walletStatus,
    };
  }
}
