import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StellarService } from '../../shared/blockchain/stellar.service';
import { ReceivablesService } from '../receivables/receivables.service';

describe('AdminService', () => {
  let service: AdminService;

  const prismaMock = {
    user: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    receivable: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    transaction: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const stellarMock = {
    mintBrlt: jest.fn(),
    withdrawFromPool: jest.fn(),
    getPoolStatus: jest.fn(),
    getInvestorShares: jest.fn(),
  };
  const receivablesMock = { tokenize: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StellarService, useValue: stellarMock },
        { provide: ReceivablesService, useValue: receivablesMock },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  describe('createUser', () => {
    it('rejects a duplicate e-mail', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });

      await expect(
        service.createUser({ email: 'dup@x.com', role: 'investor', name: 'X' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('creates a new user with the privy provider', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({ id: 'u2' });

      await service.createUser({ email: 'new@x.com', role: 'pme', name: 'Y' } as never);

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'new@x.com', provider: 'privy' }),
        }),
      );
    });
  });

  describe('approveReceivable', () => {
    it('throws NotFound when the receivable is missing', async () => {
      prismaMock.receivable.findUnique.mockResolvedValue(null);
      await expect(service.approveReceivable('r1', 'op1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects when the receivable is not pending', async () => {
      prismaMock.receivable.findUnique.mockResolvedValue({ id: 'r1', status: 'validated' });
      await expect(service.approveReceivable('r1', 'op1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('validates, audits and tokenizes a pending receivable', async () => {
      prismaMock.receivable.findUnique.mockResolvedValue({ id: 'r1', status: 'pending' });
      prismaMock.receivable.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});
      receivablesMock.tokenize.mockResolvedValue({ id: 'r1', status: 'validated', txHash: 'h' });

      const result = await service.approveReceivable('r1', 'op1');

      expect(prismaMock.receivable.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'validated' },
      });
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ event: 'receivable.validated', userId: 'op1' }),
        }),
      );
      expect(receivablesMock.tokenize).toHaveBeenCalledWith('r1');
      expect(result).toMatchObject({ id: 'r1' });
    });
  });

  describe('rejectReceivable', () => {
    it('rejects when the receivable is not pending', async () => {
      prismaMock.receivable.findUnique.mockResolvedValue({ id: 'r1', status: 'rejected' });
      await expect(service.rejectReceivable('r1', 'op1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('marks a pending receivable as rejected and audits it', async () => {
      prismaMock.receivable.findUnique.mockResolvedValue({ id: 'r1', status: 'pending' });
      prismaMock.receivable.update.mockResolvedValue({ id: 'r1', status: 'rejected' });
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await service.rejectReceivable('r1', 'op1');

      expect(prismaMock.receivable.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'rejected' },
      });
      expect(result).toMatchObject({ status: 'rejected' });
    });
  });

  describe('createDeposit', () => {
    it('throws NotFound when the investor is missing', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(
        service.createDeposit({ userId: 'x', amount: 10 } as never, 'op1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates a pending-payment transaction and audits it', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'inv1' });
      prismaMock.transaction.create.mockResolvedValue({ id: 'tx1' });
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await service.createDeposit({ userId: 'inv1', amount: 300 } as never, 'op1');

      expect(prismaMock.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING_PAYMENT', type: 'DEPOSIT' }),
        }),
      );
      expect(result).toEqual({ id: 'tx1' });
    });
  });

  describe('approveTransaction', () => {
    it('throws NotFound when the transaction is missing', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue(null);
      await expect(
        service.approveTransaction('tx1', 'op1', 'APPROVED'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when the transaction is not pending', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({ id: 'tx1', status: 'APPROVED' });
      await expect(
        service.approveTransaction('tx1', 'op1', 'APPROVED'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks a transaction as REJECTED without touching the chain', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({ id: 'tx1', status: 'PENDING' });
      prismaMock.transaction.update.mockResolvedValue({ id: 'tx1', status: 'REJECTED' });

      const result = await service.approveTransaction('tx1', 'op1', 'REJECTED');

      expect(stellarMock.mintBrlt).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: 'REJECTED' });
    });

    it('mints BRLT when approving a DEPOSIT', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        id: 'tx1',
        status: 'PENDING',
        type: 'DEPOSIT',
        userId: 'inv1',
        amount: 200,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'inv1',
        privyStellarWalletAddress: 'GWALLET',
      });
      stellarMock.mintBrlt.mockResolvedValue('mint-hash');
      prismaMock.transaction.update.mockResolvedValue({ id: 'tx1', status: 'APPROVED', txHash: 'mint-hash' });
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await service.approveTransaction('tx1', 'op1', 'APPROVED');

      expect(stellarMock.mintBrlt).toHaveBeenCalledWith('GWALLET', 200);
      expect(result).toMatchObject({ txHash: 'mint-hash' });
    });

    it('rejects a DEPOSIT approval when the investor has no Stellar wallet', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        id: 'tx1',
        status: 'PENDING',
        type: 'DEPOSIT',
        userId: 'inv1',
        amount: 200,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'inv1',
        privyStellarWalletAddress: null,
        stellarWalletId: null,
      });

      await expect(
        service.approveTransaction('tx1', 'op1', 'APPROVED'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stellarMock.mintBrlt).not.toHaveBeenCalled();
    });

    it('calls withdrawFromPool when approving a WITHDRAWAL', async () => {
      prismaMock.transaction.findUnique.mockResolvedValue({
        id: 'tx1',
        status: 'PAYMENT_SUBMITTED',
        type: 'WITHDRAWAL',
        userId: 'inv1',
        amount: 50,
      });
      stellarMock.withdrawFromPool.mockResolvedValue('wd-hash');
      prismaMock.transaction.update.mockResolvedValue({ id: 'tx1', txHash: 'wd-hash' });
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await service.approveTransaction('tx1', 'op1', 'APPROVED');

      expect(stellarMock.withdrawFromPool).toHaveBeenCalledWith('inv1', 50);
      expect(result).toMatchObject({ txHash: 'wd-hash' });
    });
  });

  describe('delegations', () => {
    it('getPoolStatus delegates to StellarService', () => {
      stellarMock.getPoolStatus.mockReturnValue({ paused: false });
      expect(service.getPoolStatus()).toEqual({ paused: false });
    });

    it('getInvestorShares delegates to StellarService', () => {
      stellarMock.getInvestorShares.mockReturnValue({ shares: 10 });
      expect(service.getInvestorShares('GADDR')).toEqual({ shares: 10 });
      expect(stellarMock.getInvestorShares).toHaveBeenCalledWith('GADDR');
    });
  });
});
