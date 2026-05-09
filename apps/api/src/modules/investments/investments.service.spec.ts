import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { InvestmentsRepository } from './investments.repository';
import { PrismaService } from '../../shared/prisma/prisma.service';

const investorId = 'inv-1';
const pmeId = 'pme-1';
const receivableId = 'r-1';

function baseReceivable(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: receivableId,
    userId: pmeId,
    value: 100000,
    type: 'invoice',
    status: 'validated',
    debtorName: 'Magazine Luiza',
    debtorDocument: '00.000.000/0001-00',
    documentHash: null,
    txHash: null,
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

  const txClient = {} as never;

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<InvestmentsRepository>> = {
      findReceivableForUpdate: jest.fn(),
      createInvestment: jest.fn(),
      setReceivableActive: jest.fn(),
      recordAudit: jest.fn(),
      findManyByInvestor: jest.fn(),
      getStatsByInvestor: jest.fn(),
    };

    const prismaMock = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        { provide: InvestmentsRepository, useValue: repoMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(InvestmentsService);
    repo = module.get(InvestmentsRepository) as jest.Mocked<InvestmentsRepository>;
  });

  describe('create', () => {
    it('creates an investment with amountPaid = faceValue * 0.97', async () => {
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
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

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
    });

    it('throws NotFoundException when receivable does not exist', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(null);
      await expect(service.create(investorId, { receivableId })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ConflictException when receivable already has an investment', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(
        baseReceivable({ investment: { id: 'existing' } }),
      );
      await expect(service.create(investorId, { receivableId })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws ConflictException when receivable status is not validated/active', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable({ status: 'pending' }));
      await expect(service.create(investorId, { receivableId })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws BadRequestException when investor is the receivable owner', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable({ userId: investorId }));
      await expect(service.create(investorId, { receivableId })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('passes pixTxId through to the repository', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
      repo.createInvestment.mockResolvedValue({} as never);
      await service.create(investorId, { receivableId, pixTxId: 'pix-abc' });
      expect(repo.createInvestment).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ pixTxId: 'pix-abc' }),
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
