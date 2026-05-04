---
title: Status do Projeto
tags:
  - Projects
  - projeto
  - credbridge
  - status
  - checklist
date: 2026-05-02
status: em-desenvolvimento
---

# Status do Projeto — CredBridge

> Snapshot do que já foi entregue no repositório real (`~/projects/CredBridge`) e do que ainda falta.
> Última varredura no código: **2026-05-02** (HEAD `ff7f463`).

## Decisões fixadas em 2026-05-02

- **MVP só NF-e** — qualquer outro tipo de recebível (duplicata, contrato) fica fora do escopo inicial.
- **Próxima fase:** substituir mocks do frontend por endpoints reais + montar UI de login/registro consumindo `/v1/auth/*` (auth backend já está pronto).
- **Persona prioritária:** PME. Investidor e Parceiro ficam com mock até PME estar 100%.
- **Stellar SEP-10:** abordagem ainda **em aberto**; manter JWT email/senha como auth principal por enquanto.
- **Solana:** descartado.
- **Cortado do MVP:** Redis, BullMQ, Auth.js/Keycloak, OpenTelemetry, Prometheus/Grafana.
- **Token storage:** migrar `localStorage` → cookie httpOnly antes de produção.
- **Deploy backend:** provider ainda **em aberto** (Railway / Fly / Render).

---

## Visão Geral

| Camada | % entregue | Comentário |
|---|---|---|
| Estrutura/Monorepo | 100% | npm workspaces, 3 pacotes |
| Banco + Schema | 95% | falta seed e índices de busca |
| Backend (API) | 40% | scaffolds + auth real; integrações externas em stub |
| Frontend (UI) | 60% | dashboards renderizam, dados ainda mockados |
| Integração Front↔Back | 60% | hooks e wrapper prontos; consumo real parcial |
| Blockchain (Stellar) | 5% | só interface + stub |
| Storage (S3) | 5% | só interface + stub |
| Pagamentos (PIX/TED) | 5% | só interface + stub |
| KYC/KYB | 5% | só interface + stub |
| Testes | 5% | só scaffold e2e do Nest |
| CI/CD | 20% | Vercel só para web |
| Observabilidade | 0% | nada de OTel/Prom/Grafana |

---

## ✅ Já feito

### Infra e repositório

- [x] Monorepo com npm workspaces (`apps/web`, `apps/api`, `packages/types`)
- [x] `package.json` raiz com scripts `dev`, `build:web`, `build:api`, `build:types`, `lint`
- [x] `.env.example` raiz + `apps/web/.env.local.example`
- [x] `docker-compose.yml` para Postgres local
- [x] `vercel.json` apontando para `apps/web/.next`
- [x] `AGENTS.md` + `CLAUDE.md` com instruções de agentes
- [x] `README.md` com árvore de pastas e setup

### Banco de dados

- [x] Prisma 7 + adapter `@prisma/adapter-pg`
- [x] Modelos: `Receivable`, `Document`, `Settlement`, `User`, `AuditLog`
- [x] Migration inicial + migration `align_with_shared_types` + migration `add_user`
- [x] `AuditLog` polimórfico (`entityType` + `entityId`, sem FKs)

### Backend (`apps/api`)

- [x] Bootstrap Nest com `setGlobalPrefix('v1')` na porta 3001
- [x] CORS habilitado
- [x] `ConfigModule` global
- [x] `PrismaModule` global com `PrismaService`
- [x] `ValidationPipe` global (`whitelist: true, transform: true`)
- [x] Módulo `health` (`GET /v1/health/ping`)
- [x] Módulo `receivables` (CRUD básico via repository)
- [x] Módulo `documents` em rota nested (`/v1/receivables/:id/documents`)
- [x] Módulo `settlements` (CRUD + listar todos)
- [x] Módulo `audit` (`GET /v1/audit`, `findByEntity`)
- [x] Módulo `auth` real:
  - [x] `POST /v1/auth/register` (bcrypt 10 rounds)
  - [x] `POST /v1/auth/login`
  - [x] `JwtStrategy` + `JwtAuthGuard`
  - [x] `@UseGuards(JwtAuthGuard)` em receivables, documents, settlements, audit
- [x] DTOs com `class-validator` (`CreateReceivableDto`, `CreateDocumentDto`, `CreateSettlementDto`, `LoginDto`, `RegisterDto`)
- [x] Interfaces shared: `BlockchainService`, `StorageService`, `PaymentsService`, `KycService` (DI por token Symbol)

### Frontend (`apps/web`)

- [x] Next.js 16 (App Router + Turbopack)
- [x] Tailwind v4 + `tokens.css`
- [x] Root layout com providers (TanStack Query)
- [x] Route groups: `(marketing)`, `(auth)`, `(pme)`, `(investor)`, `(partner)`
- [x] Landing (`(marketing)/page.tsx`) com `HeroNetwork`, `Audiences`, `HowItWorks`, `StatsBar`, `LandingFooter`
- [x] Auth: `login/page.tsx`, `onboarding/page.tsx`, `KycFlow`, `StellarAuth`, `LoginBG`
- [x] Dashboards renderizando: PME, Investor, Partner
- [x] Componentes: primitives (`Icon`, `Logo`, `StatusBadge`), patterns (`Sidebar`, `TopNav`, `AppTopBar`, `Timeline`, `MiniKpi`)
- [x] Componentes PME: `InvoiceTable`, `PipelineCard`, `PipelineCol`, `UploadZone`, `YieldSpark`
- [x] Componentes Investor: `NavChart`, `ShareCard`
- [x] Componente Partner: `TrafficChart`
- [x] i18n PT/EN com `useTranslation`
- [x] `useTheme` (dark/light via `data-theme`)
- [x] Validações Zod por domínio (`receivable`, `document`, `settlement`)
- [x] Hooks API por domínio (`receivables`, `documents`, `settlements`, `audit`, `auth`)
- [x] `apiFetch` wrapper + `ApiError`
- [x] `auth-storage` (token em `localStorage`) + injeção `Authorization: Bearer` automático
- [x] Página `/test` para smoke test de integração
- [x] `QueryProvider` com TanStack Query v5

