---
title: Levantamento Técnico — Feito vs Falta
tags:
  - Projects
  - credbridge
  - levantamento
  - roadmap
  - mvp
date: 2026-06-20
status: em-desenvolvimento
---

# Levantamento Técnico — CredBridge

> Snapshot do que **já foi desenvolvido** vs **o que falta**, organizado por jornada de
> usuário (Operador → PME → Investor → Blockchain → Infra).
> Base para o plano de execução rumo ao lançamento em mainnet.
> Varredura no código real: **2026-06-20**.

## Milestone-alvo

Lançamento em **mainnet** com fluxo ponta-a-ponta funcionando:

1. **Operador** — valida NF-e na SEFAZ/instituição responsável e dispara cobrança ao
   sacado quando antecipa.
2. **PME** — recebe antecipação, e quando a nota vence devolve o dinheiro ao pool;
   precisa de um lugar para controlar **quando** e **quanto** pagar.
3. **Investor** — coloca dinheiro na plataforma, aporta na pool, e converte cotas de
   volta em dinheiro para sacar.

---

## 🔗 Blockchain / Contratos

> Base de tudo. Hoje **100% em testnet**.

### ✅ Já temos

- Contrato `nfe_tokenization` (Soroban) — lifecycle completo da NF-e: `Active`,
  `ListedForSale`, `SoldToPool`, `Settled`, `Defaulted`, `Cancelled`. Testes Rust.
- Contrato `liquidity_pool` (Soroban) — `deposit`, `withdraw` (com cálculo de NAV),
  `settle_invoice_in_pool`, `update_pool_after_anticipation`, accrual de juros, NAV,
  emissão de cotas (CBPOOL).
- Contrato `mock_brlt` — token de teste para simular o BRLT.
- `StellarService` no backend implementando toda a interface `BlockchainService`:
  `tokenizeNfe`, `payPme`, `transferNftToInvestor`, `transferNftToPlatform`,
  `chargeInvestor`, `buyTokenizedInvoiceInPool`, `settleInvoiceInPool`,
  `withdrawFromPool`.
- Suporte a tx assinadas pelo cliente (Privy/Stellar) com janela estendida.

### ❌ Falta

- [ ] **Deploy mainnet** de `nfe_tokenization`, `liquidity_pool` e share token (CBPOOL)
      — não há scripts de deploy nem envs de mainnet configurados.
- [ ] **BRLT real em mainnet** — hoje usa `mock_brlt`. Integrar com BRLT de produção ou
      Stellar Asset (SAC) real.
- [ ] **Configuração de envs de mainnet** — `STELLAR_NETWORK`, contract IDs, issuer,
      keypair da plataforma.
- [ ] **Script E2E on-chain** (`test-core-flow.ts`) — planejado em
      `Fase2-implementações.md`, prova consistência matemática do pool. Não implementado.
- [ ] **Driver de sincronização off-chain** — fórmula de taxa média ponderada que
      alimenta `update_pool_after_anticipation` ao tokenizar uma NF-e. Planejado, não
      implementado.

---

## 👤 Operador

### ✅ Já temos

- Dashboard com recebíveis pendentes (`GET /admin/receivables/pending`).
- Aprovar/rejeitar NF-e (`PATCH /admin/receivables/:id/approve|reject`).
- Status da pool e cotas por investidor (`GET /admin/pool/status`, `/admin/pool/shares`).
- Mint da NF-e on-chain para a carteira da PME ao aprovar (`admin.service`).
- Gestão básica de usuários (`GET/POST /admin/users`).
- Aprovação de transações/depósitos pendentes (`/admin/transactions/*`).
- Saque manual da pool pelo operador (`withdrawFromPool`).

### ❌ Falta

- [ ] **Validação SEFAZ / instituição responsável** — hoje o operador valida
      visualmente e o status `validated` é setado manualmente. Falta: chamada à SEFAZ,
      parsing do XML, verificação de autenticidade e situação da NF-e.
