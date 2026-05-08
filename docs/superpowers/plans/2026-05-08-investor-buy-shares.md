# Investor Buy Shares Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable investors to purchase receivables from the pool with a simulated Pix payment, view their positions on the dashboard, and have the pool exclude bought receivables.

**Architecture:** New `Investment` Prisma model with a 1:1 relation to `Receivable`. Dedicated NestJS `InvestmentsModule` with controller, service, repository. React UI uses a drawer-based 3-step buy flow (resumo → Pix mock → sucesso) with a Pool/MinhasCotas toggle on the dashboard table. All UI reuses existing design system tokens and primitives.

**Tech Stack:** Prisma + Postgres, NestJS 11 (Jest tests), Next.js (React Server/Client components), TanStack Query, class-validator, JWT auth.

**Reference spec:** `docs/superpowers/specs/2026-05-08-investor-buy-shares-design.md`

---

## File Structure

### New files

```
apps/api/prisma/migrations/<timestamp>_add_investment/migration.sql
apps/api/src/modules/investments/dto/create-investment.dto.ts
apps/api/src/modules/investments/investments.controller.ts
apps/api/src/modules/investments/investments.service.ts
apps/api/src/modules/investments/investments.repository.ts
apps/api/src/modules/investments/investments.module.ts
apps/api/src/modules/investments/investments.service.spec.ts

packages/types/src/investment.ts

apps/web/src/lib/api/investments.ts
apps/web/src/components/primitives/Drawer.tsx
apps/web/src/components/investor/PoolToggle.tsx
apps/web/src/components/investor/PoolTable.tsx
apps/web/src/components/investor/PositionsTable.tsx
apps/web/src/components/investor/BuyDrawer.tsx
```

### Modified files

```
apps/api/prisma/schema.prisma                             (add Investment model + reverse relation)
apps/api/src/app.module.ts                                (import InvestmentsModule)
apps/api/src/modules/receivables/receivables.repository.ts (filter investment:null)
apps/api/src/modules/receivables/receivables.service.spec.ts (new file or new tests)
packages/types/src/index.ts                               (re-export investment)
apps/web/src/app/(investor)/investor/dashboard/page.tsx   (toggle + drawer wiring)
```

---

## Task 1: Add Investment model to Prisma schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Generate: `apps/api/prisma/migrations/<timestamp>_add_investment/migration.sql`

- [ ] **Step 1: Add model + relation to schema.prisma**

Append to the bottom of `apps/api/prisma/schema.prisma`:

```prisma
model Investment {
  id             String     @id @default(uuid())
  investorUserId String
  receivableId   String     @unique
  amountPaid     Float
  faceValue      Float
  discountRate   Float      @default(0.03)
  status         String     @default("active")
  pixTxId        String?
  paidAt         DateTime   @default(now())
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  receivable     Receivable @relation(fields: [receivableId], references: [id])

  @@index([investorUserId])
}
```

Modify the existing `Receivable` model — add the reverse relation field:

```prisma
model Receivable {
  // ... existing fields unchanged
  documents      Document[]
  settlements    Settlement[]
  investment     Investment?
}
```

- [ ] **Step 2: Generate the migration**

Run from repo root:

```bash
cd apps/api && npx prisma migrate dev --name add_investment
```

Expected output: `Applying migration` then `✔ Generated Prisma Client`. Migration file appears under `apps/api/prisma/migrations/<timestamp>_add_investment/`.

- [ ] **Step 3: Verify Prisma client typechecks**

Run from repo root:

```bash
cd apps/api && npx tsc --noEmit
```

Expected: no errors. The `Investment` and `Receivable.investment` types are now available.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(api): add Investment model with 1:1 relation to Receivable"
```

---

## Task 2: Add Investment types to shared package

**Files:**
- Create: `packages/types/src/investment.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Create the type file**

Create `packages/types/src/investment.ts`:

```ts
import type { Receivable } from './receivable';

export type InvestmentStatus = 'active' | 'settled' | 'defaulted';

export interface Investment {
  id: string;
  investorUserId: string;
  receivableId: string;
  amountPaid: number;
  faceValue: number;
  discountRate: number;
  status: InvestmentStatus;
  pixTxId?: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
  receivable?: Receivable;
}

export interface CreateInvestmentInput {
  receivableId: string;
  pixTxId?: string;
}

export interface InvestorPositionStats {
  totalInvested: number;
  expectedReturn: number;
  activePositions: number;
}
```

- [ ] **Step 2: Re-export from index**

Modify `packages/types/src/index.ts` — add line:

```ts
export * from './investment';
```

- [ ] **Step 3: Build the package**

Run from repo root:

```bash
cd packages/types && npm run build
```

