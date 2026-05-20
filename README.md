![CredBridge](docs/brand/readme-banner.svg)

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
├── .env.example                          # variáveis de ambiente compartilhadas (template)
├── .gitignore
├── package.json                          # raiz do monorepo (npm workspaces + scripts)
├── package-lock.json                     # lockfile único do monorepo
├── README.md
├── AGENTS.md                             # instruções para agentes (LLMs) que tocarem o repo
├── CLAUDE.md                             # instruções específicas para o Claude Code
├── docs/                                 # planos de implementação e docs de processo
│   └── superpowers/plans/                # planos versionados (formato superpowers)
├── documentacao/                         # documentação de produto (PT-BR)
│   ├── estrutura.md
│   ├── nota-fiscal-blockchain-flow.png
│   └── Preference - Coding Style.md
│
├── apps/
│   │
│   ├── web/                              # @credbridge/web — Next.js 16 frontend
│   │   ├── package.json                  # name: @credbridge/web
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── postcss.config.mjs            # config PostCSS para Tailwind v4
│   │   ├── eslint.config.mjs
│   │   ├── .env.local.example            # template de envs do frontend (NEXT_PUBLIC_*)
│   │   ├── public/                       # assets estáticos servidos como /
│   │   ├── styles/
│   │   │   └── tokens.css                # design tokens (fonte da verdade visual)
│   │   └── src/
│   │       ├── app/                      # App Router do Next 16
│   │       │   ├── layout.tsx            # root layout
│   │       │   ├── globals.css
│   │       │   ├── favicon.ico
│   │       │   ├── (marketing)/          # rota agrupada — landing pública
│   │       │   │   └── page.tsx
│   │       │   ├── (auth)/               # rota agrupada — login + onboarding
│   │       │   │   ├── layout.tsx
│   │       │   │   ├── login/page.tsx
│   │       │   │   └── onboarding/page.tsx
│   │       │   ├── (pme)/                # rota agrupada — dashboard PME
│   │       │   │   ├── layout.tsx
│   │       │   │   └── pme/dashboard/page.tsx
│   │       │   ├── (investor)/           # rota agrupada — dashboard Investidor
│   │       │   │   ├── layout.tsx
│   │       │   │   └── investor/dashboard/page.tsx
│   │       │   └── (partner)/            # rota agrupada — dashboard Parceiro
│   │       │       ├── layout.tsx
│   │       │       └── partner/dashboard/page.tsx
│   │       ├── components/
│   │       │   ├── primitives/           # átomos reutilizáveis (Icon, Logo, StatusBadge)
│   │       │   ├── patterns/             # padrões compostos (Sidebar, TopNav, AppTopBar, Timeline, MiniKpi)
│   │       │   ├── auth/                 # KycFlow, LoginBG, StellarAuth
│   │       │   ├── marketing/            # HeroNetwork, Audiences, HowItWorks, StatsBar, LandingFooter
│   │       │   ├── pme/                  # InvoiceTable, PipelineCard, PipelineCol, UploadZone, YieldSpark
│   │       │   ├── investor/             # NavChart, ShareCard
│   │       │   └── partner/              # TrafficChart
│   │       ├── hooks/                    # hooks reutilizáveis (useTheme, etc.)
│   │       ├── lib/
│   │       │   ├── api/                  # clientes HTTP por domínio (receivables, documents, settlements, audit)
│   │       │   ├── i18n/                 # traduções PT/EN + useTranslation
│   │       │   ├── validations/          # schemas Zod por domínio
│   │       │   └── format.ts             # helpers de formatação (moeda, datas)
│   │       ├── providers/                # QueryProvider (TanStack Query)
│   │       └── types/
│   │           ├── index.ts              # tipos locais do frontend
│   │           └── shared.ts             # re-export dos tipos do @credbridge/types
│   │
│   └── api/                              # @credbridge/api — NestJS 10 backend
│       ├── package.json                  # name: @credbridge/api (postinstall: prisma generate)
│       ├── nest-cli.json
│       ├── tsconfig.json
│       ├── tsconfig.build.json
│       ├── eslint.config.mjs
│       ├── prisma.config.ts              # config Prisma 7 (datasource, migrations path)
│       ├── prisma/
│       │   └── schema.prisma             # modelos: Receivable, Document, Settlement, AuditLog
│       ├── test/                         # testes e2e (Jest)
│       └── src/
│           ├── main.ts                   # bootstrap, setGlobalPrefix('v1'), porta 3001
│           ├── app.module.ts             # raiz: importa ConfigModule + todos módulos shared/business
│           ├── shared/                   # serviços globais (DI por token Symbol)
│           │   ├── prisma/               # PrismaService + PrismaModule (Prisma 7 + adapter pg)
│           │   ├── blockchain/           # interface + StellarService stub + BlockchainModule
│           │   ├── storage/              # interface + S3Service stub + StorageModule
│           │   ├── kyc/                  # interface + KycProviderService stub + KycModule
│           │   └── payments/             # interface + PixService stub + PaymentsModule
│           └── modules/                  # business modules (controller → service → repository)
│               ├── receivables/          # CRUD básico + DTO (CreateReceivableDto)
│               ├── documents/            # registro metadado + DTO (CreateDocumentDto)
│               ├── settlements/          # CRUD básico + DTO (CreateSettlementDto)
│               ├── audit/                # AuditService polimórfico (entityType/entityId)
│               └── auth/                 # SEP-10 stellar challenge/verify (stub)
│
└── packages/
    └── types/                            # @credbridge/types — tipos compartilhados
        ├── package.json                  # name: @credbridge/types (build → dist)
        ├── tsconfig.json
        └── src/
            ├── receivable.ts             # Receivable, ReceivableStatus, ReceivableType, CreateReceivableInput
            ├── settlement.ts             # Settlement, SettlementStatus, SettlementMethod, CreateSettlementInput
            ├── investor.ts               # Investor
            ├── document.ts               # Document, DocumentType, UploadDocumentInput
            └── index.ts                  # barrel: re-exporta tudo
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
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose — para subir o PostgreSQL localmente (recomendado)
  - Alternativa: PostgreSQL 14+ instalado e rodando na máquina

