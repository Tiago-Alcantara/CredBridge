# Monorepo Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the existing Next.js frontend into a monorepo and scaffold the NestJS backend skeleton with shared services and business module stubs.

**Architecture:** npm workspaces monorepo with `apps/web` (Next.js), `apps/api` (NestJS Modular Monolith), and `packages/types` (shared TypeScript types). External integrations (Stellar, S3, KYC, PIX) are isolated behind interfaces in `apps/api/src/shared/`. Business modules are scaffolded as stubs — no business logic implemented here.

**Tech Stack:** Node.js 18+, npm workspaces, Next.js 16, NestJS 10, TypeScript 5, Prisma, PostgreSQL

---

## File Map

### Created
- `package.json` — monorepo root with workspaces
- `.gitignore` — root gitignore
- `.env.example` — shared env vars template
- `packages/types/package.json`
- `packages/types/tsconfig.json`
- `packages/types/src/receivable.ts`
- `packages/types/src/settlement.ts`
- `packages/types/src/investor.ts`
- `packages/types/src/document.ts`
- `packages/types/src/index.ts`
- `apps/api/` — full NestJS scaffold (via nest CLI)
- `apps/api/src/shared/prisma/prisma.service.ts`
- `apps/api/src/shared/prisma/prisma.module.ts`
- `apps/api/src/shared/blockchain/blockchain.interface.ts`
- `apps/api/src/shared/blockchain/stellar.service.ts`
- `apps/api/src/shared/blockchain/blockchain.module.ts`
- `apps/api/src/shared/storage/storage.interface.ts`
- `apps/api/src/shared/storage/s3.service.ts`
- `apps/api/src/shared/storage/storage.module.ts`
- `apps/api/src/shared/kyc/kyc.interface.ts`
- `apps/api/src/shared/kyc/kyc.service.ts`
- `apps/api/src/shared/kyc/kyc.module.ts`
- `apps/api/src/shared/payments/payments.interface.ts`
- `apps/api/src/shared/payments/pix.service.ts`
- `apps/api/src/shared/payments/payments.module.ts`
- `apps/api/src/modules/receivables/` — module stub (5 files)
- `apps/api/src/modules/documents/` — module stub (5 files)
- `apps/api/src/modules/settlements/` — module stub (5 files)
- `apps/api/src/modules/audit/` — module stub (3 files)
- `apps/api/src/modules/auth/` — module stub (3 files)
- `apps/api/prisma/schema.prisma`

### Modified
- `apps/web/package.json` — rename to `@credbridge/web`, add `@credbridge/types` dep
- `apps/api/src/app.module.ts` — import all modules

---

## Task 1: Create monorepo root

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Move current CredBridge repo into apps/web**

From the parent directory of the current `CredBridge/` folder:

```bash
mkdir -p credbridge-mono/apps
cp -r CredBridge credbridge-mono/apps/web
cd credbridge-mono
```

> Skip this step if you're already working inside a fresh monorepo root.

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "credbridge",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev -w apps/web\" \"npm run dev -w apps/api\"",
    "dev:web": "npm run dev -w apps/web",
    "dev:api": "npm run dev -w apps/api",
    "build:types": "npm run build -w packages/types",
    "build": "npm run build:types && npm run build -w apps/web && npm run build -w apps/api",
    "lint": "npm run lint -w apps/web && npm run lint -w apps/api"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

- [ ] **Step 3: Create root .gitignore**

```
node_modules/
.env
.env.local
dist/
.next/
.turbo/
*.log
```

- [ ] **Step 4: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/credbridge

# Stellar
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SECRET_KEY=

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=credbridge-documents

# KYC
KYC_PROVIDER_URL=
KYC_API_KEY=

# Auth
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d

# API
PORT=3001
```

- [ ] **Step 5: Install root devDependencies**

```bash
npm install
```

Expected: `node_modules/` created at root, `concurrently` installed.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore .env.example
git commit -m "chore: initialize monorepo root with npm workspaces"
```

---

## Task 2: Rename and verify frontend workspace

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Update apps/web/package.json name**

Open `apps/web/package.json` and change the `name` field:

```json
{
  "name": "@credbridge/web",
  ...
}
```

- [ ] **Step 2: Verify frontend still runs**

```bash
npm run dev:web
```

