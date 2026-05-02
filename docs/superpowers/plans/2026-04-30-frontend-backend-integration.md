# Frontend ↔ Backend Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Conectar `@credbridge/web` ao `@credbridge/api` real. Hoje frontend usa hooks TanStack Query mas: tipos divergem, rotas não batem, sem CORS, sem mutações. Plano consolida tipos em `@credbridge/types`, alinha endpoints, habilita CORS, cria wrapper de fetch, adiciona mutations.

**Out of scope:** validação de DTO com `class-validator` (plano 2), JWT/auth real (plano 3), integração Stellar/S3/PIX (planos seguintes).

**Tech Stack:** Next.js 16, NestJS 10, TanStack Query v5, `@credbridge/types`, Prisma 7.

---

## Decisões arquiteturais

1. **`@credbridge/types` é fonte da verdade.** Web e api importam de lá. Schema canonical.
2. **Schema canonical inclui campos do front que faltavam no back** (`debtorName`, `debtorDocument`). Prisma schema atualiza pra refletir.
3. **CORS via whitelist:** `WEB_URL` no `.env` da api, default `http://localhost:3000`.
4. **Wrapper único de fetch** em `apps/web/src/lib/api/client.ts`. Todos os hooks usam.
5. **Mutations invalidam queries** via `queryClient.invalidateQueries({ queryKey: [...] })` no `onSuccess`.
6. **Sem axios.** Fetch nativo + wrapper.
7. **Tipos do front que ainda fazem sentido só no front** (ex: `UserRole`, `Lang`) ficam em `apps/web/src/types/index.ts`. Tipos de domínio compartilhado migram pra `@credbridge/types`.

---

## File Map

### Modified — `packages/types`
- `packages/types/src/receivable.ts` — adiciona `debtorName`, `debtorDocument`; consolida `ReceivableStatus`
- `packages/types/src/document.ts` — adiciona `createdAt`; ajusta `DocumentType`
- `packages/types/src/settlement.ts` — adiciona `paymentMethod` alias, ajusta `SettlementStatus`
- `packages/types/src/audit.ts` — **novo**, define `AuditEvent`, `AuditEntityType`
- `packages/types/src/index.ts` — re-exporta `audit.ts`

### Modified — `apps/api`
- `apps/api/prisma/schema.prisma` — `Receivable.debtorName`, `Receivable.debtorDocument`; alinhamento de campos
- `apps/api/prisma/migrations/<timestamp>_align_with_shared_types/` — nova migration
- `apps/api/src/main.ts` — `app.enableCors(...)`
- `apps/api/src/modules/receivables/receivables.repository.ts` — passa novos campos
- `apps/api/src/modules/receivables/receivables.controller.ts` — usa tipo canonical
- `apps/api/src/modules/documents/documents.controller.ts` — rota muda pra `/v1/receivables/:receivableId/documents`
- `apps/api/src/modules/settlements/settlements.controller.ts` — adiciona `@Get()` listAll
- `apps/api/src/modules/settlements/settlements.service.ts` — adiciona `findAll()`
- `apps/api/src/modules/settlements/settlements.repository.ts` — adiciona `findAll()`
- `apps/api/src/modules/audit/audit.module.ts` — registra `AuditController`
- `apps/api/src/modules/audit/audit.controller.ts` — **novo**, expõe `GET /v1/audit?entityId=...`

### Created — `apps/web`
- `apps/web/src/lib/api/client.ts` — wrapper fetch (base URL, JSON, error mapping)
- `apps/web/src/lib/api/mutations.ts` — opcional: helpers de invalidation

### Modified — `apps/web`
- `apps/web/src/types/index.ts` — remove tipos duplicados, mantém só locais
- `apps/web/src/types/shared.ts` — re-export ampliado de `@credbridge/types`
- `apps/web/src/lib/api/receivables.ts` — usa wrapper, tipos do `@credbridge/types`, adiciona `useCreateReceivable`
- `apps/web/src/lib/api/documents.ts` — usa wrapper, adiciona `useCreateDocument`, ajusta rota
- `apps/web/src/lib/api/settlements.ts` — usa wrapper, adiciona `useSettlementsByReceivable`, `useCreateSettlement`
- `apps/web/src/lib/api/audit.ts` — usa wrapper

