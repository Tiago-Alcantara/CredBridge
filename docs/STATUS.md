---
title: Status do Projeto
tags:
  - Projects
  - projeto
  - credbridge
  - status
  - checklist
date: 2026-05-24
status: em-desenvolvimento
---

# Status do Projeto — CredBridge

> Snapshot do repositório real em `/home/tiago-linux/projects/CredBridge`.
> Última varredura no código: **2026-05-24**.

## Decisões fixadas

- **MVP operacional focado em NF-e:** a UI principal de upload cria `type: "invoice"`, embora os tipos compartilhados ainda aceitem `duplicate` e `contract`.
- **Auth principal:** Privy no frontend + validação server-side no NestJS + JWT interno CredBridge.
- **Auth legado mantido:** login/senha, Google direto e endpoints SEP-10 ainda existem para compatibilidade/experimentos.
- **Wallet Privy como fonte única:** embedded wallet Stellar da Privy identifica a sessão e assina autorizações financeiras sensíveis.
- **Token storage:** JWT interno ainda fica em `localStorage`; migrar para cookie httpOnly antes de produção.
- **Solana:** descartado.
- **Cortado do MVP:** Redis, BullMQ, Auth.js/Keycloak, OpenTelemetry, Prometheus/Grafana.
- **Deploy:** web na Vercel; backend ainda sem manifesto/provider definitivo.
- **Stellar Anchor:** integração Etherfuse removida do sistema; on/off-ramp BRL/TESOURO a definir.

## Visão geral

| Camada | Status | Comentário |
|---|---|---|
| Estrutura/monorepo | Estável | npm workspaces para `apps/*` e `packages/*`; contrato Soroban em `contracts/` |
| Web | Em evolução | Next.js 16, React 19, Tailwind v4, Privy, dashboards principais e testes Vitest |
| API | Em evolução | NestJS 11, Prisma 7, auth, recebíveis, documentos, investimentos, wallet e auditoria |
| Banco | Funcional | Prisma schema, migrations e seed; índices básicos em alguns modelos |
| Blockchain | Parcial | contrato Soroban e StellarService existem; dependem de envs e infraestrutura Stellar |
| Storage/KYC/Pagamentos | Stub/parcial | interfaces e serviços existem, integrações reais ainda pendentes |
| Testes | Parcial | Jest API e Vitest web existem, mas cobertura ainda incompleta |
| CI/CD | Parcial | Vercel web; GitHub Actions/backend deploy ainda pendentes |

## Já feito

### Infra e repositório

- [x] Monorepo npm workspaces (`apps/web`, `apps/api`, `packages/types`)
- [x] Contrato Soroban em `contracts/`
- [x] `package.json` raiz com scripts `dev`, `build:web`, `build:api`, `build:types`, `lint`, `seed`
- [x] `.env.example` raiz + `apps/web/.env.local.example`
- [x] `docker-compose.yml` para Postgres 16 local
- [x] `vercel.json` para deploy da web
- [x] `AGENTS.md` + `CLAUDE.md` com instruções para agentes

### Banco de dados

- [x] Prisma 7 + adapter `@prisma/adapter-pg`
- [x] Modelos: `User`, `Receivable`, `Document`, `Settlement`, `Investment`, `AuditLog`, `FinancialAuthorization`
- [x] Campos Privy, Google, perfil e wallet legada no `User`
- [x] Migrations aplicadas e versionadas
- [x] Seed em `apps/api/prisma/seed.ts`
- [x] Índices em `AuditLog`, `Investment` e `FinancialAuthorization`

### Backend (`apps/api`)

- [x] Bootstrap Nest com `setGlobalPrefix('v1')`, Helmet, CORS, ValidationPipe e filtro global de exceções
- [x] Throttler global e throttles específicos em auth
- [x] `health` (`GET /v1/health/ping`)
- [x] `auth`: Privy session, `GET/PATCH /me`, role selection, senha, Google direto legado, login/senha legado, SEP-10 legado
- [x] `receivables`: CRUD principal, pool investor, stats, activate, tokenize, assignment request/assign
- [x] `documents`: rotas nested `/v1/receivables/:receivableId/documents`
- [x] `settlements`: criar, listar e listar por recebível
- [x] `audit`: lista por usuário autenticado e por entidade
- [x] `investments`: compra, posições do investidor e stats
- [x] `stellar-wallet`: consulta da wallet Stellar Privy
- [x] `financial-authorizations`: desafio e verificação de assinatura Privy Stellar
- [x] Serviços shared para Prisma, blockchain, storage, KYC e payments

