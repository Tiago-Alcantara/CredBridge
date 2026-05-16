import { Test, TestingModule } from '@nestjs/testing';
import { ReceivablesService } from './receivables.service';
import { ReceivablesRepository } from './receivables.repository';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';

describe('ReceivablesService', () => {
  let service: ReceivablesService;

  const findManyMock = jest.fn();
  const countMock = jest.fn();
  const aggregateMock = jest.fn();

  const prismaMock = {
    receivable: {
      findMany: findManyMock,
      count: countMock,
      aggregate: aggregateMock,
    },
  };

  beforeEach(async () => {
    findManyMock.mockReset();
    countMock.mockReset();
    aggregateMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceivablesService,
        ReceivablesRepository,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: { log: jest.fn() } },
        {
          provide: BLOCKCHAIN_SERVICE,
          useValue: { tokenizeNfe: jest.fn(), payPme: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ReceivablesService);
  });

  describe('findPool', () => {
    it('excludes receivables that already have an investment', async () => {
      findManyMock.mockResolvedValue([]);
      await service.findPool();
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
            investment: null,
          }),
        }),
      );
    });
  });

  describe('getPoolStats', () => {
    it('aggregates only receivables without investments', async () => {
      countMock.mockResolvedValue(0);
      aggregateMock.mockResolvedValue({ _sum: { value: 0 } });
      await service.getPoolStats();
      const aggregateCall = aggregateMock.mock.calls[0][0];
      expect(aggregateCall.where).toEqual(
        expect.objectContaining({
          status: 'active',
          investment: null,
        }),
      );
      const countCall = countMock.mock.calls[0][0];
      expect(countCall.where).toEqual(
        expect.objectContaining({ investment: null }),
      );
    });
  });
});
