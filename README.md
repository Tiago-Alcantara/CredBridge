![CredBridge](docs/brand/readme-banner.svg)

# CredBridge

CredBridge e uma plataforma de tokenizacao de recebiveis para PMEs, investidores e parceiros. O produto hoje prioriza NF-e no fluxo operacional, com autenticacao Privy, API NestJS, dashboard Next.js e trilha on-chain via Stellar/Soroban.

## Arquitetura

Monorepo gerenciado por **npm workspaces**:

| Workspace | Caminho | Responsabilidade |
|---|---|---|
| `@credbridge/web` | `apps/web` | Frontend Next.js 16, App Router, dashboards, landing, auth e UX de wallet |
| `@credbridge/api` | `apps/api` | Backend NestJS 11 modular monolith, Prisma, auth, dominio e integracoes |
| `@credbridge/types` | `packages/types` | Tipos TypeScript compartilhados entre web e API |
| `@credbridge/anchor-client` | `packages/anchor-client` | Cliente Stellar Anchor/Etherfuse, SEP-10, SEP-24 e SEP-38 |

Tambem existe `contracts/`, um crate Rust/Soroban para o contrato de NF-e tokenizada. Ele nao e workspace npm.

```text
CredBridge/
├── apps/
│   ├── web/                  # Next.js 16 + React 19 + Tailwind v4
│   │   ├── src/app/          # App Router: marketing, auth, PME, investor, partner, auditoria
│   │   ├── src/components/   # primitives, patterns, auth, pme, investor, partner, anchor
│   │   ├── src/lib/          # API clients, i18n, validations, wallet, financial actions
│   │   ├── src/providers/    # Query, Toast, Privy e Google auth providers
│   │   └── styles/tokens.css # fonte da verdade visual
│   └── api/                  # NestJS 11 + Prisma 7
│       ├── prisma/           # schema, migrations e seed
│       └── src/
│           ├── modules/      # auth, receivables, documents, settlements, audit, investments, anchor, wallet
│           ├── shared/       # prisma, blockchain, storage, kyc, payments
│           └── common/       # filtros e infraestrutura HTTP
├── packages/
│   ├── types/                # tipos compartilhados de dominio
│   └── anchor-client/        # cliente Etherfuse/Stellar Anchor
├── contracts/                # contrato Soroban de NF-e
├── docs/                     # design system, status, specs e planos
├── documentacao/             # docs operacionais em PT-BR
├── docker-compose.yml        # Postgres local
└── package.json              # scripts raiz e workspaces
```

## Tecnologias

### Frontend (`apps/web`)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 App Router |
| Build | `next build --webpack` no build de producao atual |
| UI | React 19, Tailwind CSS v4, CSS tokens em `apps/web/styles/tokens.css` |
| Auth | Privy, Google OAuth direto legado, JWT interno CredBridge |
| Data fetching | TanStack Query v5 |
| Form/validacao | React Hook Form, Zod |
| Testes | Vitest + Testing Library |

### Backend (`apps/api`)

| Camada | Tecnologia |
|---|---|
| Framework | NestJS 11 modular monolith |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Banco | PostgreSQL |
| Auth | Privy server-side, JWT interno, login/senha legado, Google direto legado, SEP-10 legado |
| Blockchain | Stellar SDK, Soroban RPC, contrato de NF-e, TESOURO via Etherfuse |
| Protecao HTTP | Helmet, CORS, ValidationPipe, Throttler global |
| Testes | Jest |

### Blockchain e Anchor

- `contracts/` contem o contrato Soroban `nfe-contract`.
- `apps/api/src/shared/blockchain/stellar.service.ts` executa tokenizacao Soroban quando `STELLAR_RPC_URL`, `STELLAR_SECRET_KEY` e `STELLAR_CONTRACT_ID` estao configuradas.
- `packages/anchor-client` e `apps/api/src/modules/anchor` concentram on/off-ramp BRL/TESOURO via Etherfuse. Brasil/PIX segue tratado como sandbox.

## Como rodar localmente

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar envs

```bash
cp .env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Preencha pelo menos Privy para testar o fluxo principal de login:

```env
PRIVY_APP_ID=
PRIVY_APP_SECRET=
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_PRIVY_CLIENT_ID=
```

### 3. Subir Postgres

```bash
docker compose up -d
```

O banco local usa Postgres 16 na porta `5432`, com usuario, senha e database `credbridge`.

### 4. Aplicar migrations e seed opcional

```bash
npm run build:types
npm exec -w apps/api -- prisma migrate deploy --schema prisma/schema.prisma
npm run seed
```

### 5. Rodar web + API

```bash
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:3001/v1`
- Health: `http://localhost:3001/v1/health/ping`

## Scripts

### Raiz

```bash
npm run dev          # web + api em paralelo
npm run dev:web      # apenas Next.js
npm run dev:api      # apenas NestJS
npm run build:types  # build de packages/types
npm run build:web    # types + web
npm run build:api    # types + api
npm run build        # alias para build:web, usado pela Vercel
npm run lint         # lint web + api
npm run seed         # seed Prisma da API
```

### Workspaces

