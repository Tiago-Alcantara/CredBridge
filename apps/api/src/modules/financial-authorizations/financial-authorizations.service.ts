import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
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

    await this.verifyAssertionForStoredPasskey(
      authorization.user.passkeyPublicKey,
      authorization.user.passkeyId,
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

  private async verifyAssertionForStoredPasskey(
    passkeyPublicKey: string | null,
    passkeyId: string | null,
    assertion: Record<string, unknown>,
    expectedChallenge: string,
  ): Promise<void> {
    if (!passkeyPublicKey || !passkeyId) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Passkey assertion is invalid',
      );
    }

    const response = this.readAuthenticationResponse(assertion);
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin:
        this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000',
      expectedRPID: this.config.get<string>('WEBAUTHN_RP_ID') ?? 'localhost',
      credential: {
        id: passkeyId,
        publicKey: Buffer.from(passkeyPublicKey, 'base64url'),
        counter: 0,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Passkey assertion verification failed',
      );
    }
  }

  private readAuthenticationResponse(
    assertion: Record<string, unknown>,
  ): AuthenticationResponseJSON {
    if (
      !this.isNonEmptyString(assertion.id) ||
      !this.isNonEmptyString(assertion.rawId) ||
      assertion.type !== 'public-key' ||
      !this.isRecord(assertion.response) ||
      !this.isNonEmptyString(assertion.response.clientDataJSON) ||
      !this.isNonEmptyString(assertion.response.authenticatorData) ||
      !this.isNonEmptyString(assertion.response.signature)
    ) {
      throw new FinancialAuthorizationException(
        'authorization_invalid',
        'Passkey assertion is invalid',
      );
    }

    return {
      id: assertion.id,
      rawId: assertion.rawId,
      type: 'public-key',
      response: {
        clientDataJSON: assertion.response.clientDataJSON,
        authenticatorData: assertion.response.authenticatorData,
        signature: assertion.response.signature,
        userHandle: this.isNonEmptyString(assertion.response.userHandle)
          ? assertion.response.userHandle
          : undefined,
      },
      authenticatorAttachment: this.readAuthenticatorAttachment(
        assertion.authenticatorAttachment,
      ),
      clientExtensionResults: this.isRecord(assertion.clientExtensionResults)
        ? assertion.clientExtensionResults
        : {},
    };
  }

  private readAuthenticatorAttachment(value: unknown) {
    return value === 'platform' || value === 'cross-platform'
      ? value
      : undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
  }
}