### Created (env)
- `apps/api/.env.example` — documenta `WEB_URL`, `DATABASE_URL`, `PORT`

---

## Task 1: Consolidar tipos canonicals em `@credbridge/types`

**Files:**
- Modify: `packages/types/src/receivable.ts`
- Modify: `packages/types/src/document.ts`
- Modify: `packages/types/src/settlement.ts`
- Create: `packages/types/src/audit.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Atualizar `receivable.ts`**

```ts
export type ReceivableStatus = 'pending' | 'validated' | 'active' | 'settled' | 'defaulted';
export type ReceivableType = 'invoice' | 'duplicate' | 'contract';

export interface Receivable {
  id: string;
  userId: string;
  value: number;
  type: ReceivableType;
  status: ReceivableStatus;
  debtorName: string;
  debtorDocument: string;
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
  debtorName: string;
  debtorDocument: string;
  dueDate: string;
}
```

- [ ] **Step 2: Atualizar `document.ts`**

```ts
export type DocumentType = 'invoice' | 'contract' | 'duplicate' | 'kyc';

export interface Document {
  id: string;
  receivableId: string;
  url: string;
  hash: string;
  type: DocumentType;
  createdAt: string;
}

export interface UploadDocumentInput {
  receivableId: string;
  type: DocumentType;
  file: Buffer;
  filename: string;
}

export interface RegisterDocumentInput {
  receivableId: string;
  type: DocumentType;
  url: string;
  hash: string;
}
```

- [ ] **Step 3: Atualizar `settlement.ts`**

```ts
export type SettlementStatus = 'pending' | 'completed' | 'failed';
export type SettlementMethod = 'pix' | 'ted' | 'stellar';

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

- [ ] **Step 4: Criar `audit.ts`**

```ts
export type AuditEntityType = 'receivable' | 'document' | 'settlement' | 'user';

export interface AuditEvent {
  id: string;
  event: string;
  entityId: string;
  entityType: AuditEntityType;
  userId: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

- [ ] **Step 5: Atualizar `index.ts`**

```ts
export * from './receivable';
export * from './settlement';
export * from './investor';
export * from './document';
export * from './audit';
```

- [ ] **Step 6: Build**

```bash
npm run build:types
```

Expected: zero erros, `packages/types/dist/audit.d.ts` existe.

---

## Task 2: Atualizar Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_align_with_shared_types/migration.sql`

- [ ] **Step 1: Adicionar campos no `Receivable`**

```prisma
model Receivable {
  id             String   @id @default(uuid())
  userId         String
  value          Float
  type           String
  status         String   @default("pending")
  debtorName     String
  debtorDocument String
  documentHash   String?
  txHash         String?
  dueDate        DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  documents      Document[]
  settlements    Settlement[]
}
```

- [ ] **Step 2: Renomear `Document.uploadedAt` → `createdAt`**

```prisma
model Document {
  id           String     @id @default(uuid())
  receivableId String
  url          String
  hash         String
  type         String
  createdAt    DateTime   @default(now())

  receivable   Receivable @relation(fields: [receivableId], references: [id])
}
```

- [ ] **Step 3: Validar e gerar migration**

Pre-requisito: Postgres rodando (docker exemplo no README), `DATABASE_URL` setado em `apps/api/.env` ou raiz.

```bash
cd apps/api
npx prisma validate
npx prisma migrate dev --name align_with_shared_types
```

Expected: migration criada em `apps/api/prisma/migrations/<timestamp>_align_with_shared_types/`. Schema aplicado no DB.

- [ ] **Step 4: Build api confirma client regenerado**

```bash
npm run build:api
```

Expected: zero erros.

---

## Task 3: Habilitar CORS no backend

**Files:**
- Modify: `apps/api/src/main.ts`
- Create: `apps/api/.env.example`