Expected: clean exit (no errors).

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/investment.ts packages/types/src/index.ts packages/types/dist/
git commit -m "feat(types): add Investment, CreateInvestmentInput, InvestorPositionStats"
```

---

## Task 3: Create InvestmentsModule skeleton (DTO, repository, module)

**Files:**
- Create: `apps/api/src/modules/investments/dto/create-investment.dto.ts`
- Create: `apps/api/src/modules/investments/investments.repository.ts`
- Create: `apps/api/src/modules/investments/investments.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/modules/investments/dto/create-investment.dto.ts`:

```ts
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateInvestmentDto {
  @IsUUID()
  receivableId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  pixTxId?: string;
}
```

- [ ] **Step 2: Create the repository**

Create `apps/api/src/modules/investments/investments.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class InvestmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findReceivableForUpdate(tx: Prisma.TransactionClient, id: string) {
    return tx.receivable.findUnique({
      where: { id },
      include: { investment: true },
    });
  }

  createInvestment(
    tx: Prisma.TransactionClient,
    data: {
      investorUserId: string;
      receivableId: string;
      faceValue: number;
      amountPaid: number;
      discountRate: number;
      pixTxId?: string;
    },
  ) {
    return tx.investment.create({
      data: {
        investorUserId: data.investorUserId,
        receivableId: data.receivableId,
        faceValue: data.faceValue,
        amountPaid: data.amountPaid,
        discountRate: data.discountRate,
        pixTxId: data.pixTxId,
      },
    });
  }

  setReceivableActive(tx: Prisma.TransactionClient, receivableId: string) {
    return tx.receivable.update({
      where: { id: receivableId },
      data: { status: 'active' },
    });
  }

  recordAudit(
    tx: Prisma.TransactionClient,
    data: {
      investmentId: string;
      investorUserId: string;
      receivableId: string;
      amountPaid: number;
      faceValue: number;
    },
  ) {
    return tx.auditLog.create({
      data: {
        event: 'investment.created',
        entityType: 'investment',
        entityId: data.investmentId,
        userId: data.investorUserId,
        metadata: {
          receivableId: data.receivableId,
          amountPaid: data.amountPaid,
          faceValue: data.faceValue,
        },
      },
    });
  }

  findManyByInvestor(investorUserId: string) {
    return this.prisma.investment.findMany({
      where: { investorUserId },
      orderBy: { paidAt: 'desc' },
      include: { receivable: true },
    });
  }

  async getStatsByInvestor(investorUserId: string) {
    const [agg, count] = await Promise.all([
      this.prisma.investment.aggregate({
        where: { investorUserId, status: 'active' },
        _sum: { amountPaid: true, faceValue: true },
      }),
      this.prisma.investment.count({
        where: { investorUserId, status: 'active' },
      }),
    ]);
    const totalInvested = agg._sum.amountPaid ?? 0;
    const totalFace = agg._sum.faceValue ?? 0;
    return {
      totalInvested,
      expectedReturn: totalFace - totalInvested,
      activePositions: count,
    };
  }
}
```

- [ ] **Step 3: Create the module file**

Create `apps/api/src/modules/investments/investments.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';
import { InvestmentsRepository } from './investments.repository';

