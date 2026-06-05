import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { PrivyAuthService } from './privy-auth.service';
import { StellarService } from '../../shared/blockchain/stellar.service';

jest.mock('./privy-auth.service', () => ({
  PrivyAuthService: class PrivyAuthService {},
}));

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',
  role: 'pme',
  name: 'Test User',
  stellarWalletId: null,
  passkeyId: null,
  passkeyPublicKey: null,
  walletType: null,
  walletStatus: null,
  privyUserId: null,
  privyStellarWalletAddress: null,
  privyWalletStatus: null,
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

const privyAuthMock = {
  verifySession: jest.fn(),
};

const stellarMock = {
  fundAccountFromPlatform: jest.fn().mockResolvedValue('tx-hash'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
        { provide: PrivyAuthService, useValue: privyAuthMock },
        { provide: StellarService, useValue: stellarMock },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.user.update.mockReset();
    privyAuthMock.verifySession.mockReset();
    stellarMock.fundAccountFromPlatform.mockReset();
    stellarMock.fundAccountFromPlatform.mockResolvedValue('tx-hash');
  });

  describe('googleLogin', () => {
    const googleUser = {
      ...mockUser,
      googleId: 'google-sub-123',
      provider: 'google',
      role: null,
    };

    beforeEach(() => {
      // Mock Google token verification internals via the private client

      (service as any).googleClientId = 'test-client-id';

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

    it('does not create wallet when user has no stellarWalletId', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null) // findUnique by googleId
        .mockResolvedValueOnce(mockUser); // findUnique by email
      prismaMock.user.update.mockResolvedValue(googleUser);

      const result = await service.googleLogin('fake-id-token');

      expect(prismaMock.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stellarWalletId: expect.any(String),
          }),
        }),
      );
      expect(result.user.stellarWalletId).toBeNull();
    });

    it('skips wallet creation when user already has stellarWalletId', async () => {
      const existingUser = { ...googleUser, stellarWalletId: 'GEXISTING_KEY' };
      prismaMock.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.googleLogin('fake-id-token');

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(result.user.stellarWalletId).toBe('GEXISTING_KEY');
    });

    it('does not call wallet creation during Google login failures path', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);
      prismaMock.user.update.mockResolvedValue(googleUser);

      const result = await service.googleLogin('fake-id-token');

      expect(result.accessToken).toBe('token');
      expect(prismaMock.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stellarWalletId: expect.any(String),
          }),
        }),
      );
      expect(result.user.stellarWalletId).toBeNull();
    });
  });

  describe('register', () => {
    it('does not create a custodial wallet during registration', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        ...mockUser,
        passwordHash: 'hash',
      });

      await service.register({
        email: 'test@example.com',
        password: 'password123',
        role: 'pme',
      });

      expect(prismaMock.user.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stellarWalletId: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('privySession', () => {
    beforeEach(() => {
      privyAuthMock.verifySession.mockResolvedValue({
        privyUserId: 'did:privy:user-1',
        email: 'test@example.com',
        stellarWalletAddress: 'GPRIVYWALLET',
      });
    });

    it('throws UnauthorizedException if the user email is not pre-registered', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.privySession('access-token', 'identity-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('links an existing email user to the verified Privy identity', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        provider: 'privy',
        privyUserId: 'did:privy:user-1',
        privyStellarWalletAddress: 'GPRIVYWALLET',
        privyWalletStatus: 'ready',
      });

      const result = await service.privySession(
        'access-token',
        'identity-token',
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          provider: 'privy',
          privyUserId: 'did:privy:user-1',
          privyStellarWalletAddress: 'GPRIVYWALLET',
          privyWalletStatus: 'ready',
        },
      });
      expect(result.needsRoleSelection).toBe(false);
    });

    it('refreshes wallet data for an already linked Privy user without changing the local email', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        email: 'previous@example.com',
        provider: 'privy',
        privyUserId: 'did:privy:user-1',
        privyStellarWalletAddress: 'GOLDWALLET',
        privyWalletStatus: 'pending',
      });
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        email: 'previous@example.com',
        provider: 'privy',
        privyUserId: 'did:privy:user-1',
        privyStellarWalletAddress: 'GPRIVYWALLET',
        privyWalletStatus: 'ready',
      });

      const result = await service.privySession(
        'access-token',
        'identity-token',
      );

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { privyUserId: 'did:privy:user-1' },
      });
      expect(prismaMock.user.findUnique).not.toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          provider: 'privy',
          privyUserId: 'did:privy:user-1',
          privyStellarWalletAddress: 'GPRIVYWALLET',
          privyWalletStatus: 'ready',
        },
      });
      expect(result.user.email).toBe('previous@example.com');
      expect(result.user.privyStellarWalletAddress).toBe('GPRIVYWALLET');
      expect(result.user.privyWalletStatus).toBe('ready');
    });

    it('checks testnet funding on every Privy login when a wallet exists', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        provider: 'privy',
        privyUserId: 'did:privy:user-1',
        privyStellarWalletAddress: 'GPRIVYWALLET',
        privyWalletStatus: 'ready',
      });
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        provider: 'privy',
        privyUserId: 'did:privy:user-1',
        privyStellarWalletAddress: 'GPRIVYWALLET',
        privyWalletStatus: 'ready',
      });

      await service.privySession('access-token', 'identity-token');

      expect(stellarMock.fundAccountFromPlatform).toHaveBeenCalledWith(
        'GPRIVYWALLET',
        '1.0',
      );
    });

    it('never writes Privy wallet details into legacy smart-account fields', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUser);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        provider: 'privy',
        privyUserId: 'did:privy:user-1',
        privyStellarWalletAddress: 'GPRIVYWALLET',
        privyWalletStatus: 'ready',
      });

      await service.privySession('access-token', 'identity-token');

      const updateData = prismaMock.user.update.mock.calls[0][0].data;
      const forbiddenLegacyFields = [
        'stellarWalletId',
        'passkeyId',
        'passkeyPublicKey',
        'walletType',
        'walletStatus',
      ];

      for (const field of forbiddenLegacyFields) {
        expect(updateData).not.toHaveProperty(field);
      }
    });
  });

  describe('findMe', () => {
    it('returns user without passwordHash', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.findMe('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          stellarWalletId: true,
          privyUserId: true,
          privyStellarWalletAddress: true,
          privyWalletStatus: true,
        }),
      });
    });

    it('throws UnauthorizedException when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.findMe('bad-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates and returns user without passwordHash', async () => {
      const updated = { ...mockUser, name: 'New Name' };
      prismaMock.user.update.mockResolvedValue(updated);
      const result = await service.updateProfile('user-1', {
        name: 'New Name',
      });
      expect(result.name).toBe('New Name');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('changePassword', () => {
    it('throws BadRequestException when current password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      });
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrong',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates password when current password is correct', async () => {
      const hash = await bcrypt.hash('correct', 10);
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      });
      prismaMock.user.update.mockResolvedValue({ ...mockUser });
      const result = await service.changePassword('user-1', {
        currentPassword: 'correct',
        newPassword: 'newpass123',
      });
      expect(result).toEqual({ message: 'ok' });
    });
  });
});
