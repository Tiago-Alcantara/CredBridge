import { ConflictException } from '@nestjs/common';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarService } from './stellar.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('StellarService', () => {
  const originalEnv = { ...process.env };
  const userFindUnique = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      STELLAR_RPC_URL: 'http://localhost:8000/soroban/rpc',
      STELLAR_CONTRACT_ID:
        'CDIMUPT2SBPGBR5DHFVQ3HK74DHL4TMVCQIXINJYV2SRHXRYUYQRBVC7',
      STELLAR_SECRET_KEY: Keypair.random().secret(),
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createService() {
    return new StellarService({
      user: {
        findUnique: userFindUnique,
      },
    } as unknown as PrismaService);
  }

  it('rejects tokenization with a conflict when the PME has no Stellar wallet', async () => {
    userFindUnique.mockResolvedValue({ stellarWalletId: null });
    const service = createService();

    await expect(
      service.tokenizeNfe({
        key: 'receivable-1',
        value: 1000,
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
        xmlHash: null,
        ownerUserId: 'pme-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