---

## Como rodar

### 1. Clonar e instalar dependências

```bash
git clone <repo-url>
cd CredBridge
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
```

Os valores padrão do `.env` já funcionam com o banco Docker abaixo — não é necessário editar nada para rodar localmente.

### 3. Subir o banco de dados

**Com Docker (recomendado):**

```bash
docker compose up -d
```

Isso sobe um PostgreSQL 16 na porta `5432` com usuário `credbridge`, senha `credbridge` e banco `credbridge` — exatamente o que está no `.env.example`.

**Sem Docker:** certifique-se de ter um PostgreSQL rodando e ajuste `DATABASE_URL` no `.env`.

### 4. Build dos tipos compartilhados e migração

```bash
npm run build:types

cd apps/api
npx prisma migrate dev --name init
cd ../..
```

### 5. Rodar em modo desenvolvimento

```bash
npm run dev
```

Após o `npm run dev`:
- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001/v1](http://localhost:3001/v1)

> O banco sobe vazio. Crie usuários via `POST /v1/auth/register` ou use a tela de login/onboarding.

---

## Scripts disponíveis (raiz)

```bash
npm run dev          # roda web + api em paralelo (concurrently)
npm run dev:web      # apenas frontend (Next.js em :3000)
npm run dev:api      # apenas backend (NestJS em :3001)
npm run build:types  # builda packages/types → dist/
npm run build:web    # builda types + apps/web (usado pelo deploy Vercel)
npm run build:api    # builda types + apps/api (prisma generate + nest build)
npm run build        # alias de build:web (escopo do deploy Vercel)
npm run lint         # lint em web + api
```

> **Por que `build` é só web?** O deploy Vercel roda `npm run build` na raiz. NestJS não roda em ambiente Vercel — o backend deve ir para Railway/Fly/Render. Para buildar a API local ou em CI próprio, use `npm run build:api`.

### Scripts por workspace

```bash
# Frontend (apps/web)
npm run build -w apps/web    # next build
npm run start -w apps/web    # next start (build de produção)
npm run lint -w apps/web

# Backend (apps/api)
npm run build -w apps/api    # prisma generate && nest build
npm run start -w apps/api    # nest start
npm run start:prod -w apps/api  # node dist/main (produção)
npm run test -w apps/api     # jest
npm run test:e2e -w apps/api # jest e2e

# Tipos compartilhados (packages/types)
npm run build -w packages/types  # tsc → dist/
npm run dev -w packages/types    # tsc --watch
```

---

## Variáveis de ambiente

A raiz documenta todas em `.env.example`. Categorias:

- **Database**: `DATABASE_URL` (Postgres)
- **Stellar**: `STELLAR_NETWORK`, `STELLAR_HORIZON_URL`, `STELLAR_SECRET_KEY`
- **AWS S3**: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`
- **KYC**: `KYC_PROVIDER_URL`, `KYC_API_KEY`
- **Auth**: `JWT_SECRET`, `JWT_EXPIRES_IN`, `WEB_ORIGIN`, `WEBAUTHN_RP_ID`
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
