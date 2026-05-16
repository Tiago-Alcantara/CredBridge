import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',
  role: 'pme',
  name: 'Test User',
  stellarWalletId: null,
  passkeyId: null,
  phone: null,
  address: null,
  companyName: null,
  cnpj: null,
  monthlyRevenue: null,
  sector: null,
  investorType: null,
  riskProfile: null,
  operationalLimit: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const blockchainMock = {
  createCustodialWallet: jest.fn().mockResolvedValue('GPUBLIC_KEY_TESTNET'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        { provide: BLOCKCHAIN_SERVICE, useValue: blockchainMock },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('googleLogin', () => {
    const googleUser = { ...mockUser, googleId: 'google-sub-123', provider: 'google', role: null };

    beforeEach(() => {
      // Mock Google token verification internals via the private client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).googleClientId = 'test-client-id';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            sub: 'google-sub-123',
            email: 'test@example.com',
            email_verified: true,
            name: 'Test User',
          }),
        }),
      };
    });

    it('creates wallet when user has no stellarWalletId', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null) // findUnique by googleId
        .mockResolvedValueOnce(null); // findUnique by email
      prismaMock.user.create.mockResolvedValue(googleUser);
      prismaMock.user.update.mockResolvedValue({ ...googleUser, stellarWalletId: 'GPUBLIC_KEY_TESTNET' });

      const result = await service.googleLogin('fake-id-token');

      expect(blockchainMock.createCustodialWallet).toHaveBeenCalledWith('google-sub-123');
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { stellarWalletId: 'GPUBLIC_KEY_TESTNET' } }),
      );
      expect(result.user.stellarWalletId).toBe('GPUBLIC_KEY_TESTNET');
    });

    it('skips wallet creation when user already has stellarWalletId', async () => {
      const existingUser = { ...googleUser, stellarWalletId: 'GEXISTING_KEY' };
      prismaMock.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.googleLogin('fake-id-token');

      expect(blockchainMock.createCustodialWallet).not.toHaveBeenCalled();
      expect(result.user.stellarWalletId).toBe('GEXISTING_KEY');
    });

    it('still returns token even if wallet creation fails', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValue(googleUser);
      blockchainMock.createCustodialWallet.mockRejectedValueOnce(new Error('Friendbot down'));

      const result = await service.googleLogin('fake-id-token');

      expect(result.accessToken).toBe('token');
      expect(result.user.stellarWalletId).toBeNull();
    });
  });

  describe('findMe', () => {
    it('returns user without passwordHash', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findMe('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
    });

    it('throws UnauthorizedException when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.findMe('bad-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    it('updates and returns user without passwordHash', async () => {
      const updated = { ...mockUser, name: 'New Name' };
      prismaMock.user.update.mockResolvedValue(updated);
      const result = await service.updateProfile('user-1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('changePassword', () => {
    it('throws BadRequestException when current password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prismaMock.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      await expect(
        service.changePassword('user-1', { currentPassword: 'wrong', newPassword: 'newpass123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password when current password is correct', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prismaMock.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      prismaMock.user.update.mockResolvedValue({ ...mockUser });
      const result = await service.changePassword('user-1', { currentPassword: 'correct', newPassword: 'newpass123' });
      expect(result).toEqual({ message: 'ok' });
    });
  });
});