Expected: Next.js dev server starts at `http://localhost:3000`. No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json
git commit -m "chore: rename web app to @credbridge/web workspace"
```

---

## Task 3: Create shared types package

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/receivable.ts`
- Create: `packages/types/src/settlement.ts`
- Create: `packages/types/src/investor.ts`
- Create: `packages/types/src/document.ts`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: Create package directory**

```bash
mkdir -p packages/types/src
```

- [ ] **Step 2: Create packages/types/package.json**

```json
{
  "name": "@credbridge/types",
  "version": "0.0.1",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: Create packages/types/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create packages/types/src/receivable.ts**

```ts
export type ReceivableStatus = 'pending' | 'validated' | 'settled' | 'defaulted';
export type ReceivableType = 'invoice' | 'duplicate' | 'contract';

export interface Receivable {
  id: string;
  userId: string;
  value: number;
  type: ReceivableType;
  status: ReceivableStatus;
  documentHash?: string;
  txHash?: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReceivableInput {
  userId: string;
  value: number;
  type: ReceivableType;
  dueDate: string;
}
```

- [ ] **Step 5: Create packages/types/src/settlement.ts**

```ts
export type SettlementStatus = 'pending' | 'completed' | 'failed';
export type SettlementMethod = 'pix' | 'ted';

export interface Settlement {
  id: string;
  receivableId: string;
  amount: number;
  method: SettlementMethod;
  status: SettlementStatus;
  txHash?: string;
  stellarTxHash?: string;
  settledAt?: string;
  createdAt: string;
}

export interface CreateSettlementInput {
  receivableId: string;
  amount: number;
  method: SettlementMethod;
}
```

- [ ] **Step 6: Create packages/types/src/investor.ts**

```ts
export interface Investor {
  id: string;
  name: string;
  cnpj?: string;
  cpf?: string;
  stellarAddress?: string;
  createdAt: string;
}
```

- [ ] **Step 7: Create packages/types/src/document.ts**

```ts
export type DocumentType = 'invoice' | 'contract' | 'duplicate' | 'kyc';

export interface Document {
  id: string;
  receivableId: string;
  url: string;
  hash: string;
  type: DocumentType;
  uploadedAt: string;
}

export interface UploadDocumentInput {
  receivableId: string;
  type: DocumentType;
  file: Buffer;
  filename: string;
}
```

- [ ] **Step 8: Create packages/types/src/index.ts**

```ts
export * from './receivable';
export * from './settlement';
export * from './investor';
export * from './document';
```

- [ ] **Step 9: Build types package**

```bash
npm run build:types
```

Expected: `packages/types/dist/` created with `.js` and `.d.ts` files. No TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add packages/
git commit -m "feat: add @credbridge/types shared package with core domain types"
```

---

## Task 4: Scaffold NestJS backend

**Files:**
- Create: `apps/api/` (full NestJS structure via CLI)

- [ ] **Step 1: Install NestJS CLI globally if not present**

```bash
npx @nestjs/cli --version 2>/dev/null || npm install -g @nestjs/cli
```

- [ ] **Step 2: Scaffold NestJS app**

From the monorepo root:

```bash
cd apps && nest new api --package-manager npm --skip-git
```

When prompted for package manager: select `npm`.

Expected: `apps/api/` created with `src/app.module.ts`, `src/main.ts`, `package.json`, `tsconfig.json`.

- [ ] **Step 3: Update apps/api/package.json name**

```json
{
  "name": "@credbridge/api",
  ...
}
```

Also add `@credbridge/types` as a dependency:

```json
{
  "dependencies": {
    "@credbridge/types": "*",
    ...
  }
}
```

- [ ] **Step 4: Update apps/api/src/main.ts port**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

- [ ] **Step 5: Verify API starts**

```bash
npm run dev:api
```

Expected: NestJS starts on `http://localhost:3001`. Console shows `Application is running on: http://[::1]:3001/v1`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/
git commit -m "feat: scaffold NestJS API as @credbridge/api workspace"
```

---

## Task 5: Setup Prisma

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/shared/prisma/prisma.service.ts`
- Create: `apps/api/src/shared/prisma/prisma.module.ts`

- [ ] **Step 1: Install Prisma in api workspace**

```bash
npm install @prisma/client -w apps/api
npm install prisma --save-dev -w apps/api
```

- [ ] **Step 2: Initialize Prisma**

```bash
cd apps/api && npx prisma init --datasource-provider postgresql
```

Expected: `apps/api/prisma/schema.prisma` and `apps/api/.env` created.

- [ ] **Step 3: Write initial schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Receivable {
  id           String   @id @default(uuid())
  userId       String
  value        Float
  type         String
  status       String   @default("pending")
  documentHash String?
  txHash       String?
  dueDate      DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  documents    Document[]
  settlements  Settlement[]
  auditLogs    AuditLog[]
}

model Document {
  id           String     @id @default(uuid())
  receivableId String
  url          String
  hash         String
  type         String
  uploadedAt   DateTime   @default(now())

  receivable   Receivable @relation(fields: [receivableId], references: [id])
}

model Settlement {
  id             String     @id @default(uuid())
  receivableId   String
  amount         Float
  method         String
  status         String     @default("pending")
  txHash         String?
  stellarTxHash  String?
  settledAt      DateTime?
  createdAt      DateTime   @default(now())

  receivable     Receivable @relation(fields: [receivableId], references: [id])
}

model AuditLog {
  id           String   @id @default(uuid())
  event        String
  entityId     String
  entityType   String
  userId       String
  txHash       String?
  metadata     Json?
  createdAt    DateTime @default(now())

  @@index([entityId, entityType])
  @@index([userId])
}
```

- [ ] **Step 4: Create apps/api/src/shared/prisma/prisma.service.ts**

```ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

- [ ] **Step 5: Create apps/api/src/shared/prisma/prisma.module.ts**

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/ apps/api/src/shared/prisma/
git commit -m "feat: setup Prisma with initial schema and PrismaModule"
```

---

## Task 6: Create shared service interfaces and stubs

**Files:**
- Create: `apps/api/src/shared/blockchain/blockchain.interface.ts`
- Create: `apps/api/src/shared/blockchain/stellar.service.ts`
- Create: `apps/api/src/shared/blockchain/blockchain.module.ts`
- Create: `apps/api/src/shared/storage/storage.interface.ts`
- Create: `apps/api/src/shared/storage/s3.service.ts`
- Create: `apps/api/src/shared/storage/storage.module.ts`
- Create: `apps/api/src/shared/kyc/kyc.interface.ts`
- Create: `apps/api/src/shared/kyc/kyc.service.ts`
- Create: `apps/api/src/shared/kyc/kyc.module.ts`
- Create: `apps/api/src/shared/payments/payments.interface.ts`
- Create: `apps/api/src/shared/payments/pix.service.ts`
- Create: `apps/api/src/shared/payments/payments.module.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p apps/api/src/shared/{blockchain,storage,kyc,payments}
```

- [ ] **Step 2: Create blockchain.interface.ts**

```ts
export interface BlockchainService {
  registerProof(hash: string): Promise<string>;
  settlePayment(data: { receivableId: string; amount: number; destination: string }): Promise<string>;
  getTransactionStatus(txHash: string): Promise<'pending' | 'success' | 'failed'>;
}

export const BLOCKCHAIN_SERVICE = Symbol('BLOCKCHAIN_SERVICE');
```

- [ ] **Step 3: Create stellar.service.ts**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from './blockchain.interface';

@Injectable()
export class StellarService implements BlockchainService {
  private readonly logger = new Logger(StellarService.name);

  async registerProof(hash: string): Promise<string> {
    this.logger.log(`registerProof called with hash: ${hash}`);
    // TODO: implement Stellar SDK integration
    return `stellar-tx-${Date.now()}`;
  }

  async settlePayment(data: { receivableId: string; amount: number; destination: string }): Promise<string> {
    this.logger.log(`settlePayment called for receivable: ${data.receivableId}`);
    // TODO: implement Stellar SDK integration
    return `stellar-tx-${Date.now()}`;
  }

  async getTransactionStatus(txHash: string): Promise<'pending' | 'success' | 'failed'> {
    this.logger.log(`getTransactionStatus called for: ${txHash}`);
    // TODO: implement Stellar SDK integration
    return 'success';
  }
}
```

- [ ] **Step 4: Create blockchain.module.ts**

```ts
import { Global, Module } from '@nestjs/common';
import { StellarService } from './stellar.service';
import { BLOCKCHAIN_SERVICE } from './blockchain.interface';

@Global()
@Module({
  providers: [{ provide: BLOCKCHAIN_SERVICE, useClass: StellarService }],
  exports: [BLOCKCHAIN_SERVICE],
})
export class BlockchainModule {}
```

- [ ] **Step 5: Create storage.interface.ts**

```ts
export interface StorageService {
  upload(key: string, file: Buffer, contentType: string): Promise<string>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
```

- [ ] **Step 6: Create s3.service.ts**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from './storage.interface';

@Injectable()
export class S3Service implements StorageService {
  private readonly logger = new Logger(S3Service.name);

