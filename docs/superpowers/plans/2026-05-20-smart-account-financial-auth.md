# Smart Account Financial Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require smart account/passkey authorization for CredBridge financial actions while keeping Google/email login as the primary web identity.

**Architecture:** Add a `FinancialAuthorizationsModule` that creates canonical operation payloads, verifies WebAuthn passkey assertions, and consumes authorizations exactly once. Move smart wallet setup from login time to first financial action, then split receivable tokenization from PME assignment so financial consent happens at the correct operation boundary.

**Tech Stack:** NestJS 11, Prisma 7, Jest, Next.js 16, React Query, `passkey-kit`, `@simplewebauthn/browser`, `@simplewebauthn/server`.

**Reference Spec:** `docs/superpowers/specs/2026-05-20-smart-account-financial-auth-design.md`

---

## File Structure

Create the financial authorization backend as a focused module:

```text
apps/api/src/modules/financial-authorizations/
  dto/
    create-financial-authorization-challenge.dto.ts
    verify-financial-authorization.dto.ts
  financial-authorization.errors.ts
  financial-authorization.types.ts
  financial-authorizations.controller.ts
  financial-authorizations.module.ts
  financial-authorizations.service.spec.ts
  financial-authorizations.service.ts
```

Modify existing backend surfaces:

```text
apps/api/package.json
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/20260520120000_add_financial_authorizations/migration.sql
apps/api/src/app.module.ts
apps/api/src/modules/auth/auth.service.ts
apps/api/src/modules/auth/auth.service.spec.ts
apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts
apps/api/src/modules/stellar-wallet/stellar-wallet.module.ts
apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts
apps/api/src/modules/stellar-wallet/stellar-wallet.service.spec.ts
apps/api/src/modules/receivables/receivables.controller.ts
apps/api/src/modules/receivables/receivables.repository.ts
apps/api/src/modules/receivables/receivables.service.ts
apps/api/src/modules/receivables/receivables.service.spec.ts
apps/api/src/modules/investments/dto/create-investment.dto.ts
apps/api/src/modules/investments/investments.service.ts
apps/api/src/modules/investments/investments.service.spec.ts
```

Modify frontend wallet and financial action orchestration:

```text
apps/web/package.json
apps/web/src/lib/wallet/passkey-client.ts
apps/web/src/lib/api/auth.ts
apps/web/src/lib/api/wallet.ts
apps/web/src/lib/api/financial-authorizations.ts
apps/web/src/lib/financial-actions/useFinancialAuthorization.ts
apps/web/src/app/(auth)/login/page.tsx
apps/web/src/components/auth/WalletSetupBanner.tsx
apps/web/src/components/pme/InvoiceTable.tsx
apps/web/src/components/investor/BuyDrawer.tsx
```

---

### Task 1: Add Persistence For Smart Wallet Metadata And Financial Authorizations

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260520120000_add_financial_authorizations/migration.sql`

- [ ] **Step 1: Update Prisma schema**

Add wallet metadata to `User` and a new `FinancialAuthorization` model.

```prisma
model User {
  id                    String   @id @default(uuid())
  email                 String   @unique
  passwordHash          String?
  googleId              String?  @unique
  provider              String   @default("email")
  role                  String?
  name                  String?
  stellarWalletId       String?
  passkeyId             String?
  passkeyPublicKey      String?
  walletType            String?
  walletStatus          String?
  phone                 String?
  address               String?
  companyName           String?
  cnpj                  String?  @unique
  monthlyRevenue        Float?
  sector                String?
  investorType          String?
  riskProfile           String?
  operationalLimit      Float?
  etherfuseCustomerId   String?
  etherfuseBankAccountId String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  receivables           Receivable[] @relation("UserReceivables")
  investments           Investment[] @relation("UserInvestments")
  auditLogs             AuditLog[]   @relation("UserAuditLogs")
  financialAuthorizations FinancialAuthorization[] @relation("UserFinancialAuthorizations")
}

model FinancialAuthorization {
  id           String    @id @default(uuid())
  userId       String
  walletId     String
  operation    String
  resourceId   String?
  amount       String?
  destination  String?
  nonce        String    @unique
  payloadHash  String    @unique
  payload      Json
  signature    Json?
  expiresAt    DateTime
  verifiedAt   DateTime?
  consumedAt   DateTime?
  createdAt    DateTime  @default(now())

  user         User      @relation("UserFinancialAuthorizations", fields: [userId], references: [id])

  @@index([userId, operation])
  @@index([expiresAt])
}
```

- [ ] **Step 2: Add SQL migration**

Create `apps/api/prisma/migrations/20260520120000_add_financial_authorizations/migration.sql`:

```sql
ALTER TABLE "User" ADD COLUMN "passkeyPublicKey" TEXT;
ALTER TABLE "User" ADD COLUMN "walletType" TEXT;
ALTER TABLE "User" ADD COLUMN "walletStatus" TEXT;

CREATE TABLE "FinancialAuthorization" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "resourceId" TEXT,
    "amount" TEXT,
    "destination" TEXT,
    "nonce" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialAuthorization_nonce_key" ON "FinancialAuthorization"("nonce");
CREATE UNIQUE INDEX "FinancialAuthorization_payloadHash_key" ON "FinancialAuthorization"("payloadHash");
CREATE INDEX "FinancialAuthorization_userId_operation_idx" ON "FinancialAuthorization"("userId", "operation");
CREATE INDEX "FinancialAuthorization_expiresAt_idx" ON "FinancialAuthorization"("expiresAt");

