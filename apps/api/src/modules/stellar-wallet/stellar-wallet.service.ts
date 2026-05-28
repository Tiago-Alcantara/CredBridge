import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import {
  BLOCKCHAIN_SERVICE,
  type BlockchainService,
} from '../../shared/blockchain/blockchain.interface';

@Injectable()
export class StellarWalletService {
  private readonly logger = new Logger(StellarWalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(BLOCKCHAIN_SERVICE)
    private readonly blockchain: BlockchainService,
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

  async getXlmBalance(userId: string): Promise<{
    walletAddress: string | null;
    xlmBalance: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        stellarWalletId: true,
        privyStellarWalletAddress: true,
        privyWalletStatus: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const walletAddress =
      user.privyStellarWalletAddress && user.privyWalletStatus === 'ready'
        ? user.privyStellarWalletAddress
        : user.stellarWalletId;

    if (!walletAddress) {
      return {
        walletAddress: null,
        xlmBalance: 0,
      };
    }

    const xlmBalance = await this.blockchain.getNativeXlmBalance(walletAddress);

    return {
      walletAddress,
      xlmBalance,
    };
  }
}
