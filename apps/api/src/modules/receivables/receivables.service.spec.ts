import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReceivablesService } from './receivables.service';
import { ReceivablesRepository } from './receivables.repository';
import { AuditService } from '../audit/audit.service';
import { FinancialAuthorizationsService } from '../financial-authorizations/financial-authorizations.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BLOCKCHAIN_SERVICE } from '../../shared/blockchain/blockchain.interface';

const receivableId = 'receivable-1';
const pmeId = 'pme-1';

function baseReceivable(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: receivableId,
    userId: pmeId,
    value: 1000,
    type: 'invoice',
    status: 'validated',
    debtorName: 'Cliente Teste',
    debtorDocument: '00.000.000/0001-00',
    documentHash: 'xml-hash',
    txHash: null,
    paymentTxHash: null,
    dueDate: new Date('2026-06-20T00:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ReceivablesService', () => {
  let service: ReceivablesService;

  const findManyMock = jest.fn();
  const countMock = jest.fn();
  const aggregateMock = jest.fn();
  const findUniqueMock = jest.fn();
  const updateMock = jest.fn();
  const auditMock = { log: jest.fn() };
  const blockchainMock = {
    tokenizeNfe: jest.fn(),
    payPme: jest.fn(),
    transferNftToPlatform: jest.fn(),
  };
  const financialAuthorizationsMock = {
    consume: jest.fn(),
  };

  const prismaMock = {
    receivable: {
      findMany: findManyMock,
      count: countMock,
      aggregate: aggregateMock,
      findUnique: findUniqueMock,
      update: updateMock,
    },
  };

  beforeEach(async () => {
    findManyMock.mockReset();
    countMock.mockReset();
    aggregateMock.mockReset();
    findUniqueMock.mockReset();
    updateMock.mockReset();
    auditMock.log.mockReset();
    blockchainMock.tokenizeNfe.mockReset();
    blockchainMock.payPme.mockReset();
    blockchainMock.transferNftToPlatform.mockReset();
    financialAuthorizationsMock.consume.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceivablesService,
        ReceivablesRepository,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditService, useValue: auditMock },
        { provide: BLOCKCHAIN_SERVICE, useValue: blockchainMock },
        {
          provide: FinancialAuthorizationsService,
          useValue: financialAuthorizationsMock,
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

  describe('tokenize', () => {
    it('tokenizes a validated receivable without direct financial authorization', async () => {
      findUniqueMock.mockResolvedValue(baseReceivable());
      blockchainMock.tokenizeNfe.mockResolvedValue('tokenize-hash');
      updateMock.mockResolvedValue(
        baseReceivable({ status: 'tokenized', txHash: 'tokenize-hash' }),
      );

      await service.tokenize(receivableId);

      expect(financialAuthorizationsMock.consume).not.toHaveBeenCalled();
      expect(blockchainMock.tokenizeNfe).toHaveBeenCalledWith({
        key: receivableId,
        value: 1000,
        dueDate: new Date('2026-06-20T00:00:00.000Z'),
        xmlHash: 'xml-hash',
        ownerUserId: pmeId,
      });
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: receivableId },
        data: { status: 'tokenized', txHash: 'tokenize-hash' },
      });
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'receivable.tokenized_by_policy',
          txHash: 'tokenize-hash',
          metadata: { network: 'stellar', authorization: 'policy' },
        }),
      );
    });

    it('rejects tokenization unless the receivable is validated', async () => {
      findUniqueMock.mockResolvedValue(baseReceivable({ status: 'pending' }));

      await expect(service.tokenize(receivableId)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(blockchainMock.tokenizeNfe).not.toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('requestAssignment', () => {
    it('moves a tokenized receivable to assignment_pending', async () => {
      findUniqueMock.mockResolvedValue(baseReceivable({ status: 'tokenized' }));
      updateMock.mockResolvedValue(
        baseReceivable({ status: 'assignment_pending' }),
      );

      await service.requestAssignment(receivableId);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: receivableId },
        data: { status: 'assignment_pending' },
      });
    });
  });

  describe('assign', () => {
    it('requires a consumed receivable.assignment authorization before assigning', async () => {
      findUniqueMock.mockResolvedValue(
        baseReceivable({ status: 'tokenized', value: 1000 }),
      );
      blockchainMock.transferNftToPlatform.mockResolvedValue('transfer-hash');
      updateMock.mockResolvedValue(baseReceivable({ status: 'active' }));

      await service.assign(receivableId, 'auth-1');

      expect(financialAuthorizationsMock.consume).toHaveBeenCalledWith({
        authorizationId: 'auth-1',
        userId: pmeId,
        operation: 'receivable.assignment',
        resourceId: receivableId,
        amount: '1000.00',
        destination: 'credbridge-pool',
      });
      expect(blockchainMock.transferNftToPlatform).toHaveBeenCalledWith(
        receivableId,
      );
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: receivableId },
        data: { status: 'active' },
      });
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'receivable.assignment_signed',
          txHash: 'transfer-hash',
          metadata: { authorizationId: 'auth-1' },
        }),
      );
    });

    it('does not activate when authorization consumption fails', async () => {
      findUniqueMock.mockResolvedValue(baseReceivable({ status: 'tokenized' }));
      financialAuthorizationsMock.consume.mockRejectedValue(
        new Error('authorization_required'),
      );

      await expect(service.assign(receivableId, 'auth-1')).rejects.toThrow(
        'authorization_required',
      );

      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
