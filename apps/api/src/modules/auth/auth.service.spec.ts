import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: '',
  role: 'pme',
  name: 'Test User',
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
    update: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
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
