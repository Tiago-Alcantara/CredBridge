import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StellarWalletService } from './stellar-wallet.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  stellarWalletId: null,
  passkeyId: null,
  passkeyPublicKey: null,
  walletType: null,
  walletStatus: null,
  privyStellarWalletAddress: null,
  privyWalletStatus: null,
};

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const auditMock = {
  log: jest.fn(),
};

describe('StellarWalletService', () => {
  let service: StellarWalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarWalletService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();
    service = module.get<StellarWalletService>(StellarWalletService);
    jest.clearAllMocks();
  });

  describe('createWallet', () => {
    it('rejects manual wallet setup when the user has no Privy wallet', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.createWallet('user-1', {
          contractId: 'CCONTRACT123',
          keyId: 'key-abc',
          publicKey: 'public-key-abc',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(auditMock.log).not.toHaveBeenCalled();
    });

    it('returns existing contractId without re-deploying (idempotent)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        stellarWalletId: 'CEXISTING456',
      });

      const result = await service.createWallet('user-1', {
        contractId: 'CDIFFERENT789',
        keyId: 'key-xyz',
        publicKey: 'public-key-xyz',
      });

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(auditMock.log).not.toHaveBeenCalled();
      expect(result).toEqual({ contractId: 'CEXISTING456' });
    });

    it('returns existing Privy wallet without storing passkey metadata', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        privyStellarWalletAddress: 'GPRIVYWALLET',
        privyWalletStatus: 'ready',
      });

      const result = await service.createWallet('user-1', {
        contractId: 'CDIFFERENT789',
        keyId: 'key-xyz',
        publicKey: 'public-key-xyz',
      });

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(auditMock.log).not.toHaveBeenCalled();
      expect(result).toEqual({ contractId: 'GPRIVYWALLET' });
    });

    it('does not create a manual wallet when audit logging is unavailable', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      auditMock.log.mockRejectedValueOnce(new Error('audit unavailable'));

      await expect(
        service.createWallet('user-1', {
          contractId: 'CCONTRACT123',
          keyId: 'key-abc',
          publicKey: 'public-key-abc',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createWallet('bad-id', {
          contractId: 'C123',
          keyId: 'k1',
          publicKey: 'public-key',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWallet', () => {
    it('returns contractId and passkeyId when wallet exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        stellarWalletId: 'CCONTRACT123',
        passkeyId: 'key-abc',
        walletType: 'smart_account',
        walletStatus: 'ready',
      });

      const result = await service.getWallet('user-1');
      expect(result).toEqual({
        contractId: 'CCONTRACT123',
        passkeyId: 'key-abc',
        walletType: 'smart_account',
        walletStatus: 'ready',
      });
    });

    it('returns the Privy wallet when no legacy smart account exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        stellarWalletId: null,
        passkeyId: null,
        walletType: null,
        walletStatus: null,
        privyStellarWalletAddress: 'GPRIVYWALLET',
        privyWalletStatus: 'ready',
      });

      const result = await service.getWallet('user-1');
      expect(result).toEqual({
        contractId: 'GPRIVYWALLET',
        passkeyId: null,
        walletType: 'privy_stellar',
        walletStatus: 'ready',
      });
    });

    it('returns null when no wallet set', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        stellarWalletId: null,
        passkeyId: null,
        walletType: null,
        walletStatus: null,
        privyStellarWalletAddress: null,
        privyWalletStatus: null,
      });

      const result = await service.getWallet('user-1');
      expect(result).toBeNull();
    });
  });
});
