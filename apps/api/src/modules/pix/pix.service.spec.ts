import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PixService } from './pix.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StellarService } from '../../shared/blockchain/stellar.service';
import { PixClient } from './pix.client';
import { ConfigService } from '@nestjs/config';
import { SettlementsService } from '../settlements/settlements.service';

describe('PixService', () => {
  let service: PixService;

  const prismaMock = {
    user: { findUnique: jest.fn() },
    transaction: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    receivableCollection: { findMany: jest.fn() },
    receivable: { findMany: jest.fn() },
  };

  const pixClientMock = {
    createDeposit: jest.fn(),
    getOrderById: jest.fn(),
    refreshOrder: jest.fn(),
  };

  const stellarMock = {};
  const settlementsMock = {};
  const configMock = { get: jest.fn((_key: string, fallback?: string) => fallback) };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PixService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StellarService, useValue: stellarMock },
        { provide: PixClient, useValue: pixClientMock },
        { provide: ConfigService, useValue: configMock },
        { provide: SettlementsService, useValue: settlementsMock },
      ],
    }).compile();

    service = module.get(PixService);
  });

  describe('createDepositOrder', () => {
    it('throws NotFound when the investor does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createDepositOrder(
          { userId: 'missing', amount: 100 } as never,
          'operator-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.transaction.create).not.toHaveBeenCalled();
      expect(pixClientMock.createDeposit).not.toHaveBeenCalled();
    });

    it('creates the transaction, audit log and Pix order on the happy path', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'inv-1' });
      prismaMock.transaction.create.mockResolvedValue({ id: 'tx-1' });
      prismaMock.auditLog.create.mockResolvedValue({});
      pixClientMock.createDeposit.mockResolvedValue({
        pixOrderId: 'pix-1',
        identifier: 'id-1',
      });
      prismaMock.transaction.update.mockResolvedValue({
        id: 'tx-1',
        pixOrderId: 'pix-1',
      });

      const result = await service.createDepositOrder(
        { userId: 'inv-1', amount: 250 } as never,
        'operator-1',
      );

      expect(pixClientMock.createDeposit).toHaveBeenCalledWith(
        expect.objectContaining({ externalId: 'tx-1', ownerId: 'inv-1', amount: 250 }),
      );
      expect(result.transaction).toEqual({ id: 'tx-1', pixOrderId: 'pix-1' });
      expect(result.pixOrder.pixOrderId).toBe('pix-1');
    });

    it('attributes the audit log to the investor when triggered by the system', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'inv-1' });
      prismaMock.transaction.create.mockResolvedValue({ id: 'tx-1' });
      prismaMock.auditLog.create.mockResolvedValue({});
      pixClientMock.createDeposit.mockResolvedValue({ pixOrderId: 'pix-1', identifier: 'id-1' });
      prismaMock.transaction.update.mockResolvedValue({ id: 'tx-1' });

      await service.createDepositOrder(
        { userId: 'inv-1', amount: 250 } as never,
        'system',
      );

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'inv-1' }),
        }),
      );
    });
  });

  describe('getPixOrderForTransaction', () => {
    it('throws NotFound when the transaction does not belong to the user', async () => {
      prismaMock.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.getPixOrderForTransaction('tx-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns null when the transaction has no Pix order', async () => {
      prismaMock.transaction.findFirst.mockResolvedValue({ id: 'tx-1', pixOrderId: null });

      await expect(
        service.getPixOrderForTransaction('tx-1', 'user-1'),
      ).resolves.toBeNull();
      expect(pixClientMock.getOrderById).not.toHaveBeenCalled();
    });

    it('fetches the order from the Pix client when a Pix order exists', async () => {
      prismaMock.transaction.findFirst.mockResolvedValue({ id: 'tx-1', pixOrderId: 'pix-1' });
      pixClientMock.getOrderById.mockResolvedValue({ pixOrderId: 'pix-1', status: 'PAID' });

      const result = await service.getPixOrderForTransaction('tx-1', 'user-1');

      expect(pixClientMock.getOrderById).toHaveBeenCalledWith('pix-1');
      expect(result).toEqual({ pixOrderId: 'pix-1', status: 'PAID' });
    });
  });

  describe('refreshPixOrder', () => {
    it('throws NotFound when there is no Pix order for the transaction', async () => {
      prismaMock.transaction.findFirst.mockResolvedValue({ id: 'tx-1', pixOrderId: null });

      await expect(
        service.refreshPixOrder('tx-1', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refreshes the order through the Pix client', async () => {
      prismaMock.transaction.findFirst.mockResolvedValue({ id: 'tx-1', pixOrderId: 'pix-1' });
      pixClientMock.refreshOrder.mockResolvedValue({ pixOrderId: 'pix-1', status: 'PENDING' });

      const result = await service.refreshPixOrder('tx-1', 'user-1');

      expect(pixClientMock.refreshOrder).toHaveBeenCalledWith('pix-1');
      expect(result).toEqual({ pixOrderId: 'pix-1', status: 'PENDING' });
    });
  });

  describe('listActiveCollections', () => {
    const collections = [
      { id: 'c1', receivableId: 'r1', createdAt: new Date() },
      { id: 'c2', receivableId: 'r2', createdAt: new Date() },
    ];

    it('scopes receivables to the requesting user when role is not operator', async () => {
      prismaMock.receivableCollection.findMany.mockResolvedValue(collections);
      prismaMock.receivable.findMany.mockResolvedValue([
        { id: 'r1', debtorName: 'ACME', debtorDocument: '111' },
      ]);

      const result = await service.listActiveCollections('pme-1', 'pme');

      expect(prismaMock.receivable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'pme-1' }),
        }),
      );
      // Only the receivable owned by the user survives the filter
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'c1', debtorName: 'ACME' });
    });

    it('does not scope by user when the role is operator', async () => {
      prismaMock.receivableCollection.findMany.mockResolvedValue(collections);
      prismaMock.receivable.findMany.mockResolvedValue([
        { id: 'r1', debtorName: 'ACME', debtorDocument: '111' },
        { id: 'r2', debtorName: 'Globex', debtorDocument: '222' },
      ]);

      const result = await service.listActiveCollections('op-1', 'operator');

      const whereArg = prismaMock.receivable.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('userId');
      expect(result).toHaveLength(2);
    });
  });
});
