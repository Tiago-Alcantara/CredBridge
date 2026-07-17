import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { SettlementsRepository } from './settlements.repository';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';

describe('SettlementsService', () => {
  let service: SettlementsService;

  const repoMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByReceivable: jest.fn(),
  };
  const prismaMock = {
    receivable: { findUnique: jest.fn(), update: jest.fn() },
    settlement: { create: jest.fn() },
  };
  const blockchainMock = {
    settleInvoiceInPool: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        { provide: SettlementsRepository, useValue: repoMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: BLOCKCHAIN_SERVICE, useValue: blockchainMock },
      ],
    }).compile();

    service = module.get(SettlementsService);
  });

  describe('delegations', () => {
    it('create forwards to the repository', async () => {
      repoMock.create.mockResolvedValue({ id: 's1' });
      const dto = { receivableId: 'r1', amount: 100 } as never;

      await expect(service.create(dto)).resolves.toEqual({ id: 's1' });
      expect(repoMock.create).toHaveBeenCalledWith(dto);
    });

    it('findAll forwards to the repository', async () => {
      repoMock.findAll.mockResolvedValue([]);
      await expect(service.findAll()).resolves.toEqual([]);
      expect(repoMock.findAll).toHaveBeenCalled();
    });

    it('findByReceivable forwards to the repository', async () => {
      repoMock.findByReceivable.mockResolvedValue([{ id: 's1' }]);
      await expect(service.findByReceivable('r1')).resolves.toEqual([{ id: 's1' }]);
      expect(repoMock.findByReceivable).toHaveBeenCalledWith('r1');
    });
  });

  describe('settleInvoice', () => {
    it('throws NotFound when the receivable does not exist', async () => {
      prismaMock.receivable.findUnique.mockResolvedValue(null);

      await expect(service.settleInvoice('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(blockchainMock.settleInvoiceInPool).not.toHaveBeenCalled();
    });

    it('is idempotent: returns the existing tx hash when already settled', async () => {
      prismaMock.receivable.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'settled',
        paymentTxHash: 'existing-hash',
      });

      await expect(service.settleInvoice('r1')).resolves.toBe('existing-hash');
      expect(blockchainMock.settleInvoiceInPool).not.toHaveBeenCalled();
      expect(prismaMock.receivable.update).not.toHaveBeenCalled();
      expect(prismaMock.settlement.create).not.toHaveBeenCalled();
    });

    it('settles on-chain, updates status and records the settlement', async () => {
      prismaMock.receivable.findUnique.mockResolvedValue({
        id: 'r1',
        status: 'active',
        value: 500,
        paymentTxHash: null,
      });
      blockchainMock.settleInvoiceInPool.mockResolvedValue('new-hash');
      prismaMock.receivable.update.mockResolvedValue({});
      prismaMock.settlement.create.mockResolvedValue({});

      const result = await service.settleInvoice('r1');

      expect(blockchainMock.settleInvoiceInPool).toHaveBeenCalledWith('r1', 500);
      expect(prismaMock.receivable.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: 'settled', paymentTxHash: 'new-hash' },
      });
      expect(prismaMock.settlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receivableId: 'r1',
            amount: 500,
            method: 'pix',
            status: 'completed',
            txHash: 'new-hash',
          }),
        }),
      );
      expect(result).toBe('new-hash');
    });
  });
});