- [ ] **Mecanismo de cobrança ao sacado ao antecipar** — quando o operador aprova e
      antecipa, deve disparar a cobrança PIX ao sacado com vencimento na `dueDate`.
      A infra de PIX collection existe; falta amarrar o disparo ao fluxo de aprovação e
      garantir o trigger automático.
- [ ] **KYC/KYB real do cedente (PME)** — interface de onboarding existe; integração
      real (Serpro / Receita Federal / provider) não existe.
- [ ] **Upload e visualização do XML da NF-e** — S3 é stub; operador não consegue abrir
      o documento original para conferir.
- [ ] **Gestão avançada de usuários** — bloquear/suspender PMEs e investors, ver
      histórico. Hoje a gestão é limitada.

---

## 🏢 PME

### ✅ Já temos

- Dashboard PME funcional com upload de NF-e e criação de recebível.
- Página `/pme/cobrancas` — cobranças ativas do sacado com polling e retry.
- Carteira Stellar (Privy) para receber a antecipação.
- Autorização financeira com assinatura da wallet.

### ❌ Falta

- [ ] **Devolução do dinheiro ao vencer a nota** — fluxo da PME pagar o pool de volta.
      `settleInvoice()` existe no backend (liquida on-chain), mas **não há fluxo de
      pagamento PIX de entrada** para a PME quitar a antecipação na data de vencimento.
- [ ] **Painel de controle de obrigações** — lugar onde a PME vê **quando** e **quanto**
      pagar: "recebeu R$ X do pool, vence em Y, deve devolver R$ Z". Conceito de "dívida
      da PME com o pool" não existe na UI.
- [ ] **Scheduler/cron de vencimentos** — nenhum job monitora `dueDate`. Quando uma nota
      vence, nada acontece automaticamente (cobrança, mudança de status, alerta).
- [ ] **Tratamento de inadimplência** — fluxo quando o sacado/PME não paga
      (`Defaulted`). Contrato suporta, backend e UI não tratam.
- [ ] **Notificação de vencimento** — nenhum canal (email, push, in-app) implementado.
- [ ] **Subpáginas** — recebíveis, documentos e auditoria existem como rotas mas com
      conteúdo limitado/mockado.

---

## 💼 Investor

### ✅ Já temos

- Dashboard com pool, posições e stats (dados reais via API).
- Compra de recebível individual / NF-e específica (`BuyDrawer` + módulo `investments`).
- **Aporte na pool on-chain** — fluxo de duas etapas `approve` + `deposit`
  (`POST /investments/deposit/:id/onchain/build|submit`), minta cotas CBPOOL.
- **Saque via PIX** — endpoints `POST /pix/withdrawals`, `/withdrawals/build`,
  `/withdrawals/submit` que **queimam cotas on-chain** e criam ordem de saque PIX.
- Autorização financeira via assinatura Stellar (`investor.deposit`,
  `investment.purchase`, `investor.withdrawal`).

### ❌ Falta

- [ ] **On-ramp BRL real** — integração Etherfuse removida. Precisa de alternativa
      (PIX direto + custódia) para o investor colocar dinheiro de verdade na plataforma.
- [ ] **Fluxo self-service de saque completo no frontend** — backend de
      `pix/withdrawals` existe e queima cotas, mas o caminho ponta-a-ponta no dashboard
      do investor (cotas CBPOOL → BRLT pela NAV → PIX de saída) precisa ser exposto e
      verificado de ponta a ponta. Hoje parte depende do operador.
- [ ] **Conversão cota → valor visível** — mostrar ao investor quanto cada cota vale
      hoje (NAV) e quanto receberá ao resgatar.
- [ ] **Subpáginas** — cotas, auditoria, histórico de yield/NAV: limitadas/mockadas.

---

## 🏗️ Infra / Produção / Segurança

### ✅ Já temos

- Deploy web na Vercel (`vercel.json`).
- Microserviço PIX (Python/FastAPI) com providers, webhooks, collections e Alembic
  migrations.
