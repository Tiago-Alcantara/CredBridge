import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvestmentsService } from './investments.service';
import { InvestmentsRepository } from './investments.repository';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  BLOCKCHAIN_SERVICE,
  type BlockchainService,
} from '../../shared/blockchain/blockchain.interface';

const investorId = 'inv-1';
const pmeId = 'pme-1';
const receivableId = 'r-1';

function baseReceivable(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: receivableId,
    userId: pmeId,
    value: 100000,
    type: 'invoice',
    status: 'active',
    debtorName: 'Magazine Luiza',
    debtorDocument: '00.000.000/0001-00',
    documentHash: null,
    txHash: 'tokenize-hash',
    paymentTxHash: 'pay-pme-hash',
    dueDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    investment: null,
    ...overrides,
  };
}

describe('InvestmentsService', () => {
  let service: InvestmentsService;
  let repo: jest.Mocked<InvestmentsRepository>;
  let blockchain: jest.Mocked<BlockchainService>;

  const txClient = {} as never;

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<InvestmentsRepository>> = {
      findReceivableForUpdate: jest.fn(),
      createInvestment: jest.fn(),
      setReceivableActive: jest.fn(),
      recordAudit: jest.fn(),
      setBlockchainTxHashes: jest.fn(),
      findManyByInvestor: jest.fn(),
      getStatsByInvestor: jest.fn(),
    };

    const blockchainMock: Partial<jest.Mocked<BlockchainService>> = {
      chargeInvestor: jest.fn().mockResolvedValue('charge-tx-hash'),
      transferNftToInvestor: jest.fn().mockResolvedValue('nft-tx-hash'),
    };

    const prismaMock = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        { provide: InvestmentsRepository, useValue: repoMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: BLOCKCHAIN_SERVICE, useValue: blockchainMock },
      ],
    }).compile();

    service = module.get(InvestmentsService);
    repo = module.get(InvestmentsRepository) as jest.Mocked<InvestmentsRepository>;
    blockchain = module.get(BLOCKCHAIN_SERVICE) as jest.Mocked<BlockchainService>;
  });

  describe('create', () => {
    it('creates investment, charges investor in XLM, and transfers NFT', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
      repo.createInvestment.mockResolvedValue({
        id: 'inv-row-1',
        investorUserId: investorId,
        receivableId,
        faceValue: 100000,
        amountPaid: 97000,
        discountRate: 0.03,
        status: 'active',
        pixTxId: null,
        paymentTxHash: null,
        nftTransferTxHash: null,
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      repo.setBlockchainTxHashes.mockResolvedValue({ id: 'inv-row-1' } as never);

      await service.create(investorId, { receivableId });

      expect(repo.createInvestment).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          investorUserId: investorId,
          receivableId,
          faceValue: 100000,
          amountPaid: 97000,
          discountRate: 0.03,
        }),
      );
      expect(repo.setReceivableActive).toHaveBeenCalledWith(expect.anything(), receivableId);
      expect(repo.recordAudit).toHaveBeenCalled();
      expect(blockchain.chargeInvestor).toHaveBeenCalledWith({
        investorUserId: investorId,
        amountXlm: 97000,
        memo: receivableId,
      });
      expect(blockchain.transferNftToInvestor).toHaveBeenCalledWith({
        receivableKey: receivableId,
        investorUserId: investorId,
      });
      expect(repo.setBlockchainTxHashes).toHaveBeenCalledWith('inv-row-1', {
        paymentTxHash: 'charge-tx-hash',
        nftTransferTxHash: 'nft-tx-hash',
      });
    });

    it('throws NotFoundException when receivable does not exist', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(null);
      await expect(service.create(investorId, { receivableId })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('throws ConflictException when receivable already has an investment', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(
        baseReceivable({ investment: { id: 'existing' } }),
      );
      await expect(service.create(investorId, { receivableId })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('throws ConflictException when receivable status is not active (NFT not yet minted)', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable({ status: 'validated' }));
      await expect(service.create(investorId, { receivableId })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when investor is the receivable owner', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable({ userId: investorId }));
      await expect(service.create(investorId, { receivableId })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('passes pixTxId through to the repository', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
      repo.createInvestment.mockResolvedValue({ id: 'inv-row-1' } as never);
      repo.setBlockchainTxHashes.mockResolvedValue({} as never);
      await service.create(investorId, { receivableId, pixTxId: 'pix-abc' });
      expect(repo.createInvestment).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ pixTxId: 'pix-abc' }),
      );
    });

    it('rolls back the transaction when setReceivableActive fails', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
      repo.createInvestment.mockResolvedValue({ id: 'inv-row-1' } as never);
      repo.setReceivableActive.mockRejectedValue(new Error('db update failed'));

      await expect(service.create(investorId, { receivableId })).rejects.toThrow(
        'db update failed',
      );

      expect(repo.createInvestment).toHaveBeenCalled();
      expect(repo.setReceivableActive).toHaveBeenCalled();
      expect(repo.recordAudit).not.toHaveBeenCalled();
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('propagates errors from chargeInvestor and skips NFT transfer', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
      repo.createInvestment.mockResolvedValue({ id: 'inv-row-1' } as never);
      blockchain.chargeInvestor.mockRejectedValue(new Error('insufficient XLM'));

      await expect(service.create(investorId, { receivableId })).rejects.toThrow(
        'insufficient XLM',
      );
      expect(blockchain.transferNftToInvestor).not.toHaveBeenCalled();
      expect(repo.setBlockchainTxHashes).not.toHaveBeenCalled();
    });

    it('maps Prisma P2002 unique violation to ConflictException', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
      repo.createInvestment.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique violation', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create(investorId, { receivableId })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('findMine', () => {
    it('returns positions for the given investor', async () => {
      const positions = [
        { id: 'a', investorUserId: investorId, receivableId, faceValue: 100, amountPaid: 97 },
      ] as never;
      repo.findManyByInvestor.mockResolvedValue(positions);
      const result = await service.findMine(investorId);
      expect(repo.findManyByInvestor).toHaveBeenCalledWith(investorId);
      expect(result).toBe(positions);
    });
  });

  describe('getMyStats', () => {
    it('returns aggregate stats for the investor', async () => {
      repo.getStatsByInvestor.mockResolvedValue({
        totalInvested: 9700,
        expectedReturn: 300,
        activePositions: 1,
      });
      const result = await service.getMyStats(investorId);
      expect(repo.getStatsByInvestor).toHaveBeenCalledWith(investorId);
      expect(result).toEqual({ totalInvested: 9700, expectedReturn: 300, activePositions: 1 });
    });
  });
});