ALTER TABLE "FinancialAuthorization"
ADD CONSTRAINT "FinancialAuthorization_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Generate Prisma client**

Run:

```bash
npm run build -w apps/api
```

Expected: Prisma client generation succeeds. Nest build may still fail until later tasks add code using new fields consistently; if it fails only because TypeScript references from later tasks are absent, continue to Task 2.

- [ ] **Step 4: Commit schema changes**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260520120000_add_financial_authorizations/migration.sql
git commit -m "feat(api): add financial authorization persistence"
```

---

### Task 2: Add Financial Authorization Module Skeleton And Operation Policy

**Files:**
- Create: `apps/api/src/modules/financial-authorizations/financial-authorization.types.ts`
- Create: `apps/api/src/modules/financial-authorizations/financial-authorization.errors.ts`
- Create: `apps/api/src/modules/financial-authorizations/dto/create-financial-authorization-challenge.dto.ts`
- Create: `apps/api/src/modules/financial-authorizations/dto/verify-financial-authorization.dto.ts`
- Create: `apps/api/src/modules/financial-authorizations/financial-authorizations.module.ts`
- Create: `apps/api/src/modules/financial-authorizations/financial-authorizations.controller.ts`
- Create: `apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts`
- Create: `apps/api/src/modules/financial-authorizations/financial-authorizations.service.spec.ts`
- Modify: `apps/api/src/modules/audit/audit.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Add dependency**

In `apps/api/package.json`, add:

```json
"@simplewebauthn/server": "^13.1.2"
```

Run:

```bash
npm install
```

Expected: lockfile updates and dependency installs.

- [ ] **Step 2: Define operation and payload types**

Create `financial-authorization.types.ts`:

```ts
export const FINANCIAL_AUTH_DOMAIN = 'credbridge.finance.authorization';
export const FINANCIAL_AUTH_VERSION = '1';

export type FinancialOperation =
  | 'receivable.tokenize'
  | 'receivable.assignment'
  | 'pme.withdrawal'
  | 'investor.deposit'
  | 'investment.purchase'
  | 'investor.withdrawal';

export const DIRECT_AUTH_OPERATIONS = new Set<FinancialOperation>([
  'receivable.assignment',
  'pme.withdrawal',
  'investor.deposit',
  'investment.purchase',
  'investor.withdrawal',
]);

export interface FinancialAuthorizationPayload {
  domain: typeof FINANCIAL_AUTH_DOMAIN;
  version: typeof FINANCIAL_AUTH_VERSION;
  network: string;
  operation: FinancialOperation;
  userId: string;
  walletId: string;
  resourceId: string | null;
  amount: string | null;
  destination: string | null;
  nonce: string;
  expiresAt: string;
}

export interface FinancialAuthorizationConsumption {
  authorizationId: string;
  userId: string;
  operation: FinancialOperation;
  resourceId?: string | null;
  amount?: string | null;
  destination?: string | null;
}
```

- [ ] **Step 3: Define error class**

Create `financial-authorization.errors.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

export type FinancialAuthorizationErrorCode =
  | 'wallet_required'
  | 'authorization_required'
  | 'authorization_expired'
  | 'authorization_invalid'
  | 'authorization_already_used'
  | 'authorization_operation_mismatch'
  | 'authorization_resource_mismatch';

export class FinancialAuthorizationException extends BadRequestException {
  constructor(code: FinancialAuthorizationErrorCode, message: string) {
    super({ code, message });
  }
}
```

- [ ] **Step 4: Add DTOs**

Create `create-financial-authorization-challenge.dto.ts`:

```ts
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { FinancialOperation } from '../financial-authorization.types';

const OPERATIONS: FinancialOperation[] = [
  'receivable.tokenize',
  'receivable.assignment',
  'pme.withdrawal',
  'investor.deposit',
  'investment.purchase',
  'investor.withdrawal',
];

export class CreateFinancialAuthorizationChallengeDto {
  @IsIn(OPERATIONS)
  operation!: FinancialOperation;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  resourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  amount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  destination?: string;
}
```

Create `verify-financial-authorization.dto.ts`:

```ts
import { IsObject, IsString, IsUUID } from 'class-validator';

export class VerifyFinancialAuthorizationDto {
  @IsUUID()
  authorizationId!: string;

  @IsString()
  payloadHash!: string;

  @IsObject()
  assertion!: Record<string, unknown>;
}
```

- [ ] **Step 5: Write failing service tests**

Create `financial-authorizations.service.spec.ts` with tests for operation policy, wallet requirement, unique payload creation, expiration, mismatch, and single-use consumption.

```ts
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { FinancialAuthorizationException } from './financial-authorization.errors';
import { FinancialAuthorizationsService } from './financial-authorizations.service';

const userId = 'user-1';
const walletId = 'CCONTRACT123';

describe('FinancialAuthorizationsService', () => {
  let service: FinancialAuthorizationsService;

  const prismaMock = {
    user: { findUnique: jest.fn() },
    financialAuthorization: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialAuthorizationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'testnet') } },
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

  it('throws wallet_required when the user has no ready smart account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ stellarWalletId: null });

    await expect(
      service.createChallenge(userId, { operation: 'investment.purchase', resourceId: 'r-1' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'wallet_required' }),
    });
  });

  it('creates a canonical challenge with a nonce and payload hash', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      stellarWalletId: walletId,
      passkeyId: 'key-1',
      passkeyPublicKey: 'public-key',
      walletType: 'smart_account',
      walletStatus: 'ready',
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
    expect(result.payload.nonce).toHaveLength(36);
    expect(result.payloadHash).toHaveLength(64);
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
});
```

