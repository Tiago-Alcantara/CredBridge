---
title: Status do Projeto
tags:
  - Projects
  - projeto
  - credbridge
  - status
  - checklist
date: 2026-05-04
status: em-desenvolvimento
---

# Status do Projeto — CredBridge

> Snapshot do que já foi entregue no repositório real (`~/projects/CredBridge`) e do que ainda falta.
> Última varredura no código: **2026-05-04**.

## Decisões fixadas

- **MVP só NF-e** — qualquer outro tipo de recebível (duplicata, contrato) fica fora do escopo inicial.
- **Stellar SEP-10:** removido do fluxo de login por enquanto; JWT email/senha é o auth principal.
- **Solana:** descartado.
- **Cortado do MVP:** Redis, BullMQ, Auth.js/Keycloak, OpenTelemetry, Prometheus/Grafana.
- **Token storage:** migrar `localStorage` → cookie httpOnly antes de produção.
- **Deploy backend:** provider ainda **em aberto** (Railway / Fly / Render).
- **Tela de configurações:** mesma página para PME e Investor — campos específicos por role ficam ocultos.

---

## Visão Geral

| Camada | % entregue | Comentário |
|---|---|---|
| Estrutura/Monorepo | 100% | npm workspaces, 3 pacotes |
| Banco + Schema | 97% | seed pronto; faltam índices |
| Backend (API) | 50% | auth + CRUD real; userId extraído do JWT; integrações externas em stub |
| Frontend (UI) | 70% | login/register real, dashboard PME parcialmente real, sub-páginas por criar |
| Integração Front↔Back | 75% | login, receivables, documents, error handling, route guards prontos |
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
- [x] `package.json` raiz com scripts `dev`, `build:web`, `build:api`, `build:types`, `lint`, `seed`
- [x] `.env.example` raiz + `apps/web/.env.local.example`
- [x] `docker-compose.yml` para Postgres local
- [x] `vercel.json` apontando para `apps/web/.next`
- [x] `AGENTS.md` + `CLAUDE.md` com instruções de agentes

### Banco de dados

- [x] Prisma 7 + adapter `@prisma/adapter-pg`
- [x] Modelos: `Receivable`, `Document`, `Settlement`, `User`, `AuditLog`
- [x] Migrations aplicadas
- [x] `AuditLog` polimórfico (`entityType` + `entityId`, sem FKs)
- [x] Seed realista (`prisma/seed.ts`) — 3 usuários, 9 recebíveis, 7 docs, 3 liquidações, 18 audit logs

### Backend (`apps/api`)

- [x] Bootstrap Nest com `setGlobalPrefix('v1')` na porta 3001
- [x] CORS, `ConfigModule`, `PrismaModule`, `ValidationPipe` globais
- [x] Módulo `health` (`GET /v1/health/ping`)
- [x] Módulo `receivables` — `userId` extraído do JWT (não mais do body); `findAll` filtra por usuário
- [x] Módulo `documents` em rota nested (`/v1/receivables/:id/documents`)
- [x] Módulo `settlements` (CRUD + listar todos)
- [x] Módulo `audit` (`GET /v1/audit`, `findByEntity`)
- [x] Módulo `auth` real: register (bcrypt), login, JwtStrategy, JwtAuthGuard
- [x] `decodeToken` / `getTokenRole` no cliente para leitura do JWT sem biblioteca

### Frontend (`apps/web`)

- [x] Next.js 16 (App Router + Turbopack) + Tailwind v4 + `tokens.css`
- [x] Route groups: `(marketing)`, `(auth)`, `(pme)`, `(investor)`, `(partner)`
- [x] Landing page completa
- [x] **Login/Register** — fluxo unificado em `/login`; toggle login ↔ registro; KYC só para PME; wired `useLogin` + `useRegister`; erro inline; loading state
- [x] `useRequireAuth(role?)` — guarda de rota com verificação de role; redireciona para dashboard correto se role errado
- [x] Layouts `(pme)`, `(investor)`, `(partner)` com guarda de rota por role
- [x] Dashboard PME — `InvoiceTable` consome `useReceivables()` (dados reais)
- [x] Dashboard PME — `UploadZone` wired: cria `Receivable` + registra `Document`; drag/drop XML; form com sacado/CNPJ/valor/vencimento
- [x] `ToastProvider` — toast global com `showToast(msg, kind)`; 401 → toast "Sessão expirada" + redirect
- [x] Skeletons animados (`Skeleton` primitivo + `InvoiceTableSkeleton`)
- [x] Empty states com CTA na tabela de recebíveis
- [x] `auth-storage` com `decodeToken` + `getTokenRole` (decodifica JWT sem biblioteca)
- [x] `extractApiErrorMessage` para mensagens de erro da API

