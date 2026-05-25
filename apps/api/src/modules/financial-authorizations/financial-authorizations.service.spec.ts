import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Keypair } from '@stellar/stellar-sdk';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FinancialAuthorizationException } from './financial-authorization.errors';
import { FinancialAuthorizationsService } from './financial-authorizations.service';

const userId = 'user-1';
const walletKeypair = Keypair.random();
const walletId = walletKeypair.publicKey();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storedPayloadHash = 'a'.repeat(64);
const validSignature = walletKeypair
  .sign(Buffer.from(storedPayloadHash, 'hex'))
  .toString('hex');
const validAssertion = {
  type: 'privy_raw_hash',
  address: walletId,
  signature: `0x${validSignature}`,
};

describe('FinancialAuthorizationsService', () => {
  let service: FinancialAuthorizationsService;

  const prismaMock = {
    user: { findUnique: jest.fn() },
    financialAuthorization: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const auditMock = { log: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAuthorizationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'testnet') } },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get(FinancialAuthorizationsService);
  });

  it('does not require direct authorization for receivable tokenization', () => {
    expect(service.requiresDirectAuthorization('receivable.tokenize')).toBe(false);
  });

  it('requires direct authorization for receivable assignment and investor purchase', () => {
    expect(service.requiresDirectAuthorization('receivable.assignment')).toBe(true);
    expect(service.requiresDirectAuthorization('investment.purchase')).toBe(true);
  });

  it('throws wallet_required when the user has no ready Privy wallet', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      privyStellarWalletAddress: null,
      privyWalletStatus: null,
    });

    await expect(
      service.createChallenge(userId, { operation: 'investment.purchase', resourceId: 'r-1' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'wallet_required' }),
    });
  });

  it('creates a canonical challenge for the ready Privy wallet', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      privyStellarWalletAddress: walletId,
      privyWalletStatus: 'ready',
    });
    prismaMock.financialAuthorization.create.mockImplementation(({ data }) => ({
      id: 'auth-1',
      ...data,
    }));

    const result = await service.createChallenge(userId, {
      operation: 'receivable.assignment',
      resourceId: 'rec-1',
      amount: '1000.00',
      destination: 'credbridge-pool',
    });

    expect(result.authorizationId).toBe('auth-1');
    expect(result.payload.operation).toBe('receivable.assignment');
    expect(result.payload.walletId).toBe(walletId);
    expect(result.payload.nonce).toMatch(uuidPattern);
    expect(result.payloadHash).toHaveLength(64);
  });

  it('creates unique payloads for repeated challenges', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      privyStellarWalletAddress: walletId,
      privyWalletStatus: 'ready',
    });
    prismaMock.financialAuthorization.create.mockImplementation(({ data }) => ({
      id: `auth-${data.nonce}`,
      ...data,
    }));

    const firstResult = await service.createChallenge(userId, {
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
    });
    const secondResult = await service.createChallenge(userId, {
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
    });

    expect(firstResult.payload.nonce).not.toBe(secondResult.payload.nonce);
    expect(firstResult.payloadHash).not.toBe(secondResult.payloadHash);
  });

  it('rejects verify requests with mismatched payload hashes', async () => {
    prismaMock.financialAuthorization.findUnique.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      walletId,
      payloadHash: storedPayloadHash,
      verifiedAt: null,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: { privyStellarWalletAddress: walletId },
    });

    await expect(
      service.verify(userId, {
        authorizationId: '550e8400-e29b-41d4-a716-446655440000',
        payloadHash: 'different-payload-hash',
        assertion: validAssertion,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'authorization_invalid' }),
    });
  });

  it('rejects verify requests with malformed Privy signatures', async () => {
    prismaMock.financialAuthorization.findUnique.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      walletId,
      payloadHash: storedPayloadHash,
      verifiedAt: null,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: { privyStellarWalletAddress: walletId },
    });
    prismaMock.financialAuthorization.update.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      walletId,
      payloadHash: storedPayloadHash,
    });

    await expect(
      service.verify(userId, {
        authorizationId: '550e8400-e29b-41d4-a716-446655440000',
        payloadHash: storedPayloadHash,
        assertion: {
          type: 'privy_raw_hash',
          address: walletId,
        },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'authorization_invalid' }),
    });
  });

  it('stores signature and audit log when verification succeeds', async () => {
    prismaMock.financialAuthorization.findUnique.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      walletId,
      payloadHash: storedPayloadHash,
      verifiedAt: null,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: { privyStellarWalletAddress: walletId },
    });
    prismaMock.financialAuthorization.update.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      walletId,
      payloadHash: storedPayloadHash,
    });

    const result = await service.verify(userId, {
      authorizationId: '550e8400-e29b-41d4-a716-446655440000',
      payloadHash: storedPayloadHash,
      assertion: validAssertion,
    });

    expect(result).toEqual({ authorizationId: 'auth-1', verified: true });
    expect(prismaMock.financialAuthorization.update).toHaveBeenCalledWith({
      where: { id: 'auth-1' },
      data: {
        signature: validAssertion,
        verifiedAt: expect.any(Date),
      },
    });
    expect(auditMock.log).toHaveBeenCalledWith({
      event: 'financial_authorization.verified',
      entityId: 'auth-1',
      entityType: 'financial_authorization',
      userId,
      metadata: {
        operation: 'investment.purchase',
        resourceId: 'rec-1',
        amount: '970.00',
        destination: null,
        walletId,
        payloadHash: storedPayloadHash,
      },
    });
  });

  it('rejects verify requests when Privy signature verification fails', async () => {
    prismaMock.financialAuthorization.findUnique.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      walletId,
      payloadHash: storedPayloadHash,
      verifiedAt: null,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60000),
      user: { privyStellarWalletAddress: walletId },
    });

    await expect(
      service.verify(userId, {
        authorizationId: '550e8400-e29b-41d4-a716-446655440000',
        payloadHash: storedPayloadHash,
        assertion: {
          ...validAssertion,
          signature: `0x${'b'.repeat(128)}`,
        },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'authorization_invalid' }),
    });

    expect(prismaMock.financialAuthorization.update).not.toHaveBeenCalled();
  });

  it('rejects consuming an expired authorization', async () => {
    prismaMock.financialAuthorization.findUnique.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      verifiedAt: new Date(),
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.consume({
        authorizationId: 'auth-1',
        userId,
        operation: 'investment.purchase',
        resourceId: 'rec-1',
        amount: '970.00',
      }),
    ).rejects.toBeInstanceOf(FinancialAuthorizationException);
  });

  it('rejects operation mismatches during consumption', async () => {
    prismaMock.financialAuthorization.findUnique.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'pme.withdrawal',
      resourceId: null,
      amount: '970.00',
      destination: null,
      verifiedAt: new Date(),
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });

    await expect(
      service.consume({
        authorizationId: 'auth-1',
        userId,
        operation: 'investment.purchase',
        resourceId: 'rec-1',
        amount: '970.00',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'authorization_operation_mismatch' }),
    });
  });

  it('rejects consuming an authorization that was already used', async () => {
    prismaMock.financialAuthorization.findUnique.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      verifiedAt: new Date(),
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });

    await expect(
      service.consume({
        authorizationId: 'auth-1',
        userId,
        operation: 'investment.purchase',
        resourceId: 'rec-1',
        amount: '970.00',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'authorization_already_used' }),
    });
  });

  it('sets consumedAt atomically and emits audit log when consumption succeeds', async () => {
    prismaMock.financialAuthorization.findUnique.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      walletId,
      payloadHash: 'stored-payload-hash',
      verifiedAt: new Date(),
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    prismaMock.financialAuthorization.updateMany.mockResolvedValue({ count: 1 });

    await service.consume({
      authorizationId: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
    });

    expect(prismaMock.financialAuthorization.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'auth-1',
        userId,
        operation: 'investment.purchase',
        resourceId: 'rec-1',
        amount: '970.00',
        destination: null,
        verifiedAt: { not: null },
        consumedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(auditMock.log).toHaveBeenCalledWith({
      event: 'financial_authorization.consumed',
      entityId: 'auth-1',
      entityType: 'financial_authorization',
      userId,
      metadata: {
        operation: 'investment.purchase',
        resourceId: 'rec-1',
        amount: '970.00',
        destination: null,
        walletId,
        payloadHash: 'stored-payload-hash',
      },
    });
  });

  it('rejects consumption when the atomic update loses a race', async () => {
    prismaMock.financialAuthorization.findUnique.mockResolvedValue({
      id: 'auth-1',
      userId,
      operation: 'investment.purchase',
      resourceId: 'rec-1',
      amount: '970.00',
      destination: null,
      walletId,
      payloadHash: 'stored-payload-hash',
      verifiedAt: new Date(),
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });
    prismaMock.financialAuthorization.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.consume({
        authorizationId: 'auth-1',
        userId,
        operation: 'investment.purchase',
        resourceId: 'rec-1',
        amount: '970.00',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'authorization_already_used' }),
    });
    expect(auditMock.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'financial_authorization.consumed' }),
    );
  });
});