- [ ] **Step 6: Run test to verify it fails**

Run:

```bash
npm test -w apps/api -- financial-authorizations.service.spec.ts --runInBand
```

Expected: FAIL because `FinancialAuthorizationsService` does not exist.

- [ ] **Step 7: Implement service**

Create `financial-authorizations.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../shared/prisma/prisma.service';
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

    await this.prisma.financialAuthorization.update({
      where: { id: authorization.id },
      data: { consumedAt: new Date() },
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
```

The private `verifyAssertionForStoredPasskey` starts with structural validation in this task. Task 6 replaces it with `@simplewebauthn/server` verification once the frontend assertion shape is wired in tests.

- [ ] **Step 8: Allow authorization audit entity type**

In `apps/api/src/modules/audit/audit.service.ts`, extend the union:

```ts
export interface AuditLogInput {
  event: string;
  entityId: string;
  entityType: 'receivable' | 'document' | 'settlement' | 'user' | 'financial_authorization';
  userId: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
}
```

- [ ] **Step 9: Add audit logging to financial authorization service**

Update `FinancialAuthorizationsService` imports:

```ts
import { AuditService } from '../audit/audit.service';
```

Update constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly config: ConfigService,
  private readonly audit: AuditService,
) {}
```

After creating an authorization in `createChallenge`, add:

```ts
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
```

Before throwing `wallet_required` in `createChallenge`, add:

```ts
await this.audit.log({
  event: 'wallet.setup_required',
  entityId: userId,
  entityType: 'user',
  userId,
  metadata: { operation: dto.operation, resourceId: dto.resourceId ?? null },
});
```

After successful update in `verify`, add:

```ts
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
```

After successful `consume` update, add:

```ts
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
```

Update `financial-authorizations.service.spec.ts` provider setup:

```ts
{ provide: AuditService, useValue: { log: jest.fn() } },
```

- [ ] **Step 10: Add controller and module**

Create `financial-authorizations.controller.ts`:

```ts
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFinancialAuthorizationChallengeDto } from './dto/create-financial-authorization-challenge.dto';
import { VerifyFinancialAuthorizationDto } from './dto/verify-financial-authorization.dto';
import { FinancialAuthorizationsService } from './financial-authorizations.service';

interface AuthRequest {
  user: { userId: string };
}

@Controller('financial-authorizations')
@UseGuards(JwtAuthGuard)
export class FinancialAuthorizationsController {
  constructor(private readonly service: FinancialAuthorizationsService) {}

  @Post('challenge')
  createChallenge(
    @Req() req: AuthRequest,
    @Body() body: CreateFinancialAuthorizationChallengeDto,
  ) {
    return this.service.createChallenge(req.user.userId, body);
  }

  @Post('verify')
  verify(@Req() req: AuthRequest, @Body() body: VerifyFinancialAuthorizationDto) {
    return this.service.verify(req.user.userId, body);
  }
}
```

Create `financial-authorizations.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FinancialAuthorizationsController } from './financial-authorizations.controller';
import { FinancialAuthorizationsService } from './financial-authorizations.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FinancialAuthorizationsController],
  providers: [FinancialAuthorizationsService],
  exports: [FinancialAuthorizationsService],
})
export class FinancialAuthorizationsModule {}
```

Update `apps/api/src/app.module.ts`:

```ts
import { FinancialAuthorizationsModule } from './modules/financial-authorizations/financial-authorizations.module';
```

Add `FinancialAuthorizationsModule` to the `imports` array.

- [ ] **Step 11: Run tests**

Run:

```bash
npm test -w apps/api -- financial-authorizations.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 12: Commit module skeleton**

```bash
git add apps/api/package.json package-lock.json apps/api/src/app.module.ts apps/api/src/modules/audit/audit.service.ts apps/api/src/modules/financial-authorizations
git commit -m "feat(api): add financial authorization module"
```

---

### Task 3: Store Smart Wallet Credentials And Stop Creating Wallets At Login

**Files:**
- Modify: `apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts`
- Modify: `apps/api/src/modules/stellar-wallet/stellar-wallet.module.ts`
- Modify: `apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts`
- Modify: `apps/api/src/modules/stellar-wallet/stellar-wallet.service.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts`
- Modify: `apps/web/src/app/(auth)/login/page.tsx`
- Modify: `apps/web/src/lib/wallet/passkey-client.ts`
- Modify: `apps/web/src/lib/api/wallet.ts`

- [ ] **Step 1: Update wallet DTO**

Change `CreateWalletDto` to accept passkey public key:

```ts
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^C[A-Z0-9]+$/)
  contractId!: string;

  @IsString()
  @IsNotEmpty()
  keyId!: string;

  @IsString()
  @IsNotEmpty()
  publicKey!: string;
}
```

- [ ] **Step 2: Update wallet service tests**

In `stellar-wallet.service.spec.ts`, change the first test expectation:

