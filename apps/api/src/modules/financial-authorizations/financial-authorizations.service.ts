import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Keypair } from '@stellar/stellar-sdk';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFinancialAuthorizationChallengeDto } from './dto/create-financial-authorization-challenge.dto';
import { VerifyFinancialAuthorizationDto } from './dto/verify-financial-authorization.dto';
import { FinancialAuthorizationException } from './financial-authorization.errors';
import {
  DIRECT_AUTH_OPERATIONS,
  FINANCIAL_AUTH_DOMAIN,
  FINANCIAL_AUTH_VERSION,
  FinancialAuthorizationConsumption,
  FinancialAuthorizationPayload,
  FinancialOperation,
} from './financial-authorization.types';

const AUTH_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class FinancialAuthorizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  requiresDirectAuthorization(operation: FinancialOperation): boolean {
    return DIRECT_AUTH_OPERATIONS.has(operation);
  }

  async createChallenge(
    userId: string,
    dto: CreateFinancialAuthorizationChallengeDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        privyStellarWalletAddress: true,
        privyWalletStatus: true,
      },
    });

    if (
      !user?.privyStellarWalletAddress ||
      user.privyWalletStatus !== 'ready'
    ) {
      await this.audit.log({
        event: 'wallet.setup_required',
        entityId: userId,
        entityType: 'user',
        userId,
        metadata: {
          operation: dto.operation,
          resourceId: dto.resourceId ?? null,
        },
      });
      throw new FinancialAuthorizationException(
        'wallet_required',
        'Privy Stellar wallet is required before this financial action',
      );
    }

    const walletId = user.privyStellarWalletAddress;
    const expiresAt = new Date(Date.now() + AUTH_TTL_MS);
    const payload: FinancialAuthorizationPayload = {
      domain: FINANCIAL_AUTH_DOMAIN,
      version: FINANCIAL_AUTH_VERSION,
      network: this.config.get<string>('STELLAR_NETWORK') ?? 'testnet',
      operation: dto.operation,
      userId,
      walletId,
      resourceId: dto.resourceId ?? null,
      amount: dto.amount ?? null,
      destination: dto.destination ?? null,
      nonce: randomUUID(),
      expiresAt: expiresAt.toISOString(),
    };
    const payloadHash = this.hashPayload(payload);

    const authorization = await this.prisma.financialAuthorization.create({
      data: {
        userId,
        walletId: payload.walletId,
        operation: payload.operation,
        resourceId: payload.resourceId,
        amount: payload.amount,
        destination: payload.destination,
        nonce: payload.nonce,
        payloadHash,
        payload: payload as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });

    await this.audit.log({
      event: 'financial_authorization.challenge_created',
      entityId: authorization.id,
      entityType: 'financial_authorization',
      userId,
      metadata: {
        operation: payload.operation,
        resourceId: payload.resourceId,
        amount: payload.amount,
        destination: payload.destination,
        walletId: payload.walletId,
        payloadHash,
      },
    });

    return {
      authorizationId: authorization.id,
      payload,
      payloadHash,
      expiresAt: payload.expiresAt,
    };
  }

  async verify(userId: string, dto: VerifyFinancialAuthorizationDto) {
    const authorization = await this.prisma.financialAuthorization.findUnique({
      where: { id: dto.authorizationId },
      include: { user: true },
    });

    if (!authorization || authorization.userId !== userId) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Authorization not found',
      );
    }
    if (authorization.consumedAt) {
      throw new FinancialAuthorizationException(
        'authorization_already_used',
        'Authorization was already consumed',
      );
    }
    if (authorization.expiresAt.getTime() < Date.now()) {
      throw new FinancialAuthorizationException(
        'authorization_expired',
        'Authorization expired',
      );
    }
    if (authorization.payloadHash !== dto.payloadHash) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Authorization payload hash mismatch',
      );
    }

    this.verifyPrivyRawHashSignature(
      authorization.user.privyStellarWalletAddress,
      authorization.walletId,
      dto.assertion,
      authorization.payloadHash,
    );

    const updated = await this.prisma.financialAuthorization.update({
      where: { id: authorization.id },
      data: {
        signature: dto.assertion as Prisma.InputJsonValue,
        verifiedAt: new Date(),
      },
    });

    await this.audit.log({
      event: 'financial_authorization.verified',
      entityId: updated.id,
      entityType: 'financial_authorization',
      userId,
      metadata: {
        operation: updated.operation,
        resourceId: updated.resourceId,
        amount: updated.amount,
        destination: updated.destination,
        walletId: updated.walletId,
        payloadHash: updated.payloadHash,
      },
    });

    return { authorizationId: updated.id, verified: true };
  }

  async consume(input: FinancialAuthorizationConsumption): Promise<void> {
    const authorization = await this.prisma.financialAuthorization.findUnique({
      where: { id: input.authorizationId },
    });

    if (!authorization || authorization.userId !== input.userId) {
      throw new FinancialAuthorizationException(
        'authorization_required',
        'Authorization required',
      );
    }
    if (!authorization.verifiedAt) {
      throw new FinancialAuthorizationException(
        'authorization_required',
        'Authorization must be verified before use',
      );
    }
    if (authorization.consumedAt) {
      throw new FinancialAuthorizationException(
        'authorization_already_used',
        'Authorization was already consumed',
      );
    }
    if (authorization.expiresAt.getTime() < Date.now()) {
      throw new FinancialAuthorizationException(
        'authorization_expired',
        'Authorization expired',
      );
    }
    if (authorization.operation !== input.operation) {
      throw new FinancialAuthorizationException(
        'authorization_operation_mismatch',
        'Authorization operation mismatch',
      );
    }
    if ((authorization.resourceId ?? null) !== (input.resourceId ?? null)) {
      throw new FinancialAuthorizationException(
        'authorization_resource_mismatch',
        'Authorization resource mismatch',
      );
    }
    if ((authorization.amount ?? null) !== (input.amount ?? null)) {
      throw new FinancialAuthorizationException(
        'authorization_resource_mismatch',
        'Authorization amount mismatch',
      );
    }
    if ((authorization.destination ?? null) !== (input.destination ?? null)) {
      throw new FinancialAuthorizationException(
        'authorization_resource_mismatch',
        'Authorization destination mismatch',
      );
    }

    const consumeResult = await this.prisma.financialAuthorization.updateMany({
      where: {
        id: authorization.id,
        userId: input.userId,
        operation: input.operation,
        resourceId: input.resourceId ?? null,
        amount: input.amount ?? null,
        destination: input.destination ?? null,
        verifiedAt: { not: null },
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });

    if (consumeResult.count !== 1) {
      throw new FinancialAuthorizationException(
        'authorization_already_used',
        'Authorization was already consumed',
      );
    }

    await this.audit.log({
      event: 'financial_authorization.consumed',
      entityId: authorization.id,
      entityType: 'financial_authorization',
      userId: input.userId,
      metadata: {
        operation: authorization.operation,
        resourceId: authorization.resourceId,
        amount: authorization.amount,
        destination: authorization.destination,
        walletId: authorization.walletId,
        payloadHash: authorization.payloadHash,
      },
    });
  }

  hashPayload(payload: FinancialAuthorizationPayload): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private verifyPrivyRawHashSignature(
    privyStellarWalletAddress: string | null,
    walletId: string,
    assertion: Record<string, unknown>,
    expectedPayloadHash: string,
  ): void {
    if (!privyStellarWalletAddress || privyStellarWalletAddress !== walletId) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Privy signature is invalid',
      );
    }

    const signature = this.readPrivyRawHashSignature(assertion, walletId);
    const payloadHashBytes = this.readHexBytes(expectedPayloadHash, 32);
    const signatureBytes = this.readHexBytes(signature, 64);

    try {
      const keypair = Keypair.fromPublicKey(walletId);
      if (keypair.verify(payloadHashBytes, signatureBytes)) {
        return;
      }
    } catch {
      // Fall through to the uniform authorization error below.
    }

    throw new FinancialAuthorizationException(
      'authorization_invalid',
      'Privy signature verification failed',
    );
  }

  private readPrivyRawHashSignature(
    assertion: Record<string, unknown>,
    walletId: string,
  ): string {
    if (
      assertion.type !== 'privy_raw_hash' ||
      assertion.address !== walletId ||
      !this.isNonEmptyString(assertion.signature)
    ) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Privy signature is invalid',
      );
    }

    return assertion.signature.startsWith('0x')
      ? assertion.signature.slice(2)
      : assertion.signature;
  }

  private readHexBytes(value: string, byteLength: number): Buffer {
    if (!/^[0-9a-fA-F]+$/.test(value) || value.length !== byteLength * 2) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Privy signature is invalid',
      );
    }

    return Buffer.from(value, 'hex');
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
  }
}
