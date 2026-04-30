# CredBridge

Plataforma de tokenização de recebíveis que conecta PMEs que precisam de crédito com investidores. As empresas submetem seus recebíveis (notas fiscais, duplicatas, contratos), investidores financiam essas operações, e as liquidações acontecem via PIX, TED ou blockchain Stellar. Todo o fluxo é auditado on-chain.

A plataforma possui três perfis de usuário: **PME**, **Investidor** e **Parceiro**.

---

## Arquitetura

Monorepo gerenciado por **npm workspaces** com três pacotes:

| Pacote | Caminho | Descrição |
|---|---|---|
| `@credbridge/web` | `apps/web` | Frontend Next.js 16 (App Router) — dashboards, landing, auth |
| `@credbridge/api` | `apps/api` | Backend NestJS 10 modular monolith — domínio, persistência, integrações |
| `@credbridge/types` | `packages/types` | Tipos TypeScript compartilhados entre frontend e backend |

```
CredBridge/
├── apps/
│   ├── web/                      # Next.js 16 frontend
│   └── api/                      # NestJS 10 backend
│       ├── prisma/               # schema Prisma + migrations
│       ├── prisma.config.ts      # config Prisma 7 (datasource, paths)
│       └── src/
│           ├── main.ts           # bootstrap, prefix /v1, port 3001
│           ├── app.module.ts     # raiz: importa todos módulos
│           ├── shared/           # serviços globais (DI por token)
│           │   ├── prisma/       # PrismaService + PrismaModule (pg adapter)
│           │   ├── blockchain/   # BlockchainService → StellarService
│           │   ├── storage/      # StorageService → S3Service
│           │   ├── kyc/          # KycService → KycProviderService
│           │   └── payments/     # PaymentsService → PixService
│           └── modules/          # business modules
│               ├── receivables/  # controller + service + repo + DTO
│               ├── documents/    # controller + service + repo + DTO
│               ├── settlements/  # controller + service + repo + DTO
│               ├── audit/        # service polimórfico (entity-agnostic)
│               └── auth/         # SEP-10 stellar challenge/verify
└── packages/
    └── types/                    # @credbridge/types
        └── src/
            ├── receivable.ts
            ├── settlement.ts
            ├── investor.ts
            ├── document.ts
            └── index.ts
```

---

## Tecnologias

### Frontend (`apps/web`)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Linguagem | TypeScript 5 |
| UI | React 19 + Tailwind CSS v4 |
| Formulários | React Hook Form + Zod |
| Data fetching | TanStack Query v5 |

### Backend (`apps/api`)

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 10 (modular monolith) |
| Linguagem | TypeScript 5 |
| ORM | Prisma 7 + adapter `@prisma/adapter-pg` |
| Banco | PostgreSQL |
| Config | `@nestjs/config` (global) |
| Blockchain | Stellar (SEP-10 auth + liquidação on-chain) |
| Storage | AWS S3 (interface; impl pendente) |
| Pagamentos | PIX/TED (interface; impl pendente) |
| KYC | Provider externo (interface; impl pendente) |

### Padrões arquiteturais do backend

- **Modular monolith**: cada domínio em `src/modules/*` com `controller → service → repository`.
- **Shared services** em `src/shared/*` expostos via `@Global()` e injetados por **token** (`Symbol`) — desacopla consumidores das implementações concretas.
- **DTOs class-based** em cada módulo (necessário para `emitDecoratorMetadata` do NestJS); reutilizam `union types` de `@credbridge/types`.
- **AuditLog polimórfico**: `entityType`/`entityId` em vez de FKs — único log para qualquer entidade.

---

## Pré-requisitos

- [Node.js](https://nodejs.org) v18 ou superior
- npm v9 ou superior
- PostgreSQL 14+ (rodando local ou remoto) — opcional para o boot, mas obrigatório para queries

---

## Como rodar

```bash
# 1. Instalar dependências (npm workspaces resolve tudo de uma vez)
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite .env com DATABASE_URL e demais segredos
cp apps/web/.env.local.example apps/web/.env.local
# edite apps/web/.env.local com valores reais do frontend

# 3. Build do pacote de tipos compartilhados
npm run build:types

# 4. (Opcional, se for usar DB) gerar Prisma client e aplicar schema
cd apps/api
npx prisma generate
npx prisma migrate dev --name init
cd ../..

# 5. Rodar tudo em modo desenvolvimento
npm run dev
```

Após o `npm run dev`:
- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001/v1](http://localhost:3001/v1)

> Sem PostgreSQL rodando, o NestJS sobe normalmente (com warning `Prisma failed to connect at startup`). Queries falharão até a `DATABASE_URL` apontar para um banco real.

---

## Scripts disponíveis (raiz)

```bash
npm run dev          # roda web + api em paralelo (concurrently)
npm run dev:web      # apenas frontend
npm run dev:api      # apenas backend
npm run build:types  # builda packages/types → dist/
npm run build        # builda types → web → api
npm run lint         # lint em web + api
```

### Scripts por workspace

```bash
# Frontend
npm run build -w apps/web
npm run start -w apps/web
npm run lint -w apps/web

# Backend
npm run build -w apps/api
npm run start -w apps/api
npm run start:prod -w apps/api

# Tipos compartilhados
npm run build -w packages/types
npm run dev -w packages/types   # tsc --watch
```

---

## Variáveis de ambiente

A raiz documenta todas em `.env.example`. Categorias:

- **Database**: `DATABASE_URL` (Postgres)
- **Stellar**: `STELLAR_NETWORK`, `STELLAR_HORIZON_URL`, `STELLAR_SECRET_KEY`
- **AWS S3**: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
- **KYC**: `KYC_PROVIDER_URL`, `KYC_API_KEY`
- **Auth**: `JWT_SECRET`, `JWT_EXPIRES_IN`
- **API**: `PORT` (default 3001)

O frontend mantém `apps/web/.env.local.example` separado para variáveis públicas (`NEXT_PUBLIC_*`).

---

## Endpoints da API (scaffold)

Prefix global: `/v1`

| Método | Rota | Módulo |
|---|---|---|
| `POST` | `/v1/receivables` | criar recebível |
| `GET` | `/v1/receivables` | listar |
| `GET` | `/v1/receivables/:id` | detalhe |
| `POST` | `/v1/documents` | registrar metadados de documento |
| `GET` | `/v1/documents/receivable/:receivableId` | docs por recebível |
| `POST` | `/v1/settlements` | criar settlement |
| `GET` | `/v1/settlements/receivable/:receivableId` | settlements por recebível |
| `POST` | `/v1/auth/stellar/challenge` | gera challenge SEP-10 |
| `POST` | `/v1/auth/stellar/verify` | verifica challenge e emite JWT |

> Os endpoints estão em estado de **stub**: persistem dados via Prisma mas não validam regra de negócio, não emitem eventos de auditoria, não chamam SDKs reais. Implementação por módulo nos próximos planos.

---

## Próximos passos (fora do escopo do scaffold)

- Integração Stellar SDK em `stellar.service.ts`
- Integração AWS S3 em `s3.service.ts`
- Provider de KYC e PIX/TED reais
- Validação SEP-10 + emissão de JWT em `auth.service.ts`
- Validação de DTOs com `class-validator`
- Testes (Jest no backend, Playwright/Vitest no frontend)
- Docker / docker-compose
- CI/CD