### Pacote compartilhado (`packages/types`)

- [x] `Receivable` + `ReceivableStatus` + `ReceivableType` + `CreateReceivableInput`
- [x] `Settlement` + `SettlementStatus` + `SettlementMethod` + `CreateSettlementInput`
- [x] `Document` + `DocumentType` + `UploadDocumentInput`
- [x] `Investor`
- [x] Build via `tsc → dist/`

### Deploy

- [x] Vercel para frontend (`build:web`)

---

## ❌ A fazer

### Integrações externas (todas em stub hoje)

- [ ] **Stellar SDK real** em `stellar.service.ts`
  - [ ] `registerProof` → tx real `manageData`/`memo`
  - [ ] `settlePayment` → tx real
  - [ ] `getTransactionStatus` → consulta Horizon
- [ ] **SEP-10** real em `auth.service.ts` (`getStellarChallenge` + `verifyStellarChallenge` hoje só geram strings fake)
- [ ] **AWS S3** real em `s3.service.ts` (`upload`, `getSignedUrl`, `delete`)
- [ ] **PIX/TED** provider real em `pix.service.ts`
- [ ] **KYC/KYB** provider real em `kyc.service.ts` (CPF e CNPJ)
- [ ] **Antifraude documental** (não há nem interface ainda)
- [ ] **Assinatura eletrônica** (não há nem interface ainda)
- [ ] **ERP connectors** (não há nem interface ainda)

### Backend — regra de negócio

- [ ] Validação de domínio em `ReceivablesService` (estados, transições, deságio)
- [ ] Emissão de eventos `AuditLog` em todas as mutações (criar, mudar status, liquidar)
- [ ] Módulo de **risco/elegibilidade** (não existe)
- [ ] Módulo de **originação** separado (hoje misturado com receivables)
- [ ] Conciliação banco ↔ ledger ↔ on-chain
- [ ] BullMQ + Redis para filas (validação, hashing, registro on-chain)
- [ ] Rate limiting / guard por role (`pme`, `investor`, `partner`, `admin`)
- [ ] Refresh token / rotação de JWT
- [ ] Cookie httpOnly em vez de `localStorage` para o token (decisão pendente)

### Banco

- [ ] Seed de dados para dev (`prisma/seed.ts`)
- [ ] Índices em `Receivable.userId`, `Receivable.status`, `Settlement.status`
- [ ] Soft delete (decisão pendente)

### Frontend — substituir mocks por dados reais (FASE ATUAL — foco PME)

- [ ] **Login + Registro UI** consumindo `POST /v1/auth/login` e `POST /v1/auth/register`
- [ ] **Dashboard PME** — `InvoiceTable` consome `useReceivables`
- [ ] **Dashboard PME** — `Timeline` consome `useAuditByEntity`
- [ ] **Dashboard PME** — `UploadZone` chama `useCreateDocument` (NF-e)
- [ ] Tratamento de erro UI (toast/banner) consumindo `ApiError.body.message`
- [ ] Loading states e skeletons nas tabelas PME
- [ ] Empty states nas listas PME
- [ ] Guarda de rota por `role` no client (PME não acessa `/investor`, etc)
- [ ] Migrar token de `localStorage` → cookie httpOnly antes de produção

### Frontend — fora da fase atual (Investor / Partner mantêm mock)

- [ ] Dashboard Investor — listagem real de propostas
- [ ] Dashboard Partner — métricas reais

### Testes

- [ ] Jest unitário nos services (`auth`, `receivables`, `settlements`, `audit`)
- [ ] e2e Nest cobrindo as rotas autenticadas
- [ ] Vitest ou Playwright no frontend
- [ ] Testes de contrato dos DTOs (validações)

### Observabilidade e operação

- [ ] OpenTelemetry no backend
- [ ] Prometheus + Grafana
- [ ] Logs estruturados (Pino?) em vez de `Logger` padrão
- [ ] Sentry no frontend e backend
- [ ] Health check com verificação de DB/Stellar/S3

### CI/CD

- [ ] GitHub Actions: lint + build + test
- [ ] Migrations Prisma em pipeline
- [ ] Deploy do backend (Railway / Fly / Render — escolher)
- [ ] Variáveis de ambiente em ambiente staging vs prod

### Produto / negócio

- [ ] Definir o **primeiro tipo de recebível** suportado no MVP (NF-e? duplicata?)
- [ ] Mapear jornada completa do empreendedor (cadastro → liquidação)
- [ ] Definir quais eventos entram na trilha de auditoria
- [ ] Definir o que vai on-chain (lista exata de eventos)
- [ ] Modelar regras regulatórias (LGPD, cessão de crédito)

---

## Notas relacionadas

- [[CredBridge]]
- [[Decisoes de Arquitetura]]
- [[Stack de Tecnologia]]
- [[Tarefas]]
- [[Inconsistencias Obsidian vs Repositorio]]
