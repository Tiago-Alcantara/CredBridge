import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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

  async createWallet(
    userId: string,
    dto: CreateWalletDto,
  ): Promise<{ contractId: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.privyStellarWalletAddress && user.privyWalletStatus === 'ready') {
      return { contractId: user.privyStellarWalletAddress };
    }

    if (user.stellarWalletId) {
      return { contractId: user.stellarWalletId };
    }

    this.logger.warn(
      `Manual wallet creation rejected for user ${userId}; Privy wallet is required`,
    );
    throw new BadRequestException('Privy Stellar wallet is required');
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
        privyStellarWalletAddress: true,
        privyWalletStatus: true,
      },
    });
    if (!user) return null;

    if (user.privyStellarWalletAddress && user.privyWalletStatus === 'ready') {
      return {
        contractId: user.privyStellarWalletAddress,
        passkeyId: null,
        walletType: 'privy_stellar',
        walletStatus: user.privyWalletStatus,
      };
    }

    if (!user.stellarWalletId) return null;
    return {
      contractId: user.stellarWalletId,
      passkeyId: user.passkeyId,
      walletType: user.walletType,
      walletStatus: user.walletStatus,
    };
  }
}