```ts
const input = {
  contractId: 'CCONTRACT123',
  keyId: 'key-abc',
  publicKey: 'public-key-base64',
};

const result = await service.createWallet('user-1', input);

expect(prismaMock.user.update).toHaveBeenCalledWith({
  where: { id: 'user-1' },
  data: {
    stellarWalletId: 'CCONTRACT123',
    passkeyId: 'key-abc',
    passkeyPublicKey: 'public-key-base64',
    walletType: 'smart_account',
    walletStatus: 'ready',
  },
});
expect(result).toEqual({ contractId: 'CCONTRACT123' });
```

Update the idempotency and not-found tests to include `publicKey` in the input object.

- [ ] **Step 3: Update wallet service implementation**

In `apps/api/src/modules/stellar-wallet/stellar-wallet.module.ts`, import `AuditModule`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { StellarWalletController } from './stellar-wallet.controller';
import { StellarWalletService } from './stellar-wallet.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [StellarWalletController],
  providers: [StellarWalletService],
})
export class StellarWalletModule {}
```

In `StellarWalletService`, inject `AuditService`:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly audit: AuditService,
) {}
```

Update the spec provider list:

```ts
{ provide: AuditService, useValue: { log: jest.fn() } },
```

In `StellarWalletService.createWallet`, update the `data` object:

```ts
const updated = await this.prisma.user.update({
  where: { id: userId },
  data: {
    stellarWalletId: dto.contractId,
    passkeyId: dto.keyId,
    passkeyPublicKey: dto.publicKey,
    walletType: 'smart_account',
    walletStatus: 'ready',
  },
});

await this.audit.log({
  event: 'wallet.setup_completed',
  entityId: userId,
  entityType: 'user',
  userId,
  metadata: {
    walletId: updated.stellarWalletId,
    walletType: updated.walletType,
  },
});
```

In `getWallet`, select and return:

```ts
select: {
  stellarWalletId: true,
  passkeyId: true,
  walletType: true,
  walletStatus: true,
},
```

Return:

```ts
return {
  contractId: user.stellarWalletId,
  passkeyId: user.passkeyId,
  walletType: user.walletType,
  walletStatus: user.walletStatus,
};
```

- [ ] **Step 4: Remove wallet creation from auth login flows**

In `AuthService.register`, remove the `try { createCustodialWallet ... }` block after user creation. Return `issueToken` directly.

In `AuthService.googleLogin`, remove the block that calls `this.blockchain.createCustodialWallet(googleId)`. Keep the response shape, but return the current stored `stellarWalletId`:

```ts
const tokenResult = await this.issueToken(user.id, user.email, user.role);
return {
  ...tokenResult,
  user: { ...tokenResult.user, stellarWalletId: user.stellarWalletId ?? null },
  needsRoleSelection: user.role === null,
};
```

Update auth tests:

```ts
it('does not create a wallet during google login', async () => {
  prismaMock.user.findUnique.mockResolvedValue(googleUser);
  const result = await service.googleLogin('fake-id-token');
  expect(blockchainMock.createCustodialWallet).not.toHaveBeenCalled();
  expect(result.user.stellarWalletId).toBeNull();
});
```

- [ ] **Step 5: Update passkey client return shape**

In `apps/web/src/lib/wallet/passkey-client.ts`, return public key from `rawResponse.response.publicKey`:

```ts
export async function registerAndDeployWallet(
  userEmail: string,
): Promise<{ contractId: string; keyId: string; publicKey: string }> {
  // existing code...
  const publicKey = createResult.rawResponse.response.publicKey;
  if (!publicKey) {
    throw new Error('passkey-kit did not return a passkey public key');
  }
  return { contractId, keyId: keyIdBase64, publicKey };
}
```

- [ ] **Step 6: Update wallet API hook**

In `apps/web/src/lib/api/wallet.ts`:

```ts
interface WalletInfo {
  contractId: string;
  passkeyId: string | null;
  walletType: string | null;
  walletStatus: string | null;
}

interface CreateWalletInput {
  contractId: string;
  keyId: string;
  publicKey: string;
}
```

- [ ] **Step 7: Remove login-time wallet setup from login page**

In `apps/web/src/app/(auth)/login/page.tsx`:

- remove imports of `registerAndDeployWallet`, `PasskeyAbortedError`, and `useCreateWallet`;
- remove `createWalletMutation` and `walletSetting` state;
- remove the `if (!data.user.stellarWalletId) { ... }` setup block from `handleGoogleSuccess`;
- remove "Configurando sua carteira Stellar..." login text.

Keep Google/email routing unchanged.

- [ ] **Step 8: Run tests**

Run:

```bash
npm test -w apps/api -- auth.service.spec.ts stellar-wallet.service.spec.ts --runInBand
npm run build -w apps/web
```

Expected: API tests PASS. Web build PASS.

- [ ] **Step 9: Commit wallet/login changes**

```bash
git add apps/api/src/modules/auth apps/api/src/modules/stellar-wallet apps/web/src/app/'(auth)'/login/page.tsx apps/web/src/lib/api/wallet.ts apps/web/src/lib/wallet/passkey-client.ts
git commit -m "feat(auth): defer smart wallet setup to financial actions"
```

---

### Task 4: Split Receivable Tokenization From PME Assignment

**Files:**
- Modify: `apps/api/src/modules/receivables/receivables.controller.ts`
- Modify: `apps/api/src/modules/receivables/receivables.repository.ts`
- Modify: `apps/api/src/modules/receivables/receivables.service.ts`
- Modify: `apps/api/src/modules/receivables/receivables.service.spec.ts`

- [ ] **Step 1: Add repository methods**

In `ReceivablesRepository`, add:

```ts
async setTokenized(id: string, txHash: string) {
  return this.prisma.receivable.update({
    where: { id },
    data: { status: 'tokenized', txHash },
  });
}

async setAssignmentPending(id: string) {
  return this.prisma.receivable.update({
    where: { id },
    data: { status: 'assignment_pending' },
  });
}

async setActive(id: string) {
  return this.prisma.receivable.update({
    where: { id },
    data: { status: 'active' },
  });
}
```

Update `getPoolStats` validated count to count both `validated` and `tokenized` if the UI still displays non-active pipeline stats:

```ts
where: { status: { in: ['validated', 'tokenized', 'assignment_pending'] }, investment: null },
```

- [ ] **Step 2: Update service constructor**

Inject `FinancialAuthorizationsService`:

```ts
constructor(
  private readonly repo: ReceivablesRepository,
  private readonly audit: AuditService,
  @Inject(BLOCKCHAIN_SERVICE) private readonly blockchain: BlockchainService,
  private readonly financialAuthorizations: FinancialAuthorizationsService,
) {}
```

Import `FinancialAuthorizationsService` from `../financial-authorizations/financial-authorizations.service`.

- [ ] **Step 3: Replace `activate` with tokenization and assignment methods**

In `ReceivablesService`, create:

```ts
async tokenize(id: string) {
  const receivable = await this.repo.findOne(id);
  if (!receivable) throw new NotFoundException(`Receivable ${id} not found`);
  if (receivable.status !== 'validated') {
    throw new ConflictException('Receivable must be validated before tokenization');
  }

  const txHash = await this.blockchain.tokenizeNfe({
    key: receivable.id,
    value: receivable.value,
    dueDate: receivable.dueDate,
    xmlHash: receivable.documentHash ?? null,
    ownerUserId: receivable.userId,
  });

  const tokenized = await this.repo.setTokenized(id, txHash);

  await this.audit.log({
    event: 'receivable.tokenized_by_policy',
    entityId: receivable.id,
    entityType: 'receivable',
    userId: receivable.userId,
    txHash,
    metadata: { network: 'stellar', authorization: 'policy' },
  });

  return toReceivableResponse(tokenized);
}

async requestAssignment(id: string) {
  const receivable = await this.repo.findOne(id);
  if (!receivable) throw new NotFoundException(`Receivable ${id} not found`);
  if (receivable.status !== 'tokenized') {
    throw new ConflictException('Receivable must be tokenized before assignment');
  }
  const updated = await this.repo.setAssignmentPending(id);
  return toReceivableResponse(updated);
}

async assign(id: string, authorizationId: string) {
  const receivable = await this.repo.findOne(id);
  if (!receivable) throw new NotFoundException(`Receivable ${id} not found`);
  if (receivable.status !== 'tokenized' && receivable.status !== 'assignment_pending') {
    throw new ConflictException('Receivable must be tokenized before assignment');
  }

  await this.financialAuthorizations.consume({
    authorizationId,
    userId: receivable.userId,
    operation: 'receivable.assignment',
    resourceId: receivable.id,
    amount: receivable.value.toFixed(2),
    destination: 'credbridge-pool',
  });

  const updated = await this.repo.setActive(id);

  await this.audit.log({
    event: 'receivable.assignment_signed',
    entityId: receivable.id,
    entityType: 'receivable',
    userId: receivable.userId,
    metadata: { authorizationId },
  });

  return toReceivableResponse(updated);
}
```

Keep the old `activate(id)` method as a compatibility wrapper that calls `tokenize(id)` only if existing UI still calls it during this task:

```ts
async activate(id: string) {
  return this.tokenize(id);
}
```

- [ ] **Step 4: Update controller routes**

In `ReceivablesController`, add:

```ts
@Patch(':id/tokenize')
tokenize(@Param('id') id: string) {
  return this.receivablesService.tokenize(id);
}

@Patch(':id/request-assignment')
requestAssignment(@Param('id') id: string) {
  return this.receivablesService.requestAssignment(id);
}

@Patch(':id/assign')
assign(@Param('id') id: string, @Body() body: { authorizationId: string }) {
  return this.receivablesService.assign(id, body.authorizationId);
}
```

Change existing `activate` route to call `tokenize` or leave it as a backward-compatible alias during frontend migration.

- [ ] **Step 5: Update service tests**

Add tests:

```ts
it('tokenizes a validated receivable without direct financial authorization', async () => {
  repo.findOne.mockResolvedValue(baseReceivable({ status: 'validated' }));
  blockchain.tokenizeNfe.mockResolvedValue('tokenize-hash');
  repo.setTokenized.mockResolvedValue(baseReceivable({ status: 'tokenized', txHash: 'tokenize-hash' }));

  await service.tokenize(receivableId);

  expect(financialAuthorizations.consume).not.toHaveBeenCalled();
  expect(blockchain.tokenizeNfe).toHaveBeenCalled();
  expect(repo.setTokenized).toHaveBeenCalledWith(receivableId, 'tokenize-hash');
});

it('requires a consumed receivable.assignment authorization before assigning', async () => {
  repo.findOne.mockResolvedValue(baseReceivable({ status: 'tokenized', value: 1000 }));
  repo.setActive.mockResolvedValue(baseReceivable({ status: 'active' }));

  await service.assign(receivableId, 'auth-1');

  expect(financialAuthorizations.consume).toHaveBeenCalledWith({
    authorizationId: 'auth-1',
    userId: pmeId,
    operation: 'receivable.assignment',
    resourceId: receivableId,
    amount: '1000.00',
    destination: 'credbridge-pool',
  });
  expect(repo.setActive).toHaveBeenCalledWith(receivableId);
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -w apps/api -- receivables.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit receivable flow**

```bash
git add apps/api/src/modules/receivables
git commit -m "feat(receivables): split tokenization and signed assignment"
```

---

### Task 5: Require Financial Authorization For Investor Purchases

**Files:**
- Modify: `apps/api/src/modules/investments/dto/create-investment.dto.ts`
- Modify: `apps/api/src/modules/investments/investments.service.ts`
- Modify: `apps/api/src/modules/investments/investments.service.spec.ts`
- Modify: `apps/api/src/modules/investments/investments.module.ts`

- [ ] **Step 1: Add authorization id to DTO**

In `CreateInvestmentDto`:

```ts
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInvestmentDto {
  @IsUUID()
  receivableId!: string;

  @IsUUID()
  authorizationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pixTxId?: string;
}
```

- [ ] **Step 2: Import module**

In `InvestmentsModule`, import `FinancialAuthorizationsModule`.

```ts
import { FinancialAuthorizationsModule } from '../financial-authorizations/financial-authorizations.module';

@Module({
  imports: [FinancialAuthorizationsModule],
  // existing metadata
})
export class InvestmentsModule {}
```

- [ ] **Step 3: Inject authorization service**

In `InvestmentsService` constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly repo: InvestmentsRepository,
  @Inject(BLOCKCHAIN_SERVICE)
  private readonly blockchain: BlockchainService,
  private readonly financialAuthorizations: FinancialAuthorizationsService,
) {}
```

- [ ] **Step 4: Consume authorization before blockchain movement**

After the database transaction returns `investment`, before `chargeInvestor`, add:

```ts
await this.financialAuthorizations.consume({
  authorizationId: dto.authorizationId,
  userId: investorUserId,
  operation: 'investment.purchase',
  resourceId: investment.receivableId,
  amount: investment.amountPaid.toFixed(2),
  destination: null,
});
```

- [ ] **Step 5: Update tests**

Add mock:

```ts
const financialAuthorizationsMock = {
  consume: jest.fn().mockResolvedValue(undefined),
};
```

Add provider:

```ts
{
  provide: FinancialAuthorizationsService,
  useValue: financialAuthorizationsMock,
}
```

Update successful call:

```ts
await service.create(investorId, { receivableId, authorizationId: 'auth-1' });

expect(financialAuthorizationsMock.consume).toHaveBeenCalledWith({
  authorizationId: 'auth-1',
  userId: investorId,
  operation: 'investment.purchase',
  resourceId: receivableId,
  amount: '97000.00',
  destination: null,
});
```

Add rejection test:

```ts
it('does not charge investor when authorization consumption fails', async () => {
  repo.findReceivableForUpdate.mockResolvedValue(baseReceivable());
  repo.createInvestment.mockResolvedValue({ id: 'inv-row-1' } as never);
  financialAuthorizationsMock.consume.mockRejectedValue(new Error('authorization_required'));

  await expect(
    service.create(investorId, { receivableId, authorizationId: 'auth-1' }),
  ).rejects.toThrow('authorization_required');

  expect(blockchain.chargeInvestor).not.toHaveBeenCalled();
  expect(blockchain.transferNftToInvestor).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -w apps/api -- investments.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit investment authorization**

```bash
git add apps/api/src/modules/investments
git commit -m "feat(investments): require signed purchase authorization"
```

---

### Task 6: Wire Real WebAuthn Assertion Verification

**Files:**
- Modify: `apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts`
- Modify: `apps/api/src/modules/financial-authorizations/financial-authorizations.service.spec.ts`
- Modify: `apps/web/src/lib/wallet/passkey-client.ts`
- Create: `apps/web/src/lib/api/financial-authorizations.ts`
- Create: `apps/web/src/lib/financial-actions/useFinancialAuthorization.ts`

- [ ] **Step 1: Add frontend signing helper**

In `passkey-client.ts`, add:

```ts
import { startAuthentication } from '@simplewebauthn/browser';

export async function signFinancialAuthorization(
  payloadHash: string,
  keyId?: string | null,
): Promise<Record<string, unknown>> {
  const response = await startAuthentication({
    optionsJSON: {
      challenge: payloadHash,
      rpId: window.location.hostname,
      allowCredentials: keyId
        ? [{ id: keyId, type: 'public-key' }]
        : undefined,
      userVerification: 'preferred',
    },
  });
  return response as unknown as Record<string, unknown>;
}
```

- [ ] **Step 2: Add frontend API hooks**

Create `apps/web/src/lib/api/financial-authorizations.ts`:

```ts
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';

export type FinancialOperation =
  | 'receivable.tokenize'
  | 'receivable.assignment'
  | 'pme.withdrawal'
  | 'investor.deposit'
  | 'investment.purchase'
  | 'investor.withdrawal';

export interface FinancialAuthorizationPayload {
  domain: string;
  version: string;
  network: string;
  operation: FinancialOperation;
  userId: string;
  walletId: string;
  resourceId: string | null;
  amount: string | null;
  destination: string | null;
  nonce: string;
  expiresAt: string;
}

export interface CreateFinancialAuthorizationInput {
  operation: FinancialOperation;
  resourceId?: string;
  amount?: string;
  destination?: string;
}