### Frontend (`apps/web`)

- [x] Next.js 16 App Router + React 19 + Tailwind v4
- [x] Design tokens em `apps/web/styles/tokens.css`
- [x] Providers globais: Query, Toast, Privy e Google
- [x] Landing pública e página pública `/auditoria`
- [x] Fluxo Privy em `/login`
- [x] Onboarding de role em `/onboarding/role`
- [x] KYC PME no onboarding
- [x] Guards client-side por role com `useRequireAuth`
- [x] Dashboard PME com dados reais de recebíveis e upload de NF-e
- [x] Dashboard investor com pool, posições e compra
- [x] Dashboard partner básico
- [x] Configurações compartilhadas em `/pme/configuracoes` e `/investor/configuracoes`
- [x] Autorização financeira com assinatura da wallet Stellar Privy
- [x] Testes Vitest/Testing Library para auth, providers, proxy e landing pública

### Pacotes

- [x] `@credbridge/types`: tipos de receivable, settlement, investor, document, audit e investment

### Blockchain

- [x] Contrato Soroban `nfe-contract`
- [x] Testes Rust do contrato e snapshots
- [x] `StellarService.tokenizeNfe` com chamada Soroban quando configurado
- [x] Pagamentos TESOURO em `payPme` e `chargeInvestor`
- [x] Criação derivada de wallet custodial para fluxos Stellar clássicos

## A fazer

### Documentação e DX

- [ ] Manter `README.md` e `documentacao/estrutura.md` atualizados quando novas rotas/módulos entrarem
- [ ] Decidir se `docs/graphs/**` é snapshot gerado ou documentação navegável oficial
- [ ] Documentar deploy backend quando provider for escolhido

### Produção e segurança

- [ ] Migrar JWT interno de `localStorage` para cookie httpOnly
- [ ] Revisar política de CORS/envs (`WEB_URL` vs `WEB_ORIGIN`) antes de produção
- [ ] Definir refresh token/rotação de JWT
- [ ] Revisar autorização por role em todas as rotas sensíveis
- [ ] Criar rate limits por operação financeira, não só globais/auth

### Backend e domínio

- [ ] Endurecer transições de recebíveis (`pending`, `validated`, `tokenized`, `assignment_pending`, `active`, `settled`, `defaulted`)
- [ ] Garantir emissão consistente de `AuditLog` em todas as mutações relevantes
- [ ] Definir modelo real de saldo disponível da PME
- [ ] Definir histórico de yield/NAV para gráficos
- [ ] Criar módulo de risco/elegibilidade
- [ ] Avaliar índices adicionais em `Receivable.userId`, `Receivable.status` e `Settlement.status`
- [ ] Decidir soft delete

### Integrações externas

- [ ] S3 real para upload/preview de XML/PDF NF-e
- [ ] KYC/KYB real (Serpro, Receita Federal ou provider)
- [ ] PIX/TED real ou estratégia definitiva de on/off-ramp
- [ ] SEFAZ real para validação de NF-e

### Frontend

- [ ] Reduzir hex inline em componentes novos e aproximar o código dos tokens do design system
- [ ] Completar subpáginas PME: recebíveis, documentos, liquidação e auditoria
- [ ] Completar subpáginas investor: recebíveis, cotas e auditoria
- [ ] Trocar KPIs/gráficos ainda mockados por dados reais quando os endpoints existirem
- [ ] Melhorar responsividade de telas com estilos inline antigos

### Testes e CI

- [ ] Ampliar cobertura Jest nos services e controllers críticos
- [ ] Adicionar e2e cobrindo rotas autenticadas principais
- [ ] Ampliar Vitest/Testing Library nos fluxos financeiros
- [ ] Adicionar GitHub Actions para lint, build e test
- [ ] Rodar migrations em pipeline de backend

## Notas relacionadas

- `README.md`
- `documentacao/estrutura.md`
- `documentacao/fluxo-login-atual.md`
- `documentacao/smart-wallet-fluxo-regras.md`
- `docs/DESIGN.md`