- Bootstrap Nest com Helmet, CORS, ValidationPipe, filtro global, throttler.
- Prisma 7 com migrations versionadas e seed.
- Docker compose para Postgres, web, pix e coolify.

### ❌ Falta

- [ ] **Deploy do backend** — sem provider definido nem Dockerfile de produção
      finalizado.
- [ ] **CI/CD (GitHub Actions)** — lint, build, test e migrations em pipeline.
- [ ] **JWT em `localStorage` → cookie httpOnly** — risco de segurança para produção.
- [ ] **Refresh token / rotação de JWT.**
- [ ] **S3 real** para upload/preview de XML/PDF.
- [ ] **Política de CORS de produção** — revisar `WEB_URL` vs `WEB_ORIGIN`.
- [ ] **Rate limits por operação financeira** — hoje só throttle global.
- [ ] **Revisão de autorização por role** em todas as rotas sensíveis.
- [ ] **Migrations em pipeline de backend.**

---

## 📊 Resumo por criticidade

### 🔴 Bloqueadores de lançamento (mainnet)

| Área | Item |
|------|------|
| Blockchain | Deploy mainnet dos contratos + BRLT real + envs |
| Operador | Validação SEFAZ real |
| Operador | Cobrança automática ao sacado ao antecipar |
| PME | Scheduler de vencimentos + fluxo PME devolver dinheiro ao pool |
| PME | Painel de obrigações (quando/quanto pagar) |
| Investor | On-ramp BRL real (PIX direto ou alternativa) |
| Investor | Saque self-service ponta-a-ponta no frontend |
| Infra | Deploy backend + CI/CD |
| Segurança | JWT httpOnly |

### 🟡 Importantes (beta com usuários reais)

| Área | Item |
|------|------|
| Operador | S3 real + visualização XML NF-e |
| Operador | KYC/KYB real |
| PME | Tratamento de inadimplência (Defaulted) |
| PME | Notificações de vencimento |
| Investor | Conversão cota→valor (NAV) visível |
| Blockchain | Driver de sincronização off-chain (taxa média ponderada) |

### 🟢 Pós-lançamento

| Área | Item |
|------|------|
| Todos | Subpáginas secundárias (auditoria, histórico, cotas) |
| Operador | Gestão avançada de usuários |
| Blockchain | Script E2E on-chain (`test-core-flow.ts`) |
| Backend | Soft delete, índices adicionais |

---

## 📈 Progresso por Role

> Estimativa por completude do **caminho crítico** rumo à mainnet (não contagem bruta de
> itens). Pondera o peso de cada bloqueador.

| Role / Camada | Desenvolvido | Falta | Barra |
|---------------|:---:|:---:|---|
| 👤 Operador | **50%** | 50% | `█████░░░░░` |
| 🏢 PME | **40%** | 60% | `████░░░░░░` |
| 💼 Investor | **65%** | 35% | `███████░░░` |
| 🔗 Blockchain | **55%** | 45% | `██████░░░░` |
| 🏗️ Infra / Segurança | **35%** | 65% | `███▌░░░░░░` |
| **🎯 Geral (ponderado)** | **≈48%** | ≈52% | `█████░░░░░` |

**Leitura rápida:**

- **Investor** é o mais maduro — aporte e saque já existem on-chain/backend; falta on-ramp
  real e expor o saque no frontend.
- **PME** é o mais atrasado no caminho crítico — o loop de devolução ao pool (scheduler de
  vencimento + pagamento de volta + painel de obrigações) ainda não existe.
- **Infra/Segurança** puxa o geral para baixo — deploy backend, CI/CD e JWT httpOnly são
  pré-requisitos de produção ainda abertos.
- **Operador** trava em validação SEFAZ e na cobrança automática ao antecipar.
- **Blockchain** tem os contratos prontos, mas tudo em testnet — deploy mainnet + BRLT real
  é o que falta para virar produção.

---

## Notas relacionadas

- `docs/STATUS.md` — status detalhado por camada
- `Fase2-implementações.md` — plano de contratos (pool, driver, E2E)
- `docs/DESIGN.md`