@Module({
  imports: [AuthModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService, InvestmentsRepository],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
```

(Controller and Service are referenced — they will be created in the next tasks. The module file will not compile until they exist; that's expected.)

- [ ] **Step 4: Register the module**

Modify `apps/api/src/app.module.ts` — add the import and put it in the `imports` array (alphabetical order with the others):

```ts
import { InvestmentsModule } from './modules/investments/investments.module';
```

And add `InvestmentsModule,` to the `imports` array right after `AuditModule,` so the `imports` block reads:

```ts
imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BlockchainModule,
    StorageModule,
    KycModule,
    PaymentsModule,
    ReceivablesModule,
    DocumentsModule,
    SettlementsModule,
    AuditModule,
    InvestmentsModule,
    AuthModule,
    HealthModule,
  ],
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/investments/ apps/api/src/app.module.ts
git commit -m "feat(api): scaffold InvestmentsModule with DTO and repository"
```

(Build is expected to fail at this point because `investments.controller.ts` and `investments.service.ts` don't exist yet. They are added in Tasks 4–7.)

---

## Task 4: InvestmentsService.create() — TDD

**Files:**
- Create: `apps/api/src/modules/investments/investments.service.spec.ts`
- Create: `apps/api/src/modules/investments/investments.service.ts`

- [ ] **Step 1: Write the failing tests for create()**

Create `apps/api/src/modules/investments/investments.service.spec.ts`:

```ts
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
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd apps/api && npm test -- investments.service.spec
```

Expected: Test suite fails because `InvestmentsService` does not exist (module not found).

- [ ] **Step 3: Implement create()**

Create `apps/api/src/modules/investments/investments.service.ts`:

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { InvestmentsRepository } from './investments.repository';
import { CreateInvestmentDto } from './dto/create-investment.dto';

const DISCOUNT_RATE = 0.03;
const ALLOWED_STATUSES = new Set(['validated', 'active']);

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: InvestmentsRepository,
  ) {}

  async create(investorUserId: string, dto: CreateInvestmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const receivable = await this.repo.findReceivableForUpdate(tx, dto.receivableId);
      if (!receivable) {
        throw new NotFoundException('Recebível não encontrado');
      }
      if (receivable.investment) {
        throw new ConflictException('Recebível indisponível');
      }
      if (!ALLOWED_STATUSES.has(receivable.status)) {
        throw new ConflictException('Recebível indisponível');
      }
      if (receivable.userId === investorUserId) {
        throw new BadRequestException(
          'Você não pode comprar um recebível que cadastrou',
        );
      }

      const faceValue = receivable.value;
      const amountPaid = Number((faceValue * (1 - DISCOUNT_RATE)).toFixed(2));

      const investment = await this.repo.createInvestment(tx, {
        investorUserId,
        receivableId: receivable.id,
        faceValue,
        amountPaid,
        discountRate: DISCOUNT_RATE,
        pixTxId: dto.pixTxId,
      });

      await this.repo.setReceivableActive(tx, receivable.id);
      await this.repo.recordAudit(tx, {
        investmentId: investment.id,
        investorUserId,
        receivableId: receivable.id,
        amountPaid,
        faceValue,
      });

      return investment;
    });
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd apps/api && npm test -- investments.service.spec
```

Expected: all 6 `create` tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/investments/investments.service.ts apps/api/src/modules/investments/investments.service.spec.ts
git commit -m "feat(api): InvestmentsService.create with TDD coverage"
```

---

## Task 5: InvestmentsService.findMine() and getMyStats() — TDD

**Files:**
- Modify: `apps/api/src/modules/investments/investments.service.spec.ts`
- Modify: `apps/api/src/modules/investments/investments.service.ts`

- [ ] **Step 1: Add failing tests for findMine and getMyStats**

Append inside the `describe('InvestmentsService', ...)` block in `investments.service.spec.ts` — before the closing brace of the outer describe, after the `describe('create', ...)` block:

```ts
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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd apps/api && npm test -- investments.service.spec
```

Expected: 2 failing tests — `service.findMine is not a function` and `service.getMyStats is not a function`.

- [ ] **Step 3: Add the methods**

Add to `apps/api/src/modules/investments/investments.service.ts` inside the `InvestmentsService` class, after `create`:

```ts
  findMine(investorUserId: string) {
    return this.repo.findManyByInvestor(investorUserId);
  }

  getMyStats(investorUserId: string) {
    return this.repo.getStatsByInvestor(investorUserId);
  }
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd apps/api && npm test -- investments.service.spec
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/investments/investments.service.ts apps/api/src/modules/investments/investments.service.spec.ts
git commit -m "feat(api): add findMine and getMyStats with TDD coverage"
```

---

## Task 6: InvestmentsController — wire endpoints

**Files:**
- Create: `apps/api/src/modules/investments/investments.controller.ts`

- [ ] **Step 1: Create the controller**

Create `apps/api/src/modules/investments/investments.controller.ts`:

```ts
import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthRequest {
  user: { userId: string; email: string; role: string };
}

function assertInvestor(req: AuthRequest) {
  if (req.user.role !== 'investor') {
    throw new ForbiddenException('Apenas investidores podem acessar este recurso');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('investments')
export class InvestmentsController {
  constructor(private readonly service: InvestmentsService) {}

  @Post()
  create(@Req() req: AuthRequest, @Body() body: CreateInvestmentDto) {
    assertInvestor(req);
    return this.service.create(req.user.userId, body);
  }

  @Get('me')
  findMine(@Req() req: AuthRequest) {
    assertInvestor(req);
    return this.service.findMine(req.user.userId);
  }

  @Get('me/stats')
  getMyStats(@Req() req: AuthRequest) {
    assertInvestor(req);
    return this.service.getMyStats(req.user.userId);
  }
}
```

- [ ] **Step 2: Build the API to verify wiring**

```bash
cd apps/api && npm run build
```

Expected: clean build (`dist/` populated, no TypeScript errors).

- [ ] **Step 3: Run all tests**

```bash
cd apps/api && npm test
```

Expected: all suites pass (auth + investments).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/investments/investments.controller.ts
git commit -m "feat(api): wire investments controller endpoints"
```

---

## Task 7: Update receivables to exclude bought ones from pool

**Files:**
- Modify: `apps/api/src/modules/receivables/receivables.repository.ts`
- Create: `apps/api/src/modules/receivables/receivables.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/receivables/receivables.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReceivablesService } from './receivables.service';
import { ReceivablesRepository } from './receivables.repository';
import { PrismaService } from '../../shared/prisma/prisma.service';

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
            status: { in: ['validated', 'active'] },
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
          status: { in: ['validated', 'active'] },
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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd apps/api && npm test -- receivables.service.spec
```

Expected: tests fail because the current `findPool` and `getPoolStats` don't include `investment: null` in their `where` clauses.

- [ ] **Step 3: Update the repository**

Modify `apps/api/src/modules/receivables/receivables.repository.ts` — replace the `findPool` and `getPoolStats` method bodies:

```ts
  async findPool(limit = 50) {
    return this.prisma.receivable.findMany({
      where: {
        status: { in: ['validated', 'active'] },
        investment: null,
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
    });
  }

  async getPoolStats() {
    const [active, validated, totalAgg] = await Promise.all([
      this.prisma.receivable.count({
        where: { status: 'active', investment: null },
      }),
      this.prisma.receivable.count({
        where: { status: 'validated', investment: null },
      }),
      this.prisma.receivable.aggregate({
        where: {
          status: { in: ['validated', 'active'] },
          investment: null,
        },
        _sum: { value: true },
      }),
    ]);
    return {
      totalValue: totalAgg._sum.value ?? 0,
      activeCount: active,
      validatedCount: validated,
      poolCount: active + validated,
    };
  }
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd apps/api && npm test -- receivables.service.spec
```

Expected: both tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
cd apps/api && npm test
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/receivables/
git commit -m "feat(api): exclude bought receivables from pool queries"
```

---

## Task 8: Web API client for investments

**Files:**
- Create: `apps/web/src/lib/api/investments.ts`

- [ ] **Step 1: Create the client**

Create `apps/web/src/lib/api/investments.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Investment,
  CreateInvestmentInput,
  InvestorPositionStats,
} from "@credbridge/types";
import { apiFetch } from "./client";

export const investmentQueryKeys = {
  mine: ["investments", "me"] as const,
  myStats: ["investments", "me", "stats"] as const,
};

export function useInvestorPositions() {
  return useQuery<Investment[]>({
    queryKey: investmentQueryKeys.mine,
    queryFn: () => apiFetch<Investment[]>("/investments/me"),
  });
}

export function useInvestorPositionStats() {
  return useQuery<InvestorPositionStats>({
    queryKey: investmentQueryKeys.myStats,
    queryFn: () => apiFetch<InvestorPositionStats>("/investments/me/stats"),
  });
}

export function useBuyReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvestmentInput) =>
      apiFetch<Investment>("/investments", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["receivables", "pool"] });
      qc.invalidateQueries({ queryKey: ["receivables", "pool", "stats"] });
      qc.invalidateQueries({ queryKey: investmentQueryKeys.mine });
      qc.invalidateQueries({ queryKey: investmentQueryKeys.myStats });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/investments.ts
