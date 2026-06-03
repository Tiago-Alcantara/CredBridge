import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvestmentsService } from './investments.service';
import { InvestmentsRepository } from './investments.repository';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { FinancialAuthorizationsService } from '../financial-authorizations/financial-authorizations.service';
import {
  BLOCKCHAIN_SERVICE,
  type BlockchainService,
} from '../../shared/blockchain/blockchain.interface';

const investorId = 'inv-1';
const pmeId = 'pme-1';
const receivableId = 'r-1';
const authorizationId = '00000000-0000-4000-8000-000000000001';

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
  let prisma: {
    $transaction: jest.Mock;
    transaction: { findFirst: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let financialAuthorizations: jest.Mocked<
    Pick<FinancialAuthorizationsService, 'consume'>
  >;

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
      buildApproveTx: jest.fn(),
      buildDepositTx: jest.fn(),
      submitSignedTx: jest.fn(),
    };

    const financialAuthorizationsMock = {
      consume: jest.fn().mockResolvedValue(undefined),
    };

    const prismaMock = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(txClient),
      ),
      transaction: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        { provide: InvestmentsRepository, useValue: repoMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: BLOCKCHAIN_SERVICE, useValue: blockchainMock },
        {
          provide: FinancialAuthorizationsService,
          useValue: financialAuthorizationsMock,
        },
      ],
    }).compile();

    service = module.get(InvestmentsService);
    repo = module.get(InvestmentsRepository);
    blockchain = module.get(BLOCKCHAIN_SERVICE);
    prisma = module.get(PrismaService);
    financialAuthorizations = module.get(FinancialAuthorizationsService);
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
      });
      repo.setBlockchainTxHashes.mockResolvedValue({
        id: 'inv-row-1',
      } as never);

      await service.create(investorId, { receivableId, authorizationId });

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
      expect(repo.setReceivableActive).toHaveBeenCalledWith(
        expect.anything(),
        receivableId,
      );
      expect(repo.recordAudit).toHaveBeenCalled();
      expect(financialAuthorizations.consume).toHaveBeenCalledWith({
        authorizationId,
        userId: investorId,
        operation: 'investment.purchase',
        resourceId: receivableId,
        amount: '97000.00',
        destination: null,
      });
      expect(blockchain.chargeInvestor).toHaveBeenCalledWith({
        investorUserId: investorId,
        amountBrl: 97000,
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
      await expect(
        service.create(investorId, { receivableId, authorizationId }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('throws ConflictException when receivable already has an investment', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(
        baseReceivable({ investment: { id: 'existing' } }),
      );
      await expect(
        service.create(investorId, { receivableId, authorizationId }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('throws ConflictException when receivable status is not active (NFT not yet minted)', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(
        baseReceivable({ status: 'validated' }),
      );
      await expect(
        service.create(investorId, { receivableId, authorizationId }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when investor is the receivable owner', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(
        baseReceivable({ userId: investorId }),
      );
      await expect(
        service.create(investorId, { receivableId, authorizationId }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('passes pixTxId through to the repository', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
      repo.createInvestment.mockResolvedValue({ id: 'inv-row-1' } as never);
      repo.setBlockchainTxHashes.mockResolvedValue({} as never);
      await service.create(investorId, {
        receivableId,
        authorizationId,
        pixTxId: 'pix-abc',
      });
      expect(repo.createInvestment).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ pixTxId: 'pix-abc' }),
      );
    });

    it('rolls back the transaction when setReceivableActive fails', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
      repo.createInvestment.mockResolvedValue({ id: 'inv-row-1' } as never);
      repo.setReceivableActive.mockRejectedValue(new Error('db update failed'));

      await expect(
        service.create(investorId, { receivableId, authorizationId }),
      ).rejects.toThrow('db update failed');

      expect(repo.createInvestment).toHaveBeenCalled();
      expect(repo.setReceivableActive).toHaveBeenCalled();
      expect(repo.recordAudit).not.toHaveBeenCalled();
      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
    });

    it('propagates errors from chargeInvestor and skips NFT transfer', async () => {
      repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
      repo.createInvestment.mockResolvedValue({ id: 'inv-row-1' } as never);
      blockchain.chargeInvestor.mockRejectedValue(
        new Error('insufficient XLM'),
      );

      await expect(
        service.create(investorId, { receivableId, authorizationId }),
      ).rejects.toThrow('insufficient XLM');
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

      await expect(
        service.create(investorId, { receivableId, authorizationId }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('does not charge investor when authorization consumption fails', async () => {
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
      });
      financialAuthorizations.consume.mockRejectedValue(
        new Error('authorization_required'),
      );

      await expect(
        service.create(investorId, { receivableId, authorizationId }),
      ).rejects.toThrow('authorization_required');

      expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
      expect(blockchain.transferNftToInvestor).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    it('returns positions for the given investor', async () => {
      const positions = [
        {
          id: 'a',
          investorUserId: investorId,
          receivableId,
          faceValue: 100,
          amountPaid: 97,
        },
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
      expect(result).toEqual({
        totalInvested: 9700,
        expectedReturn: 300,
        activePositions: 1,
      });
    });
  });

  describe('buildDepositStage', () => {
    const approvedTx = {
      id: 'tx1',
      userId: 'inv1',
      amount: 500,
      status: 'APPROVED',
      type: 'DEPOSIT',
    };
    const investorUser = {
      privyStellarWalletAddress: 'GINV...',
      stellarWalletId: null,
    };

    it('calls buildApproveTx with the server-resolved investor address and transaction amount when stage is approve', async () => {
      const builtXdr = { xdr: 'approve-xdr', hashToSign: 'hash-approve', signerPublicKey: 'GINV...' };
      prisma.transaction.findFirst.mockResolvedValue(approvedTx);
      prisma.user.findUnique.mockResolvedValue(investorUser);
      blockchain.buildApproveTx.mockResolvedValue(builtXdr);

      const result = await service.buildDepositStage('tx1', 'inv1', 'approve');

      expect(blockchain.buildApproveTx).toHaveBeenCalledWith('GINV...', 500);
      expect(blockchain.buildDepositTx).not.toHaveBeenCalled();
      expect(result).toBe(builtXdr);
    });

    it('calls buildDepositTx with the server-resolved investor address and transaction amount when stage is deposit', async () => {
      const builtXdr = { xdr: 'deposit-xdr', hashToSign: 'hash-deposit', signerPublicKey: 'GINV...' };
      prisma.transaction.findFirst.mockResolvedValue(approvedTx);
      prisma.user.findUnique.mockResolvedValue(investorUser);
      blockchain.buildDepositTx.mockResolvedValue(builtXdr);

      const result = await service.buildDepositStage('tx1', 'inv1', 'deposit');

      expect(blockchain.buildDepositTx).toHaveBeenCalledWith('GINV...', 500);
      expect(blockchain.buildApproveTx).not.toHaveBeenCalled();
      expect(result).toBe(builtXdr);
    });

    it('throws BadRequestException and calls neither build method when transaction is not in APPROVED status', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        ...approvedTx,
        status: 'PENDING_PAYMENT',
      });
      prisma.user.findUnique.mockResolvedValue(investorUser);

      await expect(
        service.buildDepositStage('tx1', 'inv1', 'approve'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(blockchain.buildApproveTx).not.toHaveBeenCalled();
      expect(blockchain.buildDepositTx).not.toHaveBeenCalled();
    });
  });

  describe('submitDepositStage', () => {
    const approvedTx = {
      id: 'tx1',
      userId: 'inv1',
      amount: 500,
      status: 'APPROVED',
      type: 'DEPOSIT',
    };
    const investorUser = {
      privyStellarWalletAddress: 'GINV...',
      stellarWalletId: null,
    };

    it('submits on-chain and marks transaction COMPLETED with the RPC hash when stage is deposit', async () => {
      prisma.transaction.findFirst.mockResolvedValue(approvedTx);
      prisma.user.findUnique.mockResolvedValue(investorUser);
      prisma.transaction.update.mockResolvedValue({
        ...approvedTx,
        status: 'COMPLETED',
        txHash: 'realhash',
      });
      prisma.auditLog.create.mockResolvedValue({});
      blockchain.submitSignedTx.mockResolvedValue('realhash');

      const result = await service.submitDepositStage('tx1', 'inv1', {
        stage: 'deposit',
        xdr: 'x',
        signature: 'ab',
      });

      expect(blockchain.submitSignedTx).toHaveBeenCalledWith({
        xdr: 'x',
        signerPublicKey: 'GINV...',
        signatureHex: 'ab',
      });
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED', txHash: 'realhash' }),
        }),
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('submits on-chain but does NOT mark transaction COMPLETED when stage is approve', async () => {
      prisma.transaction.findFirst.mockResolvedValue(approvedTx);
      prisma.user.findUnique.mockResolvedValue(investorUser);
      blockchain.submitSignedTx.mockResolvedValue('approvehash');

      const result = await service.submitDepositStage('tx1', 'inv1', {
        stage: 'approve',
        xdr: 'xdr-approve',
        signature: 'cd',
      });

      expect(blockchain.submitSignedTx).toHaveBeenCalledWith({
        xdr: 'xdr-approve',
        signerPublicKey: 'GINV...',
        signatureHex: 'cd',
      });
      expect(prisma.transaction.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
      expect(result.status).toBe('APPROVED');
    });

    it('throws BadRequestException when transaction is not in APPROVED status', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        ...approvedTx,
        status: 'PENDING_PAYMENT',
      });
      prisma.user.findUnique.mockResolvedValue(investorUser);

      await expect(
        service.submitDepositStage('tx1', 'inv1', {
          stage: 'deposit',
          xdr: 'x',
          signature: 'ab',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(blockchain.submitSignedTx).not.toHaveBeenCalled();
    });
  });
});