- [ ] **Step 1: Atualizar `main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

- [ ] **Step 2: Criar `apps/api/.env.example`**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/credbridge
PORT=3001
WEB_URL=http://localhost:3000
```

- [ ] **Step 3: Verificar boot e header CORS**

```bash
npm run dev:api &
sleep 5
curl -i -X OPTIONS http://localhost:3001/v1/receivables \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: GET'
```

Expected: resposta com `Access-Control-Allow-Origin: http://localhost:3000`.

---

## Task 4: Completar endpoints do backend

**Files:**
- Modify: `apps/api/src/modules/documents/documents.controller.ts`
- Modify: `apps/api/src/modules/settlements/settlements.controller.ts`
- Modify: `apps/api/src/modules/settlements/settlements.service.ts`
- Modify: `apps/api/src/modules/settlements/settlements.repository.ts`
- Create: `apps/api/src/modules/audit/audit.controller.ts`
- Modify: `apps/api/src/modules/audit/audit.module.ts`
- Modify: `apps/api/src/modules/receivables/receivables.repository.ts` (novos campos)
- Modify: `apps/api/src/modules/receivables/dto/create-receivable.dto.ts` (novos campos)

- [ ] **Step 1: Atualizar `CreateReceivableDto` e repository**

`apps/api/src/modules/receivables/dto/create-receivable.dto.ts`:
```ts
import { ReceivableType } from '@credbridge/types';

export class CreateReceivableDto {
  userId!: string;
  value!: number;
  type!: ReceivableType;
  debtorName!: string;
  debtorDocument!: string;
  dueDate!: string;
}
```

`apps/api/src/modules/receivables/receivables.repository.ts`:
```ts
async create(data: CreateReceivableDto) {
  return this.prisma.receivable.create({
    data: {
      userId: data.userId,
      value: data.value,
      type: data.type,
      debtorName: data.debtorName,
      debtorDocument: data.debtorDocument,
      dueDate: new Date(data.dueDate),
    },
  });
}
```

- [ ] **Step 2: Trocar rota de documents pra nested em receivables**

`apps/api/src/modules/documents/documents.controller.ts`:
```ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('receivables/:receivableId/documents')
  create(@Param('receivableId') receivableId: string, @Body() body: Omit<CreateDocumentDto, 'receivableId'>) {
    return this.documentsService.create({ ...body, receivableId });
  }

  @Get('receivables/:receivableId/documents')
  findByReceivable(@Param('receivableId') receivableId: string) {
    return this.documentsService.findByReceivable(receivableId);
  }
}
```

Rotas finais: `POST /v1/receivables/:receivableId/documents`, `GET /v1/receivables/:receivableId/documents`.

- [ ] **Step 3: Adicionar `findAll` em settlements**

`apps/api/src/modules/settlements/settlements.repository.ts`:
```ts
async findAll() {
  return this.prisma.settlement.findMany({ orderBy: { createdAt: 'desc' } });
}
```

`apps/api/src/modules/settlements/settlements.service.ts`:
```ts
async findAll() {
  return this.repo.findAll();
}
```

`apps/api/src/modules/settlements/settlements.controller.ts`:
```ts
@Get()
findAll() {
  return this.settlementsService.findAll();
}
```

- [ ] **Step 4: Criar `AuditController`**

`apps/api/src/modules/audit/audit.controller.ts`:
```ts
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findByEntity(@Query('entityId') entityId: string) {
    if (!entityId) {
      throw new BadRequestException('entityId is required');
    }
    return this.auditService.findByEntity(entityId);
  }
}
```

- [ ] **Step 5: Registrar controller no module**

`apps/api/src/modules/audit/audit.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
```

- [ ] **Step 6: Verificar build e rotas**

```bash
npm run build:api
npm run dev:api &
sleep 5
curl http://localhost:3001/v1/audit?entityId=test
```

Expected: 200 com `[]` (entityId inexistente, mas rota funciona).

---

## Task 5: Wrapper de fetch no frontend

**Files:**
- Create: `apps/web/src/lib/api/client.ts`