  async upload(key: string, file: Buffer, contentType: string): Promise<string> {
    this.logger.log(`upload called for key: ${key}`);
    // TODO: implement AWS S3 SDK integration
    return `https://s3.example.com/${key}`;
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    this.logger.log(`getSignedUrl called for key: ${key}`);
    // TODO: implement AWS S3 SDK integration
    return `https://s3.example.com/${key}?signed=true&expires=${expiresInSeconds}`;
  }

  async delete(key: string): Promise<void> {
    this.logger.log(`delete called for key: ${key}`);
    // TODO: implement AWS S3 SDK integration
  }
}
```

- [ ] **Step 7: Create storage.module.ts**

```ts
import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { STORAGE_SERVICE } from './storage.interface';

@Global()
@Module({
  providers: [{ provide: STORAGE_SERVICE, useClass: S3Service }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
```

- [ ] **Step 8: Create kyc.interface.ts**

```ts
export type KycStatus = 'approved' | 'rejected' | 'pending';

export interface KycVerificationResult {
  status: KycStatus;
  reason?: string;
  verifiedAt?: string;
}

export interface KycService {
  verifyCpf(cpf: string, name: string): Promise<KycVerificationResult>;
  verifyCnpj(cnpj: string, companyName: string): Promise<KycVerificationResult>;
}

export const KYC_SERVICE = Symbol('KYC_SERVICE');
```

- [ ] **Step 9: Create kyc.service.ts**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { KycService, KycVerificationResult } from './kyc.interface';

@Injectable()
export class KycProviderService implements KycService {
  private readonly logger = new Logger(KycProviderService.name);

  async verifyCpf(cpf: string, name: string): Promise<KycVerificationResult> {
    this.logger.log(`verifyCpf called for CPF ending in: ${cpf.slice(-4)}`);
    // TODO: implement KYC provider integration
    return { status: 'approved', verifiedAt: new Date().toISOString() };
  }

  async verifyCnpj(cnpj: string, companyName: string): Promise<KycVerificationResult> {
    this.logger.log(`verifyCnpj called for CNPJ ending in: ${cnpj.slice(-4)}`);
    // TODO: implement KYC provider integration
    return { status: 'approved', verifiedAt: new Date().toISOString() };
  }
}
```

- [ ] **Step 10: Create kyc.module.ts**

```ts
import { Global, Module } from '@nestjs/common';
import { KycProviderService } from './kyc.service';
import { KYC_SERVICE } from './kyc.interface';

@Global()
@Module({
  providers: [{ provide: KYC_SERVICE, useClass: KycProviderService }],
  exports: [KYC_SERVICE],
})
export class KycModule {}
```

- [ ] **Step 11: Create payments.interface.ts**

```ts
export type PaymentMethod = 'pix' | 'ted';
export type PaymentStatus = 'pending' | 'completed' | 'failed';

export interface PaymentResult {
  txId: string;
  status: PaymentStatus;
  processedAt?: string;
}

export interface PaymentsService {
  send(data: {
    amount: number;
    method: PaymentMethod;
    destination: string;
    description: string;
  }): Promise<PaymentResult>;
  getStatus(txId: string): Promise<PaymentStatus>;
}

export const PAYMENTS_SERVICE = Symbol('PAYMENTS_SERVICE');
```

- [ ] **Step 12: Create pix.service.ts**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PaymentsService, PaymentResult, PaymentStatus } from './payments.interface';

@Injectable()
export class PixService implements PaymentsService {
  private readonly logger = new Logger(PixService.name);

  async send(data: {
    amount: number;
    method: string;
    destination: string;
    description: string;
  }): Promise<PaymentResult> {
    this.logger.log(`send called: ${data.method} R$${data.amount} to ${data.destination}`);
    // TODO: implement PIX/TED provider integration
    return {
      txId: `pix-${Date.now()}`,
      status: 'completed',
      processedAt: new Date().toISOString(),
    };
  }

  async getStatus(txId: string): Promise<PaymentStatus> {
    this.logger.log(`getStatus called for: ${txId}`);
    // TODO: implement PIX/TED provider integration
    return 'completed';
  }
}
```

- [ ] **Step 13: Create payments.module.ts**

```ts
import { Global, Module } from '@nestjs/common';
import { PixService } from './pix.service';
import { PAYMENTS_SERVICE } from './payments.interface';

@Global()
@Module({
  providers: [{ provide: PAYMENTS_SERVICE, useClass: PixService }],
  exports: [PAYMENTS_SERVICE],
})
export class PaymentsModule {}
```

- [ ] **Step 14: Commit**

```bash
git add apps/api/src/shared/
git commit -m "feat: add shared service interfaces and stubs (blockchain, storage, kyc, payments)"
```

---

## Task 7: Scaffold business modules

**Files:**
- Create: `apps/api/src/modules/receivables/` (5 files)
- Create: `apps/api/src/modules/documents/` (5 files)
- Create: `apps/api/src/modules/settlements/` (5 files)
- Create: `apps/api/src/modules/audit/` (3 files)
- Create: `apps/api/src/modules/auth/` (3 files)

- [ ] **Step 1: Create module directories**

```bash
mkdir -p apps/api/src/modules/{receivables,documents,settlements,audit,auth}
mkdir -p apps/api/src/modules/receivables/dto
mkdir -p apps/api/src/modules/documents/dto
mkdir -p apps/api/src/modules/settlements/dto
```

- [ ] **Step 2: Scaffold receivables module**

`apps/api/src/modules/receivables/receivables.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { ReceivablesController } from './receivables.controller';
import { ReceivablesService } from './receivables.service';
import { ReceivablesRepository } from './receivables.repository';

@Module({
  controllers: [ReceivablesController],
  providers: [ReceivablesService, ReceivablesRepository],
  exports: [ReceivablesService],
})
export class ReceivablesModule {}
```

`apps/api/src/modules/receivables/receivables.controller.ts`:
```ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ReceivablesService } from './receivables.service';

@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Post()
  create(@Body() body: any) {
    return this.receivablesService.create(body);
  }

  @Get()
  findAll() {
    return this.receivablesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receivablesService.findOne(id);
  }
}
```

`apps/api/src/modules/receivables/receivables.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { ReceivablesRepository } from './receivables.repository';

@Injectable()
export class ReceivablesService {
  constructor(private readonly repo: ReceivablesRepository) {}