export interface FinancialAuthorizationChallenge {
  authorizationId: string;
  payload: FinancialAuthorizationPayload;
  payloadHash: string;
  expiresAt: string;
}

export function useCreateFinancialAuthorizationChallenge() {
  return useMutation({
    mutationFn: (input: CreateFinancialAuthorizationInput) =>
      apiFetch<FinancialAuthorizationChallenge>('/financial-authorizations/challenge', {
        method: 'POST',
        body: input,
      }),
  });
}

export function useVerifyFinancialAuthorization() {
  return useMutation({
    mutationFn: (input: {
      authorizationId: string;
      payloadHash: string;
      assertion: Record<string, unknown>;
    }) =>
      apiFetch<{ authorizationId: string; verified: true }>('/financial-authorizations/verify', {
        method: 'POST',
        body: input,
      }),
  });
}
```

- [ ] **Step 3: Add orchestration hook**

Create `apps/web/src/lib/financial-actions/useFinancialAuthorization.ts`:

```ts
import { useCallback, useState } from 'react';
import { useGetWallet, useCreateWallet } from '@/lib/api/wallet';
import {
  CreateFinancialAuthorizationInput,
  useCreateFinancialAuthorizationChallenge,
  useVerifyFinancialAuthorization,
} from '@/lib/api/financial-authorizations';
import {
  registerAndDeployWallet,
  signFinancialAuthorization,
} from '@/lib/wallet/passkey-client';