git commit -m "feat(web): add investments API hooks"
```

---

## Task 9: Drawer primitive

**Files:**
- Create: `apps/web/src/components/primitives/Drawer.tsx`

- [ ] **Step 1: Create the drawer primitive**

Create `apps/web/src/components/primitives/Drawer.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}

export function Drawer({ open, onClose, title, children, width = 480 }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <button
        aria-label="Fechar"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          border: 0,
          padding: 0,
          cursor: "pointer",
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          width,
          maxWidth: "100vw",
          height: "100vh",
          background: "var(--surface)",
          borderLeft: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          className="row between"
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <h3 style={{ fontSize: 16 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={14} />
          </button>
        </header>
        <div style={{ flex: 1, overflow: "auto", padding: "22px" }}>{children}</div>
      </aside>
    </div>
  );
}
```

If `Icon` does not have a `close` icon, use `arrow_right` rotated or any existing icon name. Check `apps/web/src/components/primitives/Icon.tsx` first; if no `close`, use `arrow_right` and the engineer can swap it later.

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/primitives/Drawer.tsx
git commit -m "feat(web): add Drawer primitive"
```

---

## Task 10: PoolToggle component

**Files:**
- Create: `apps/web/src/components/investor/PoolToggle.tsx`

- [ ] **Step 1: Create the toggle**

Create `apps/web/src/components/investor/PoolToggle.tsx`:

```tsx
"use client";

export type PoolView = "pool" | "mine";

interface PoolToggleProps {
  value: PoolView;
  onChange: (next: PoolView) => void;
}

const OPTIONS: { value: PoolView; label: string }[] = [
  { value: "pool", label: "Pool" },
  { value: "mine", label: "Minhas cotas" },
];

export function PoolToggle({ value, onChange }: PoolToggleProps) {
  return (
    <div
      className="row"
      style={{
        gap: 4,
        padding: 4,
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "var(--surface-2)",
      }}
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="btn btn-sm"
            style={{
              background: active ? "var(--surface)" : "transparent",
              borderColor: active ? "var(--line-2)" : "transparent",
              color: active ? "var(--fg-1)" : "var(--fg-2)",
              fontWeight: active ? 600 : 500,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/investor/PoolToggle.tsx
git commit -m "feat(web): add PoolToggle segmented control"
```

---

## Task 11: PoolTable component

**Files:**
- Create: `apps/web/src/components/investor/PoolTable.tsx`

- [ ] **Step 1: Create the table**

Create `apps/web/src/components/investor/PoolTable.tsx`:

```tsx
"use client";

import type { Receivable } from "@credbridge/types";
import { Icon } from "@/components/primitives/Icon";
import { fmtBRL } from "@/lib/format";

interface PoolTableProps {
  pool: Receivable[];
  loading: boolean;
  onBuy: (r: Receivable) => void;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function shortTx(tx: string): string {
  return tx.length > 10 ? `${tx.slice(0, 6)}…${tx.slice(-3)}` : tx;
}

export function PoolTable({ pool, loading, onBuy }: PoolTableProps) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>ID</th>
          <th>Sacado</th>
          <th>Status</th>
          <th style={{ textAlign: "right" }}>Valor</th>
          <th>Vencimento</th>
          <th>Prova on-chain</th>
          <th style={{ textAlign: "right" }}>Ação</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              Carregando recebíveis…
            </td>
          </tr>
        ) : pool.length === 0 ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              Sem recebíveis disponíveis.
            </td>
          </tr>
        ) : (
          pool.map((r) => (
            <tr key={r.id}>
              <td><span className="mono">{shortId(r.id)}</span></td>
              <td style={{ fontWeight: 500 }}>{r.debtorName}</td>
              <td>
                <span
                  className="badge neutral no-dot"
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: r.status === "active" ? "var(--green)" : "var(--blue)",
                  }}
                >
                  {r.status === "active" ? "Ativo" : "Validado"}
                </span>
              </td>
              <td className="num" style={{ textAlign: "right", fontWeight: 500 }}>
                {fmtBRL(r.value)}
              </td>
              <td style={{ fontSize: 13 }}>{fmtDate(r.dueDate)}</td>
              <td>
                {r.txHash ? (
                  <span className="row" style={{ gap: 6, fontSize: 12.5, color: "var(--blue)", fontFamily: "var(--mono)" }}>
                    <Icon name="chain" size={12} /> {shortTx(r.txHash)}
                  </span>
                ) : (
                  <span className="t-3" style={{ fontSize: 12 }}>—</span>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                <button className="btn btn-violet btn-sm" onClick={() => onBuy(r)}>
                  <Icon name="plus" size={12} /> Comprar
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/investor/PoolTable.tsx
git commit -m "feat(web): add PoolTable with Comprar action"
```

---

## Task 12: PositionsTable component

**Files:**
- Create: `apps/web/src/components/investor/PositionsTable.tsx`

- [ ] **Step 1: Create the table**

Create `apps/web/src/components/investor/PositionsTable.tsx`:

```tsx
"use client";

import type { Investment } from "@credbridge/types";
import { fmtBRL } from "@/lib/format";

interface PositionsTableProps {
  positions: Investment[];
  loading: boolean;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function statusLabel(s: Investment["status"]): { label: string; color: string } {
  if (s === "settled") return { label: "Liquidada", color: "var(--green)" };
  if (s === "defaulted") return { label: "Inadimplente", color: "var(--red)" };
  return { label: "Ativa", color: "var(--blue)" };
}

export function PositionsTable({ positions, loading }: PositionsTableProps) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>ID</th>
          <th>Sacado</th>
          <th style={{ textAlign: "right" }}>Pago</th>
          <th style={{ textAlign: "right" }}>Face</th>
          <th style={{ textAlign: "right" }}>Lucro</th>
          <th>Vencimento</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              Carregando posições…
            </td>
          </tr>
        ) : positions.length === 0 ? (
          <tr>
            <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--fg-3)" }}>
              Nenhuma cota adquirida.
            </td>
          </tr>
        ) : (
          positions.map((p) => {
            const profit = p.faceValue - p.amountPaid;
            const s = statusLabel(p.status);
            return (
              <tr key={p.id}>
                <td><span className="mono">{shortId(p.id)}</span></td>
                <td style={{ fontWeight: 500 }}>{p.receivable?.debtorName ?? "—"}</td>
                <td className="num" style={{ textAlign: "right" }}>{fmtBRL(p.amountPaid)}</td>
                <td className="num" style={{ textAlign: "right" }}>{fmtBRL(p.faceValue)}</td>
                <td className="num t-green" style={{ textAlign: "right", fontWeight: 600 }}>
                  {fmtBRL(profit)}
                </td>
                <td style={{ fontSize: 13 }}>
                  {p.receivable ? fmtDate(p.receivable.dueDate) : "—"}
                </td>
                <td>
                  <span
                    className="badge neutral no-dot"
                    style={{ fontFamily: "var(--mono)", fontSize: 11, color: s.color }}
                  >
                    {s.label}
                  </span>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/investor/PositionsTable.tsx
git commit -m "feat(web): add PositionsTable for investor positions"
```

---

## Task 13: BuyDrawer component

**Files:**
- Create: `apps/web/src/components/investor/BuyDrawer.tsx`

- [ ] **Step 1: Create the drawer**

Create `apps/web/src/components/investor/BuyDrawer.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { Receivable } from "@credbridge/types";
import { Drawer } from "@/components/primitives/Drawer";
import { Icon } from "@/components/primitives/Icon";
import { fmtBRL } from "@/lib/format";
import { useBuyReceivable } from "@/lib/api/investments";
import { extractApiErrorMessage } from "@/lib/api/client";

const DISCOUNT = 0.03;
const FAKE_PIX_STRING =
  "00020126360014BR.GOV.BCB.PIX0114credbridge-mock5204000053039865802BR5913CredBridge LT6009Sao Paulo62070503***6304";

type Step = "summary" | "pix" | "success";

interface BuyDrawerProps {
  receivable: Receivable | null;
  onClose: () => void;
  onSuccess: () => void;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function BuyDrawer({ receivable, onClose, onSuccess }: BuyDrawerProps) {
  const [step, setStep] = useState<Step>("summary");
  const [error, setError] = useState<string | null>(null);
  const buyMutation = useBuyReceivable();

  const open = receivable !== null;
  const faceValue = receivable?.value ?? 0;
  const amountPaid = Number((faceValue * (1 - DISCOUNT)).toFixed(2));
  const profit = faceValue - amountPaid;
  const days = receivable ? daysBetween(new Date(), new Date(receivable.dueDate)) : 0;

  const handleClose = () => {
    setStep("summary");
    setError(null);
    onClose();
  };

  const handleConfirm = () => {
    if (!receivable) return;
    setError(null);
    buyMutation.mutate(
      { receivableId: receivable.id, pixTxId: `mock-${Date.now()}` },
      {
        onSuccess: () => setStep("success"),
        onError: (err) => {
          const msg = extractApiErrorMessage(err) || "Erro ao processar compra";
          if (msg.toLowerCase().includes("indispon")) {
            setError("Outro investidor adquiriu primeiro.");
            setTimeout(() => handleClose(), 1500);
          } else {
            setError(msg);
          }
        },
      }
    );
  };

  return (
    <Drawer open={open} onClose={handleClose} title="Comprar cota">
      {receivable && step === "summary" && (
        <div className="col" style={{ gap: 18 }}>
          <div className="card" style={{ padding: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Sacado</div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{receivable.debtorName}</div>
            <div className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              Vence em {days} {days === 1 ? "dia" : "dias"} ·{" "}
              {new Date(receivable.dueDate).toLocaleDateString("pt-BR")}
            </div>
          </div>

          <div className="col" style={{ gap: 10 }}>
            <div className="row between">
              <span className="t-2">Valor de face</span>
              <span className="num">{fmtBRL(faceValue)}</span>
            </div>
            <div className="row between">
              <span className="t-2">Deságio (3%)</span>
              <span className="num t-3">−{fmtBRL(faceValue - amountPaid)}</span>
            </div>
            <div
              className="row between"
              style={{ paddingTop: 10, borderTop: "1px solid var(--line)" }}
            >
              <span style={{ fontWeight: 600 }}>Você paga</span>
              <span className="num kpi" style={{ fontSize: 22 }}>{fmtBRL(amountPaid)}</span>
            </div>
            <div className="row between">
              <span className="t-2">Recebe no vencimento</span>
              <span className="num">{fmtBRL(faceValue)}</span>
            </div>
            <div className="row between">
              <span className="t-green" style={{ fontWeight: 600 }}>Lucro estimado</span>
              <span className="num t-green" style={{ fontWeight: 600 }}>{fmtBRL(profit)}</span>
            </div>
          </div>

          <button className="btn btn-primary btn-lg" onClick={() => setStep("pix")}>
            Continuar pagamento <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}

      {step === "pix" && (
        <div className="col" style={{ gap: 18 }}>
          <div className="card" style={{ padding: 22, textAlign: "center" }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Pagamento Pix</div>
            <div
              style={{
                width: 200,
                height: 200,
                margin: "0 auto",
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                color: "var(--fg-3)",
                fontSize: 12,
              }}
            >
              QR mockado
            </div>
            <div className="kpi num" style={{ fontSize: 24, marginTop: 14 }}>
              {fmtBRL(amountPaid)}
            </div>
            <div className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              Aguardando pagamento
            </div>
          </div>

          <div>
            <div className="field-label">Copia e cola</div>
            <div
              className="mono"
              style={{
                padding: 12,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                fontSize: 11,
                wordBreak: "break-all",
              }}
            >
              {FAKE_PIX_STRING}
            </div>
          </div>

          {error && (
            <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>
          )}

          <div className="row" style={{ gap: 10 }}>
            <button
              className="btn btn-ghost grow"
              onClick={() => setStep("summary")}
              disabled={buyMutation.isPending}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary grow"
              onClick={handleConfirm}
              disabled={buyMutation.isPending}
            >
              {buyMutation.isPending ? "Processando…" : "Confirmar pagamento"}
            </button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="col" style={{ gap: 18, alignItems: "center", textAlign: "center", paddingTop: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--green)15",
              color: "var(--green)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="check" size={28} />
          </div>
          <h3 style={{ fontSize: 22 }}>Cota adquirida</h3>
          <p className="t-2" style={{ fontSize: 13 }}>
            Sua posição foi registrada. Acompanhe em "Minhas cotas".
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              handleClose();
              onSuccess();
            }}
          >
            Ver minhas cotas <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors. If `Icon` does not include `check`, swap for any existing icon (e.g., `arrow_up_right`) and proceed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/investor/BuyDrawer.tsx
git commit -m "feat(web): add BuyDrawer with summary/Pix/success steps"
```

---

## Task 14: Wire dashboard with toggle and drawer

**Files:**
- Modify: `apps/web/src/app/(investor)/investor/dashboard/page.tsx`

- [ ] **Step 1: Replace the dashboard page**

Replace the entire contents of `apps/web/src/app/(investor)/investor/dashboard/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import type { Receivable } from "@credbridge/types";
import { Icon } from "@/components/primitives/Icon";
import { MiniKpi } from "@/components/patterns/MiniKpi";
import { NavChart } from "@/components/investor/NavChart";
import { ShareCard } from "@/components/investor/ShareCard";
import { PoolToggle, type PoolView } from "@/components/investor/PoolToggle";
import { PoolTable } from "@/components/investor/PoolTable";
import { PositionsTable } from "@/components/investor/PositionsTable";
import { BuyDrawer } from "@/components/investor/BuyDrawer";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { fmtBRL } from "@/lib/format";
import { useInvestorPool, useInvestorStats } from "@/lib/api/receivables";
import { useInvestorPositions, useInvestorPositionStats } from "@/lib/api/investments";

export default function InvestorDashboardPage() {
  const { t } = useTranslation("pt");
  const [view, setView] = useState<PoolView>("pool");
  const [buyTarget, setBuyTarget] = useState<Receivable | null>(null);

  const { data: pool = [], isLoading: loadingPool } = useInvestorPool();
  const { data: poolStats, isLoading: loadingPoolStats } = useInvestorStats();
  const { data: positions = [], isLoading: loadingPositions } = useInvestorPositions();
  const { data: posStats, isLoading: loadingPosStats } = useInvestorPositionStats();

  const isMine = view === "mine";

  const headerValue = isMine
    ? posStats?.totalInvested ?? 0
    : poolStats?.totalValue ?? 0;
  const headerSub = isMine
    ? `${posStats?.activePositions ?? 0} cotas ativas`
    : `${poolStats?.poolCount ?? 0} recebíveis no pool`;
  const headerLoading = isMine ? loadingPosStats : loadingPoolStats;

  return (
    <>
      {/* Header */}
      <div className="row between" style={{ marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t("inv_overview")}</div>
          <h2 style={{ fontSize: 32 }}>Seu portfólio</h2>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost">
            <Icon name="download" size={14} /> Relatório
          </button>
          <button
            className="btn btn-violet"
            onClick={() => setView("pool")}
          >
            <Icon name="plus" size={14} /> {t("inv_buy")}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card violet-hi" style={{ padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {isMine ? "Total investido" : t("inv_invested")}
          </div>
          <div className="kpi kpi-lg num">
            {headerLoading ? <span className="t-3">—</span> : <span>{fmtBRL(headerValue)}</span>}
          </div>
          <div className="row" style={{ gap: 16, marginTop: 14, fontSize: 12.5 }}>
            <span className="t-2">{headerSub}</span>
          </div>
        </div>
        <MiniKpi
          label={isMine ? "Retorno esperado" : t("inv_nav")}
          value={
            isMine
              ? posStats
                ? fmtBRL(posStats.expectedReturn)
                : "—"
              : "1,186"
          }
          sub={isMine ? "no vencimento" : "por cota"}
          color="#00D4FF"
          icon="chart"
        />
        <MiniKpi label={t("inv_yield")} value="18,6%" sub="últimos 12m" color="#00FF94" icon="arrow_up_right" />
        <MiniKpi label="Liquidez D+" value="D+2" sub="via Stellar DEX" color="#7B2FFF" icon="bolt" />
      </div>

      {/* Chart + shares */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 24 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <h3>{t("inv_nav_chart")}</h3>
            <div className="row" style={{ gap: 4 }}>
              {(["1M", "3M", "6M", "1A", "Máx"] as const).map((p, i) => (
                <button
                  key={p}
                  className="btn btn-ghost btn-sm"
                  style={{
                    background: i === 3 ? "var(--surface-2)" : "transparent",
                    borderColor: i === 3 ? "var(--line-2)" : "transparent",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="row" style={{ gap: 24, marginBottom: 10 }}>
            <div>
              <div className="kpi num" style={{ fontSize: 28 }}>
                {headerLoading ? "—" : fmtBRL(headerValue)}
              </div>
              <div className="row" style={{ gap: 8, fontSize: 12 }}>
                <span className="t-3">{isMine ? "Suas posições" : "Pool total"}</span>
              </div>
            </div>
          </div>
          <NavChart />
        </div>

        <div className="col" style={{ gap: 12 }}>
          <ShareCard
            title={t("inv_shares")}
            color="#00D4FF"
            allocation="100%"
            value={headerLoading ? "—" : fmtBRL(headerValue)}
            yieldVal="—"
            desc="Cotas do fundo"
          />
          <div className="card" style={{ padding: 16, display: "flex", gap: 10 }}>
            <button className="btn btn-primary grow" onClick={() => setView("pool")}>
              <Icon name="plus" size={14} /> {t("inv_buy")}
            </button>
          </div>
        </div>
      </div>

      {/* Pool / Positions table */}
      <div className="card" style={{ padding: 0 }}>
        <div
          className="row between"
          style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <h3>{isMine ? "Minhas cotas" : t("inv_receivables")}</h3>
            <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>
              {isMine
                ? loadingPositions
                  ? "Carregando…"
                  : `${positions.length} posições · todas com prova on-chain`
                : loadingPool
                ? "Carregando…"
                : `${poolStats?.poolCount ?? 0} ativos · todos com prova on-chain`}
            </p>
          </div>
          <PoolToggle value={view} onChange={setView} />
        </div>
        {isMine ? (
          <PositionsTable positions={positions} loading={loadingPositions} />
        ) : (
          <PoolTable pool={pool} loading={loadingPool} onBuy={(r) => setBuyTarget(r)} />
        )}
      </div>

      <BuyDrawer
        receivable={buyTarget}
        onClose={() => setBuyTarget(null)}
        onSuccess={() => setView("mine")}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build the web app**

```bash
cd apps/web && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Manual smoke test**

Start the API and web in separate terminals:

```bash
cd apps/api && npm run dev
```

```bash
cd apps/web && npm run dev
```

Then in a browser:

1. Register a new investor account at `/login` (selecionar Investidor → Criar conta → email/senha distintos do PME do seed)
2. Land on `/investor/dashboard`
3. **Pool tab visible by default**, table populated with seed receivables that have no investment
4. Click **Comprar** on any row → drawer opens on the right with summary
5. Click **Continuar pagamento** → Pix screen with QR mock and copia-cola
6. Click **Confirmar pagamento** → success screen
7. Click **Ver minhas cotas** → drawer closes, toggle switches to **Minhas cotas**, the position appears
8. Click **Pool** → the bought receivable is gone from the list
9. Open DevTools network tab and re-issue `POST /v1/investments` with the same `receivableId` (or attempt to buy a non-existent UUID) → confirm 409 / 404 returned and UI shows the message

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(investor\)/investor/dashboard/page.tsx
git commit -m "feat(web): wire investor dashboard with Pool/MinhasCotas toggle and BuyDrawer"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run all backend tests**

```bash
cd apps/api && npm test
```

Expected: all suites pass.

- [ ] **Step 2: Build everything**

From repo root:

```bash
cd packages/types && npm run build && cd ../../apps/api && npm run build && cd ../web && npm run build
```

Expected: each package builds cleanly.

- [ ] **Step 3: Sanity check the migration**

```bash
cd apps/api && npx prisma migrate status
```

Expected: `Database schema is up to date!`

- [ ] **Step 4: Check git log**

```bash
git log --oneline | head -20
```

Expected: a commit per task in chronological order, no skipped tasks.

---

## Done

When all 15 tasks are complete:

- Schema has `Investment` model with 1:1 FK to `Receivable`
- API exposes `POST /v1/investments`, `GET /v1/investments/me`, `GET /v1/investments/me/stats`
- Pool queries exclude bought receivables
- Investor dashboard has Pool / Minhas cotas toggle and a working buy flow with simulated Pix
- Backend has unit-test coverage for the service create/find/stats branches and the receivables pool filter
- Auditoria registra `investment.created` em cada compra