- [ ] **Step 1: Criar `client.ts`**

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    super(`API ${status} ${statusText}`);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(`${API_BASE}/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new ApiError(response.status, response.statusText, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
```

- [ ] **Step 2: Build web confirma resolve `process.env`**

```bash
npm run build:web
```

Expected: zero erros.

---

## Task 6: Migrar tipos do frontend pra `@credbridge/types`

**Files:**
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/types/shared.ts`

- [ ] **Step 1: `shared.ts` re-exporta tudo**

```ts
export type {
  Receivable,
  ReceivableStatus,
  ReceivableType,
  CreateReceivableInput,
  Document,
  DocumentType,
  RegisterDocumentInput,
  Settlement,
  SettlementStatus,
  SettlementMethod,
  CreateSettlementInput,
  Investor,
  AuditEvent,
  AuditEntityType,
} from '@credbridge/types';
```

- [ ] **Step 2: `index.ts` mantém só tipos locais do front**

```ts
export type UserRole = 'pme' | 'investor' | 'partner';
export type Lang = 'pt' | 'en';

export type {
  Receivable,
  ReceivableStatus,
  Document,
  DocumentType,
  Settlement,
  SettlementStatus,
  AuditEvent,
} from './shared';
```

- [ ] **Step 3: TS check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: zero erros. Componentes que usam `@/types` continuam compilando porque `index.ts` re-exporta os mesmos nomes.

---

## Task 7: Atualizar hooks do frontend pra usar wrapper + adicionar mutations

**Files:**
- Modify: `apps/web/src/lib/api/receivables.ts`
- Modify: `apps/web/src/lib/api/documents.ts`
- Modify: `apps/web/src/lib/api/settlements.ts`
- Modify: `apps/web/src/lib/api/audit.ts`

- [ ] **Step 1: `receivables.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Receivable, CreateReceivableInput } from '@credbridge/types';
import { apiFetch } from './client';

export const receivableQueryKeys = {
  all: ['receivables'] as const,
  detail: (id: string) => ['receivables', id] as const,
};

export function useReceivables() {
  return useQuery<Receivable[]>({
    queryKey: receivableQueryKeys.all,
    queryFn: () => apiFetch<Receivable[]>('/receivables'),
  });
}

export function useReceivable(id: string) {
  return useQuery<Receivable>({
    queryKey: receivableQueryKeys.detail(id),
    queryFn: () => apiFetch<Receivable>(`/receivables/${id}`),
    enabled: !!id,
  });
}

export function useCreateReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReceivableInput) =>
      apiFetch<Receivable>('/receivables', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: receivableQueryKeys.all });
    },
  });
}
```

- [ ] **Step 2: `documents.ts` (rota nested)**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Document, RegisterDocumentInput } from '@credbridge/types';
import { apiFetch } from './client';

export const documentQueryKeys = {
  byReceivable: (receivableId: string) => ['documents', 'receivable', receivableId] as const,
};

export function useDocumentsByReceivable(receivableId: string) {
  return useQuery<Document[]>({
    queryKey: documentQueryKeys.byReceivable(receivableId),
    queryFn: () => apiFetch<Document[]>(`/receivables/${receivableId}/documents`),
    enabled: !!receivableId,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterDocumentInput) => {
      const { receivableId, ...rest } = input;
      return apiFetch<Document>(`/receivables/${receivableId}/documents`, {
        method: 'POST',
        body: rest,
      });
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({
        queryKey: documentQueryKeys.byReceivable(input.receivableId),
      });
    },
  });
}
```

