import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Injectable()
export class StellarWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async createWallet(userId: string, dto: CreateWalletDto): Promise<{ contractId: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ConflictException('User not found');

    if (user.stellarWalletId) {
      return { contractId: user.stellarWalletId };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { stellarWalletId: dto.contractId, passkeyId: dto.keyId },
    });

    return { contractId: dto.contractId };
  }

  async getWallet(userId: string): Promise<{ contractId: string; passkeyId: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stellarWalletId: true, passkeyId: true },
    });
    if (!user?.stellarWalletId) return null;
    return { contractId: user.stellarWalletId, passkeyId: user.passkeyId ?? '' };
  }
}