  async create(data: any) {
    return this.repo.create(data);
  }

  async findAll() {
    return this.repo.findAll();
  }

  async findOne(id: string) {
    return this.repo.findOne(id);
  }
}
```

`apps/api/src/modules/receivables/receivables.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ReceivablesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.receivable.create({ data });
  }

  async findAll() {
    return this.prisma.receivable.findMany();
  }

  async findOne(id: string) {
    return this.prisma.receivable.findUnique({ where: { id } });
  }
}
```

- [ ] **Step 3: Scaffold documents module**

`apps/api/src/modules/documents/documents.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository],
  exports: [DocumentsService],
})
export class DocumentsModule {}
```

`apps/api/src/modules/documents/documents.controller.ts`:
```ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(@Body() body: any) {
    return this.documentsService.create(body);
  }

  @Get('receivable/:receivableId')
  findByReceivable(@Param('receivableId') receivableId: string) {
    return this.documentsService.findByReceivable(receivableId);
  }
}
```

`apps/api/src/modules/documents/documents.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { DocumentsRepository } from './documents.repository';

@Injectable()
export class DocumentsService {
  constructor(private readonly repo: DocumentsRepository) {}

  async create(data: any) {
    return this.repo.create(data);
  }

  async findByReceivable(receivableId: string) {
    return this.repo.findByReceivable(receivableId);
  }
}
```

`apps/api/src/modules/documents/documents.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.document.create({ data });
  }

  async findByReceivable(receivableId: string) {
    return this.prisma.document.findMany({ where: { receivableId } });
  }
}
```

- [ ] **Step 4: Scaffold settlements module**

`apps/api/src/modules/settlements/settlements.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SettlementsRepository } from './settlements.repository';

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService, SettlementsRepository],
  exports: [SettlementsService],
})
export class SettlementsModule {}
```

`apps/api/src/modules/settlements/settlements.controller.ts`:
```ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SettlementsService } from './settlements.service';