### Pacote compartilhado (`packages/types`)

- [x] Todos os tipos de domínio — `Receivable`, `Settlement`, `Document`, `Investor`, `AuditEvent`
- [x] `CreateReceivableInput` sem `userId` (extraído do JWT no backend)

### Deploy

- [x] Vercel para frontend (`build:web`)

---

## ❌ A fazer

### Dashboard PME — remover mocks (FASE ATUAL)

- [ ] **KPI "Em análise"** — calcular de `receivables` (soma de `pending` + `validated`)
- [ ] **KPI "Liberado"** — calcular de `receivables` (soma de `settled`)
- [ ] **KPI "Total NF-e"** — calcular contagem e breakdown por status
- [ ] **Saudação** — exibir nome real do usuário (decodificar email do JWT ou endpoint `/me`)
- [ ] **Timeline** — substituir mock por `useAuditLog` consumindo `GET /v1/audit`
- [ ] **Saldo disponível** (card hero) — conceito não existe no banco; definir modelo antes de implementar
- [ ] **YieldSpark** (gráfico de yield) — precisa de histórico de deságio por período (endpoint não existe)
- [ ] **Endereço Stellar** — mock hardcoded; só real quando SEP-10 for implementado

### Sub-páginas PME — criar do zero

- [ ] `/pme/recebiveis` — listagem completa com filtros por status, busca, paginação
- [ ] `/pme/documentos` — listagem de documentos por recebível, preview, re-upload
- [ ] `/pme/liquidacao` — histórico de liquidações (`useSettlements`), status PIX/Stellar
- [ ] `/pme/auditoria` — log de eventos (`useAuditLog`), filtro por entidade/data

### Dashboard Investor — remover mocks

- [ ] KPIs do portfólio (volume investido, yield médio, cotas ativas) — calcular de dados reais
- [ ] Listagem de recebíveis disponíveis para investimento
- [ ] Gráfico `NavChart` com dados reais de NAV

### Sub-páginas Investor — criar do zero

- [ ] `/investor/recebiveis` — recebíveis disponíveis para compra, filtros de risco/yield/vencimento
- [ ] `/investor/cotas` — posição atual do investidor, cotas por fundo/série
- [ ] `/investor/auditoria` — log de eventos do investidor

### Configurações de conta (compartilhada PME + Investor)

- [ ] `/pme/configuracoes` e `/investor/configuracoes` apontam para o mesmo componente `AccountSettings`
- [ ] Campos comuns: nome, email, senha, telefone, endereço
- [ ] Campos PME (hidden para Investor): razão social, CNPJ, faturamento mensal, setor
- [ ] Campos Investor (hidden para PME): tipo de investidor (PF/PJ), perfil de risco, limite operacional
- [ ] Salvar via endpoint `/me` (a criar no backend)

### Backend — regra de negócio

- [ ] Endpoint `GET /v1/auth/me` — retorna dados do usuário autenticado
- [ ] `PATCH /v1/auth/me` — atualiza perfil do usuário
- [ ] Validação de estados e transições em `ReceivablesService` (pending → validated → active → settled)
- [ ] Emissão automática de `AuditLog` em todas as mutações
- [ ] `GET /v1/audit` filtrado por userId autenticado (hoje retorna todos)
- [ ] Módulo de risco/elegibilidade (não existe)
- [ ] Rate limiting / guard por role
- [ ] Refresh token / rotação de JWT
- [ ] Cookie httpOnly em vez de `localStorage`

### Banco

- [ ] Índices em `Receivable.userId`, `Receivable.status`, `Settlement.status`
- [ ] Soft delete (decisão pendente)

### Integrações externas (todas em stub)

- [ ] **AWS S3** — upload real de XML NF-e
- [ ] **KYC/KYB** — validação CPF/CNPJ (Serpro, Receita Federal ou provider)
- [ ] **PIX/TED** — liquidação real
- [ ] **Stellar SDK** — registro on-chain e liquidação
- [ ] **SEFAZ** — validação de NF-e

### Testes

- [ ] Jest unitário nos services (`auth`, `receivables`, `settlements`, `audit`)
- [ ] e2e Nest cobrindo rotas autenticadas
- [ ] Vitest ou Playwright no frontend

### CI/CD

- [ ] GitHub Actions: lint + build + test
- [ ] Migrations Prisma em pipeline
- [ ] Deploy do backend (Railway / Fly / Render — escolher)

---

## Notas relacionadas

- [[CredBridge]]
- [[Decisoes de Arquitetura]]
- [[Stack de Tecnologia]]
- [[Tarefas]]
