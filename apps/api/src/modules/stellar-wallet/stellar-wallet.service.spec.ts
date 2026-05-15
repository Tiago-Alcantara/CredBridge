import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StellarWalletService } from './stellar-wallet.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  stellarWalletId: null,
  passkeyId: null,
};

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('StellarWalletService', () => {
  let service: StellarWalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarWalletService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<StellarWalletService>(StellarWalletService);
    jest.clearAllMocks();
  });

  describe('createWallet', () => {
    it('stores contractId and keyId when user has no wallet', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        stellarWalletId: 'CCONTRACT123',
        passkeyId: 'key-abc',
      });

      const result = await service.createWallet('user-1', {
        contractId: 'CCONTRACT123',
        keyId: 'key-abc',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { stellarWalletId: 'CCONTRACT123', passkeyId: 'key-abc' },
      });
      expect(result).toEqual({ contractId: 'CCONTRACT123' });
    });

    it('returns existing contractId without re-deploying (idempotent)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        stellarWalletId: 'CEXISTING456',
      });

      const result = await service.createWallet('user-1', {
        contractId: 'CDIFFERENT789',
        keyId: 'key-xyz',
      });

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(result).toEqual({ contractId: 'CEXISTING456' });
    });

    it('throws NotFoundException when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createWallet('bad-id', { contractId: 'C123', keyId: 'k1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWallet', () => {
    it('returns contractId and passkeyId when wallet exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        stellarWalletId: 'CCONTRACT123',
        passkeyId: 'key-abc',
      });

      const result = await service.getWallet('user-1');
      expect(result).toEqual({ contractId: 'CCONTRACT123', passkeyId: 'key-abc' });
    });

    it('returns null when no wallet set', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        stellarWalletId: null,
        passkeyId: null,
      });

      const result = await service.getWallet('user-1');
      expect(result).toBeNull();
    });
  });
});