@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post()
  create(@Body() body: any) {
    return this.settlementsService.create(body);
  }

  @Get('receivable/:receivableId')
  findByReceivable(@Param('receivableId') receivableId: string) {
    return this.settlementsService.findByReceivable(receivableId);
  }
}
```

`apps/api/src/modules/settlements/settlements.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { SettlementsRepository } from './settlements.repository';

@Injectable()
export class SettlementsService {
  constructor(private readonly repo: SettlementsRepository) {}

  async create(data: any) {
    return this.repo.create(data);
  }

  async findByReceivable(receivableId: string) {
    return this.repo.findByReceivable(receivableId);
  }
}
```

`apps/api/src/modules/settlements/settlements.repository.ts`:
```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class SettlementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.settlement.create({ data });
  }

  async findByReceivable(receivableId: string) {
    return this.prisma.settlement.findMany({ where: { receivableId } });
  }
}
```

- [ ] **Step 5: Scaffold audit module**

`apps/api/src/modules/audit/audit.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
```

`apps/api/src/modules/audit/audit.service.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

export interface AuditLogInput {
  event: string;
  entityId: string;
  entityType: 'receivable' | 'document' | 'settlement' | 'user';
  userId: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    this.logger.log(`[${input.event}] entity=${input.entityId} user=${input.userId}`);
    await this.prisma.auditLog.create({ data: input });
  }

  async findByEntity(entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

- [ ] **Step 6: Scaffold auth module**

`apps/api/src/modules/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

`apps/api/src/modules/auth/auth.controller.ts`:
```ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('stellar/challenge')
  getStellarChallenge(@Body() body: { stellarAddress: string }) {
    return this.authService.getStellarChallenge(body.stellarAddress);
  }

  @Post('stellar/verify')
  verifyStellarChallenge(@Body() body: { signedTransaction: string }) {
    return this.authService.verifyStellarChallenge(body.signedTransaction);
  }
}
```

`apps/api/src/modules/auth/auth.service.ts`:
```ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async getStellarChallenge(stellarAddress: string): Promise<{ challenge: string }> {
    this.logger.log(`getStellarChallenge for: ${stellarAddress}`);
    // TODO: implement SEP-10 challenge generation
    return { challenge: `challenge-${Date.now()}` };
  }

  async verifyStellarChallenge(signedTransaction: string): Promise<{ token: string }> {
    this.logger.log('verifyStellarChallenge called');
    // TODO: implement SEP-10 verification and JWT issuance
    return { token: `jwt-${Date.now()}` };
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/
git commit -m "feat: scaffold business module stubs (receivables, documents, settlements, audit, auth)"
```

---

## Task 8: Wire all modules in AppModule

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Update app.module.ts**

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/prisma/prisma.module';
import { BlockchainModule } from './shared/blockchain/blockchain.module';
import { StorageModule } from './shared/storage/storage.module';
import { KycModule } from './shared/kyc/kyc.module';
import { PaymentsModule } from './shared/payments/payments.module';
import { ReceivablesModule } from './modules/receivables/receivables.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SettlementsModule } from './modules/settlements/settlements.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
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
    AuthModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Install @nestjs/config**

```bash
npm install @nestjs/config -w apps/api
```

- [ ] **Step 3: Verify API compiles and starts**

```bash
npm run dev:api
```

Expected: NestJS starts with no errors. All routes registered:
```
[RoutesResolver] ReceivablesController {/v1/receivables}
[RoutesResolver] DocumentsController {/v1/documents}
[RoutesResolver] SettlementsController {/v1/settlements}
[RoutesResolver] AuthController {/v1/auth}
```

- [ ] **Step 4: Smoke test one endpoint**

```bash
curl http://localhost:3001/v1/receivables
```

Expected: `[]` (empty array — no data, but route works)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/package.json
git commit -m "feat: wire all modules in AppModule, scaffold complete"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run frontend and API together from root**

```bash
npm run dev
```

Expected: Next.js on `:3000` and NestJS on `:3001` both running, no errors.

- [ ] **Step 2: Verify types package is consumed**

In `apps/web`, add a test import in any existing file to verify the types resolve:

```ts
import type { Receivable } from '@credbridge/types';
```

Run TypeScript check:

```bash
npm run build:types && npx tsc --noEmit -w apps/web
```

Expected: no type errors.

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore: monorepo scaffold complete — web, api, and types packages wired"
```

---

## Out of Scope (next plans)

- Business logic implementation per module (receivables validation, settlement flow, audit trail)
- Stellar SDK integration in `stellar.service.ts`
- AWS S3 SDK integration in `s3.service.ts`
- KYC provider integration
- PIX/TED provider integration
- JWT authentication and guards
- Zod/class-validator DTO validation
- Test suites per module
- Docker / docker-compose setup
- CI/CD pipeline
