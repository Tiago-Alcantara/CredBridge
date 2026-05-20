import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
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

  async createChallenge(userId: string, dto: CreateFinancialAuthorizationChallengeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        stellarWalletId: true,
        passkeyId: true,
        passkeyPublicKey: true,
        walletType: true,
        walletStatus: true,
      },
    });

    if (
      !user?.stellarWalletId ||
      !user.passkeyId ||
      !user.passkeyPublicKey ||
      user.walletType !== 'smart_account' ||
      user.walletStatus !== 'ready'
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
        'Smart account setup is required before this financial action',
      );
    }

    const expiresAt = new Date(Date.now() + AUTH_TTL_MS);
    const payload: FinancialAuthorizationPayload = {
      domain: FINANCIAL_AUTH_DOMAIN,
      version: FINANCIAL_AUTH_VERSION,
      network: this.config.get<string>('STELLAR_NETWORK') ?? 'testnet',
      operation: dto.operation,
      userId,
      walletId: user.stellarWalletId,
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
      throw new FinancialAuthorizationException('authorization_invalid', 'Authorization not found');
    }
    if (authorization.consumedAt) {
      throw new FinancialAuthorizationException(
        'authorization_already_used',
        'Authorization was already consumed',
      );
    }
    if (authorization.expiresAt.getTime() < Date.now()) {
      throw new FinancialAuthorizationException('authorization_expired', 'Authorization expired');
    }
    if (authorization.payloadHash !== dto.payloadHash) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Authorization payload hash mismatch',
      );
    }

    await this.verifyAssertionForStoredPasskey(authorization.user.passkeyPublicKey, dto.assertion);

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
      throw new FinancialAuthorizationException('authorization_required', 'Authorization required');
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
      throw new FinancialAuthorizationException('authorization_expired', 'Authorization expired');
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

    const updated = await this.prisma.financialAuthorization.update({
      where: { id: authorization.id },
      data: { consumedAt: new Date() },
    });

    await this.audit.log({
      event: 'financial_authorization.consumed',
      entityId: updated.id,
      entityType: 'financial_authorization',
      userId: input.userId,
      metadata: {
        operation: updated.operation,
        resourceId: updated.resourceId,
        amount: updated.amount,
        destination: updated.destination,
        walletId: updated.walletId,
        payloadHash: updated.payloadHash,
      },
    });
  }

  hashPayload(payload: FinancialAuthorizationPayload): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private async verifyAssertionForStoredPasskey(
    passkeyPublicKey: string | null,
    assertion: Record<string, unknown>,
  ): Promise<void> {
    if (!passkeyPublicKey || Object.keys(assertion).length === 0) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Passkey assertion is invalid',
      );
    }
  }
}