```bash
npm run test -w apps/web
npm run test -w apps/api
npm run test:e2e -w apps/api
npm run build -w packages/anchor-client
npm run test -w packages/anchor-client
```

## Rotas principais

Todas as rotas da API usam prefixo global `/v1`.

| Metodo | Rota | Uso |
|---|---|---|
| `GET` | `/v1/health/ping` | health check |
| `POST` | `/v1/auth/privy/session` | troca tokens Privy por JWT interno |
| `GET` | `/v1/auth/me` | usuario autenticado |
| `PATCH` | `/v1/auth/me` | atualiza perfil/KYC |
| `PATCH` | `/v1/auth/me/role` | define perfil inicial |
| `PATCH` | `/v1/auth/me/password` | altera senha quando aplicavel |
| `POST` | `/v1/auth/register` | cadastro por senha legado |
| `POST` | `/v1/auth/login` | login por senha legado |
| `POST` | `/v1/auth/google` | Google direto legado |
| `POST` | `/v1/auth/stellar/challenge` | SEP-10 legado |
| `POST` | `/v1/auth/stellar/verify` | SEP-10 legado |
| `GET` | `/v1/receivables` | recebiveis do usuario |
| `POST` | `/v1/receivables` | cria recebivel |
| `GET` | `/v1/receivables/pool` | pool para investidores |
| `GET` | `/v1/receivables/pool/stats` | KPIs do pool |
| `PATCH` | `/v1/receivables/:id/tokenize` | tokeniza NF-e |
| `PATCH` | `/v1/receivables/:id/request-assignment` | solicita cessao |
| `PATCH` | `/v1/receivables/:id/assign` | conclui cessao com autorizacao |
| `POST` | `/v1/receivables/:receivableId/documents` | registra documento do recebivel |
| `GET` | `/v1/receivables/:receivableId/documents` | lista documentos do recebivel |
| `POST` | `/v1/settlements` | cria liquidacao |
| `GET` | `/v1/settlements` | lista liquidacoes |
| `GET` | `/v1/settlements/receivable/:receivableId` | liquidacoes por recebivel |
| `GET` | `/v1/audit` | auditoria do usuario ou entidade |
| `POST` | `/v1/investments` | compra de recebivel por investidor |
| `GET` | `/v1/investments/me` | posicoes do investidor |
| `GET` | `/v1/investments/me/stats` | KPIs do investidor |
| `GET` | `/v1/wallet` | wallet Stellar Privy do usuario |
| `POST` | `/v1/wallet/create` | legado; exige wallet Privy ja provisionada |
| `POST` | `/v1/financial-authorizations/challenge` | cria desafio para assinatura Privy Stellar |
| `POST` | `/v1/financial-authorizations/verify` | verifica assinatura Privy Stellar |
| `GET` | `/v1/anchor/onboarding-status` | status KYC anchor |
| `POST` | `/v1/anchor/onramp/quote` | cotacao BRL para TESOURO |
| `POST` | `/v1/anchor/onramp/start` | inicia deposito interativo |
| `POST` | `/v1/anchor/offramp/quote` | cotacao TESOURO para BRL |
| `POST` | `/v1/anchor/offramp/start` | inicia saque interativo |

## Auth atual

O fluxo principal e Privy:

1. O frontend autentica por Privy e provisiona embedded wallet Stellar quando necessario.
2. O frontend envia access token e identity token para `POST /v1/auth/privy/session`.
3. A API valida os tokens com `@privy-io/node`, recupera e-mail verificado e wallet Stellar.
4. A API cria ou atualiza o `User` local e emite o JWT interno.
5. Usuarios sem `role` seguem para `/onboarding/role`; PMEs concluem KYC basico antes do dashboard.

Login por senha, Google direto e SEP-10 continuam no codigo como fluxos legados ou auxiliares.

## Variaveis de ambiente

`.env.example` documenta as variaveis da API e algumas variaveis publicas compartilhadas. `apps/web/.env.local.example` documenta apenas o que o Next.js precisa no browser.

Mais importantes:

```env
DATABASE_URL=
JWT_SECRET=
WEB_URL=
PRIVY_APP_ID=
PRIVY_APP_SECRET=
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_API_URL=
STELLAR_RPC_URL=
STELLAR_SECRET_KEY=
STELLAR_CONTRACT_ID=
STELLAR_WALLET_SECRET=
ETHERFUSE_API_KEY=
```

## Deploy

- Web: `vercel.json` roda `npm run build` e publica `apps/web/.next`.
- API: preparada para deploy separado em Railway, Fly, Render ou similar. Ainda nao ha manifesto de deploy backend no repo.
- Banco: migrations Prisma ficam em `apps/api/prisma/migrations`.

## Docs relacionadas

- [Status atual](docs/STATUS.md)
- [Estrutura de arquivos](documentacao/estrutura.md)
- [Fluxo de login atual](documentacao/fluxo-login-atual.md)
- [Fluxo e regras da smart wallet](documentacao/smart-wallet-fluxo-regras.md)
- [ADR Anchor Etherfuse](documentacao/anchor-etherfuse-integration.md)
- [Design System](docs/DESIGN.md)