export function useFinancialAuthorization(userEmail?: string | null) {
  const { data: wallet, refetch } = useGetWallet();
  const createWallet = useCreateWallet();
  const createChallenge = useCreateFinancialAuthorizationChallenge();
  const verifyAuthorization = useVerifyFinancialAuthorization();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const authorize = useCallback(
    async (input: CreateFinancialAuthorizationInput): Promise<string> => {
      if (!userEmail) throw new Error('User email is required for wallet setup');
      setIsAuthorizing(true);
      try {
        let currentWallet = wallet;
        if (!currentWallet || currentWallet.walletType !== 'smart_account') {
          const created = await registerAndDeployWallet(userEmail);
          await createWallet.mutateAsync(created);
          const refreshed = await refetch();
          currentWallet = refreshed.data;
        }
        const challenge = await createChallenge.mutateAsync(input);
        const assertion = await signFinancialAuthorization(
          challenge.payloadHash,
          currentWallet?.passkeyId,
        );
        const verified = await verifyAuthorization.mutateAsync({
          authorizationId: challenge.authorizationId,
          payloadHash: challenge.payloadHash,
          assertion,
        });
        return verified.authorizationId;
      } finally {
        setIsAuthorizing(false);
      }
    },
    [createChallenge, createWallet, refetch, userEmail, verifyAuthorization, wallet],
  );

  return { authorize, isAuthorizing };
}
```

- [ ] **Step 4: Replace backend structural assertion with SimpleWebAuthn verification**

In `FinancialAuthorizationsService`, import:

```ts
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
```

Replace `verifyAssertionForStoredPasskey` with:

```ts
private async verifyAssertionForStoredPasskey(
  passkeyPublicKey: string | null,
  assertion: Record<string, unknown>,
  expectedChallenge: string,
): Promise<void> {
  if (!passkeyPublicKey) {
    throw new FinancialAuthorizationException(
      'authorization_invalid',
      'Stored passkey public key is missing',
    );
  }

  const verification = await verifyAuthenticationResponse({
    response: assertion as never,
    expectedChallenge,
    expectedOrigin: this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000',
    expectedRPID: this.config.get<string>('WEBAUTHN_RP_ID') ?? 'localhost',
    credential: {
      id: String(assertion.id ?? ''),
      publicKey: Buffer.from(passkeyPublicKey, 'base64url'),
      counter: 0,
      transports: undefined,
    },
  });

  if (!verification.verified) {
    throw new FinancialAuthorizationException(
      'authorization_invalid',
      'Passkey assertion verification failed',
    );
  }
}
```

Update call site:

```ts
await this.verifyAssertionForStoredPasskey(
  authorization.user.passkeyPublicKey,
  dto.assertion,
  authorization.payloadHash,
);
```

- [ ] **Step 5: Mock verification in service tests**

At top of `financial-authorizations.service.spec.ts`:

```ts
jest.mock('@simplewebauthn/server', () => ({
  verifyAuthenticationResponse: jest.fn().mockResolvedValue({ verified: true }),
}));
```

Add a test that `verify` stores the assertion when the payload hash matches.

- [ ] **Step 6: Run verification tests and web build**

Run:

```bash
npm test -w apps/api -- financial-authorizations.service.spec.ts --runInBand
npm run build -w apps/web
```

Expected: PASS.

- [ ] **Step 7: Commit WebAuthn verification**

```bash
git add apps/api/src/modules/financial-authorizations apps/web/src/lib/api/financial-authorizations.ts apps/web/src/lib/financial-actions/useFinancialAuthorization.ts apps/web/src/lib/wallet/passkey-client.ts apps/api/package.json package-lock.json
git commit -m "feat(wallet): verify financial passkey authorizations"
```

---

### Task 7: Connect Frontend Financial Actions To Authorization Flow

**Files:**
- Modify: `apps/web/src/components/auth/WalletSetupBanner.tsx`
- Modify: `apps/web/src/components/pme/InvoiceTable.tsx`
- Modify: `apps/web/src/components/investor/BuyDrawer.tsx`
- Modify: `apps/web/src/lib/api/receivables.ts`
- Modify: `apps/web/src/lib/api/investments.ts`

- [x] **Step 1: Update receivables API**

In `apps/web/src/lib/api/receivables.ts`, add mutations:

```ts
export function useTokenizeReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Receivable>(`/receivables/${id}/tokenize`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useAssignReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; authorizationId: string }) =>
      apiFetch<Receivable>(`/receivables/${input.id}/assign`, {
        method: 'PATCH',
        body: { authorizationId: input.authorizationId },
      }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
```

- [x] **Step 2: Update investments API**

In `apps/web/src/lib/api/investments.ts`, require authorization id in purchase input:

```ts
export interface CreateInvestmentInput {
  receivableId: string;
  authorizationId: string;
  pixTxId?: string;
}
```

Ensure the mutation posts the full input body.

- [x] **Step 3: Update PME invoice action**

In `InvoiceTable.tsx`, for validated notes call `useTokenizeReceivable`. For tokenized or assignment-pending notes, call `useFinancialAuthorization(me.email)` with:

```ts
const authorizationId = await authorize({
  operation: 'receivable.assignment',
  resourceId: invoice.id,
  amount: invoice.value.toFixed(2),
  destination: 'credbridge-pool',
});
await assignReceivable.mutateAsync({ id: invoice.id, authorizationId });
```

Button labels:

```ts
const actionLabel =
  invoice.status === 'validated'
    ? 'Tokenizar'
    : invoice.status === 'tokenized' || invoice.status === 'assignment_pending'
      ? 'Assinar cessão'
      : 'Ativa';
```

- [x] **Step 4: Update investor buy flow**

In `BuyDrawer.tsx`, before calling create investment:

```ts
const authorizationId = await authorize({
  operation: 'investment.purchase',
  resourceId: selectedPool.id,
  amount: amountPaid.toFixed(2),
});

await createInvestment.mutateAsync({
  receivableId: selectedPool.id,
  authorizationId,
});
```

- [x] **Step 5: Update wallet banner**

Keep `WalletSetupBanner` as a manual setup option, but pass public key to `createWallet`:

```ts
const { contractId, keyId, publicKey } = await registerAndDeployWallet(me.email);
await createWallet.mutateAsync({ contractId, keyId, publicKey });
```

- [x] **Step 6: Run frontend build**

Run:

```bash
npm run build -w apps/web
```

Expected: PASS.

- [x] **Step 7: Commit frontend action wiring**

```bash
git add apps/web/src/components/auth/WalletSetupBanner.tsx apps/web/src/components/pme/InvoiceTable.tsx apps/web/src/components/investor/BuyDrawer.tsx apps/web/src/lib/api/receivables.ts apps/web/src/lib/api/investments.ts
git commit -m "feat(web): require passkey consent for financial actions"
```

---

### Task 8: Final Verification And Documentation Touches

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [x] **Step 1: Add env vars**

In `.env.example`, add:

```env
WEB_ORIGIN=http://localhost:3000
WEBAUTHN_RP_ID=localhost
```

- [x] **Step 2: Run backend test suite**

Run:

```bash
npm test -w apps/api -- --runInBand
```

Expected: PASS.

- [x] **Step 3: Run backend build**

Run:

```bash
npm run build -w apps/api
```

Expected: PASS.

- [x] **Step 4: Run frontend build**

Run:

```bash
npm run build -w apps/web
```

Expected: PASS.

- [ ] **Step 5: Manual smoke test**

Run API and web dev servers:

```bash
npm run dev -w apps/api
npm run dev -w apps/web
```

Manual checks:

1. Login with Google/email reaches dashboard without wallet prompt.
2. First PME assignment action opens wallet setup if no smart account exists.
3. Cancelling passkey setup leaves receivable unchanged.
4. Tokenizing a validated note does not request signature.
5. Assigning a tokenized note requests signature and moves it to `active`.
6. Investor purchase requests signature before purchase mutation.
7. Reusing an authorization id returns `authorization_already_used`.

- [x] **Step 6: Commit verification docs/env changes**

```bash
git add .env.example README.md
git commit -m "docs: document financial auth environment"
```

If `README.md` does not have an environment section, add a short `Financial authorization env` section containing the same two variables and their local defaults.

---

## Plan Self-Review

Spec coverage:

- Login remains Google/email first: Task 3 removes login-time wallet setup.
- First financial action requires smart wallet setup: Tasks 6 and 7 add the frontend authorization hook.
- Receivable tokenization and assignment split: Task 4.
- PME assignment direct authorization: Task 4 plus Task 7.
- Investor purchase direct authorization: Task 5 plus Task 7.
- Nonce, expiry, payload hash, single-use: Tasks 1 and 2.
- Shared backend boundary: Task 2.
- Audit lifecycle: Task 2 logs challenge creation, verification, and consumption; Task 3 logs wallet setup through the existing wallet endpoint after it is updated; Task 4 logs receivable tokenization and assignment.
- OpenZeppelin compatibility: preserved by operation enum and service boundary.

Implementation risk:

- `@simplewebauthn/server` input shape may need small type adjustments based on installed version. Keep all type adaptation inside `FinancialAuthorizationsService.verifyAssertionForStoredPasskey`.
- `passkey-kit` registration must expose `rawResponse.response.publicKey`. If the installed version does not return it, switch `registerAndDeployWallet` to `createKey()` plus wallet deployment flow in the same file and preserve the API return `{ contractId, keyId, publicKey }`.