- [ ] **Step 3: `settlements.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Settlement, CreateSettlementInput } from '@credbridge/types';
import { apiFetch } from './client';

export const settlementQueryKeys = {
  all: ['settlements'] as const,
  byReceivable: (receivableId: string) => ['settlements', 'receivable', receivableId] as const,
};

export function useSettlements() {
  return useQuery<Settlement[]>({
    queryKey: settlementQueryKeys.all,
    queryFn: () => apiFetch<Settlement[]>('/settlements'),
  });
}

export function useSettlementsByReceivable(receivableId: string) {
  return useQuery<Settlement[]>({
    queryKey: settlementQueryKeys.byReceivable(receivableId),
    queryFn: () => apiFetch<Settlement[]>(`/settlements/receivable/${receivableId}`),
    enabled: !!receivableId,
  });
}

export function useCreateSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSettlementInput) =>
      apiFetch<Settlement>('/settlements', { method: 'POST', body: input }),
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: settlementQueryKeys.all });
      queryClient.invalidateQueries({
        queryKey: settlementQueryKeys.byReceivable(input.receivableId),
      });
    },
  });
}
```

- [ ] **Step 4: `audit.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import type { AuditEvent } from '@credbridge/types';
import { apiFetch } from './client';

export const auditQueryKeys = {
  byEntity: (entityId: string) => ['audit', entityId] as const,
};

export function useAuditTrail(entityId: string) {
  return useQuery<AuditEvent[]>({
    queryKey: auditQueryKeys.byEntity(entityId),
    queryFn: () => apiFetch<AuditEvent[]>(`/audit?entityId=${encodeURIComponent(entityId)}`),
    enabled: !!entityId,
  });
}
```

- [ ] **Step 5: Build web**

```bash
npm run build:web
```

Expected: zero erros.

---

## Task 8: Smoke test end-to-end

- [ ] **Step 1: Subir Postgres + aplicar migrations**

```bash
docker run -d --name credbridge-pg -p 5432:5432 \
  -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=credbridge \
  postgres:16

echo 'DATABASE_URL=postgresql://user:password@localhost:5432/credbridge' > .env
echo 'WEB_URL=http://localhost:3000' >> .env

cd apps/api && npx prisma migrate deploy && cd ../..
```

- [ ] **Step 2: Rodar tudo**

```bash
npm run dev
```

- [ ] **Step 3: Curl direto na API**

```bash
# Criar receivable
curl -X POST http://localhost:3001/v1/receivables \
  -H 'Content-Type: application/json' \
  -d '{
    "userId":"u1",
    "value":1000,
    "type":"invoice",
    "debtorName":"ACME LTDA",
    "debtorDocument":"12345678000199",
    "dueDate":"2026-12-01"
  }'

# Listar
curl http://localhost:3001/v1/receivables
```

Expected: array com o receivable criado.

- [ ] **Step 4: Browser dev tools**

Abrir `http://localhost:3000`, ir num componente que usa `useReceivables` (ex: `apps/web/src/components/pme/InvoiceTable.tsx`), abrir DevTools → Network. Confirmar:
- Request pra `http://localhost:3001/v1/receivables`
- Response 200 com header `Access-Control-Allow-Origin: http://localhost:3000`
- Body com array

- [ ] **Step 5: TanStack DevTools**

`ReactQueryDevtools` (já no `QueryProvider`) mostra a query `['receivables']` com state `success`.

---

## Task 9: Verificação final

- [ ] **Step 1: Build completo**

```bash
npm run build:types
npm run build:web
npm run build:api
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit final**

Mensagem sugerida:
```
feat(integration): connect web to api end-to-end

- consolidate domain types in @credbridge/types (receivable, document, settlement, audit)
- align prisma schema with shared types (debtorName, debtorDocument; document.createdAt)
- enable CORS on api with WEB_URL whitelist
- complete missing endpoints (audit controller, settlements list, documents nested route)
- introduce typed apiFetch wrapper in web with ApiError class
- add mutation hooks (useCreateReceivable, useCreateDocument, useCreateSettlement)
- migrate web types to import from @credbridge/types
```

---

## Out of Scope (próximos planos)

- Validação de DTO com `class-validator` + `ValidationPipe` (plano 2)
- Auth real SEP-10 + JWT guards (plano 3)
- Audit hooks automáticos via interceptor (plano 4)
- Integrações reais Stellar/S3/PIX/KYC (planos seguintes, um por integração)
- Upload de arquivo real (multipart) — hoje doc só registra metadata
- Hospedagem da API (Railway/Fly) e env de produção
- E2E tests (Playwright)
