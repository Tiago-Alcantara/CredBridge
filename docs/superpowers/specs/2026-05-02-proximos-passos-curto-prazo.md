# Próximos Passos — Curto Prazo

> **Data:** 2026-05-02
> **Escopo:** 3 fases sequenciais. Cada fase desbloqueia a próxima.
> **Fora do escopo:** Stellar, S3, PIX, KYC, Railway/Fly deploy, E2E tests.

---

## Estado atual

| Item | Status |
|---|---|
| Monorepo (web + api + types) | ✅ Feito |
| Docker Compose (Postgres local) | ✅ Feito |
| Prisma schema + migration inicial | ✅ Feito |
| CORS habilitado na API | ✅ Feito |
| Endpoint `GET /v1/health/ping` | ✅ Feito |
| Página `/test` (smoke test manual) | ✅ Feito |
| Integração front ↔ back real | ❌ Pendente |
| Validação de DTOs | ❌ Pendente |
| Autenticação (JWT) | ❌ Pendente |

---

## Fase 1 — Integração Front ↔ Back

**Objetivo:** O frontend chama o backend real com tipos corretos. Sem mocks, sem dados hardcoded.

**Plano detalhado:** `docs/superpowers/plans/2026-04-30-frontend-backend-integration.md`

**Critério de conclusão:** `curl` cria um receivable, browser DevTools confirma request com `Access-Control-Allow-Origin` correto, TanStack DevTools mostra query `['receivables']` com estado `success`.

### Tasks

- [x] **1.1** Consolidar tipos canônicos em `@credbridge/types`
  - Atualizar `receivable.ts` — adicionar `debtorName`, `debtorDocument`
  - Atualizar `document.ts` — renomear `uploadedAt` → `createdAt`
  - Atualizar `settlement.ts` — adicionar `SettlementMethod`
  - Criar `audit.ts` — `AuditEvent`, `AuditEntityType`
  - Rodar `npm run build:types`

- [x] **1.2** Atualizar Prisma schema + migration
  - Adicionar `debtorName` e `debtorDocument` no model `Receivable`
  - Renomear `Document.uploadedAt` → `createdAt`
  - Rodar `npx prisma migrate dev --name align_with_shared_types`

- [x] **1.3** Completar endpoints faltantes no backend
  - `GET /v1/audit?entityId=` — novo `AuditController`
  - `GET /v1/settlements` — adicionar `findAll`
  - Mover documents para rota nested: `POST /v1/receivables/:id/documents`

- [x] **1.4** Criar wrapper `apiFetch` no frontend
  - Criar `apps/web/src/lib/api/client.ts`
  - Classe `ApiError` com `status`, `statusText`, `body`

- [x] **1.5** Migrar hooks do frontend
  - `receivables.ts` — usar `apiFetch`, adicionar `useCreateReceivable`
  - `documents.ts` — usar `apiFetch`, rota nested, adicionar `useCreateDocument`
  - `settlements.ts` — usar `apiFetch`, adicionar `useCreateSettlement`
  - `audit.ts` — usar `apiFetch`

- [x] **1.6** Smoke test
  - `npm run dev` (web + api)
  - `curl` cria receivable e lista
  - Browser confirma CORS + TanStack DevTools confirma query `success`
  - Build completo sem erros: `npm run build:types && npm run build:web && npm run build:api`

---

## Fase 2 — Validação de DTOs

**Objetivo:** A API rejeita inputs inválidos com mensagens de erro claras (`400 Bad Request`). O frontend trata esses erros e exibe para o usuário.

**Pré-requisito:** Fase 1 concluída.

**Critério de conclusão:** `curl` com body inválido retorna `400` com array de erros. Frontend exibe a mensagem ao usuário.

### Tasks

- [x] **2.1** Instalar dependências
  ```bash
  cd apps/api && npm install class-validator class-transformer
  ```

- [x] **2.2** Habilitar `ValidationPipe` global em `main.ts`
  ```ts
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  ```

- [x] **2.3** Decorar DTOs com validações
  - `CreateReceivableDto` — `@IsString()`, `@IsNumber()`, `@IsDateString()`, etc.
  - `CreateDocumentDto`
  - `CreateSettlementDto`

- [x] **2.4** Frontend trata `ApiError` com status `400`
  - Exibir `error.body.message` no componente que chamou a mutation

- [x] **2.5** Verificação
  ```bash
  curl -X POST http://localhost:3001/v1/receivables \
    -H 'Content-Type: application/json' \
    -d '{"userId":"u1"}'
  # Esperado: 400 com mensagens de validação
  ```

---

## Fase 3 — Autenticação (JWT)

**Objetivo:** Rotas protegidas exigem token JWT. Usuário faz login/registro e o frontend envia o token em todas as requisições.

**Pré-requisito:** Fase 2 concluída.

**Critério de conclusão:** `GET /v1/receivables` sem token retorna `401`. Com token válido retorna `200`.

### Tasks

- [x] **3.1** Instalar dependências
  ```bash
  cd apps/api && npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
  npm install -D @types/passport-jwt @types/bcrypt
  ```

- [x] **3.2** Criar `User` model no Prisma
  ```prisma
  model User {
    id           String   @id @default(uuid())
    email        String   @unique
    passwordHash String
    role         String   @default("pme")
    createdAt    DateTime @default(now())
  }
  ```
  Rodar migration: `npx prisma migrate dev --name add_user`

- [x] **3.3** Criar `AuthModule` com endpoints
  - `POST /v1/auth/register` — cria usuário com senha hasheada (`bcrypt`)
  - `POST /v1/auth/login` — valida senha, retorna `{ accessToken }`

- [x] **3.4** Criar `JwtAuthGuard` e `JwtStrategy`
  - `JwtStrategy` valida token, injeta `req.user`
  - `@UseGuards(JwtAuthGuard)` nas rotas que precisam de autenticação

- [x] **3.5** Proteger rotas de domínio
  - Receivables, Documents, Settlements, Audit — todos exigem token

- [x] **3.6** Frontend armazena e envia token
  - Salvar `accessToken` em `localStorage` (ou cookie httpOnly — preferível)
  - `apiFetch` adiciona `Authorization: Bearer <token>` automaticamente
  - Redirecionar para `/login` quando `ApiError.status === 401`

- [x] **3.7** Verificação
  ```bash
  # Sem token
  curl http://localhost:3001/v1/receivables
  # Esperado: 401

  # Com token
  TOKEN=$(curl -s -X POST http://localhost:3001/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@test.com","password":"secret"}' | jq -r '.accessToken')

  curl http://localhost:3001/v1/receivables \
    -H "Authorization: Bearer $TOKEN"
  # Esperado: 200
  ```

---

## Ordem de execução

```
Fase 1 (integração)  →  Fase 2 (validação)  →  Fase 3 (auth)
```

Não pule fases. Auth sem integração funcional cria débito técnico difícil de depurar.
