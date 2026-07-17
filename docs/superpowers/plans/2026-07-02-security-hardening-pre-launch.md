# Plano de Execução — Correção de Falhas de Segurança (Pré-Lançamento Público)

> **Para agentes executores:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento. Cada fase é um bloqueador da seguinte no que diz respeito a exposição pública.

**Objetivo:** mapear e corrigir as principais falhas de segurança da CredBridge antes de sair do ambiente de testes para a internet, com foco prioritário em **autenticação/autorização** e **resiliência a DDoS / exaustão de recursos**. O sistema é composto por: API NestJS (`apps/api`), web Next.js (`apps/web`), microserviço Pix FastAPI (`pix-service`) e contratos Soroban (`contracts/`).

**Origem:** auditoria de segurança de 2026-07-02 (três frentes paralelas: auth NestJS, DDoS/recursos, pix-service+infra/segredos). Este documento consolida e deduplica os achados em um plano acionável.

**Regra de ouro do lançamento:** **não expor nada publicamente até concluir a Fase 0, Fase 1 e Fase 2.** Fases 3 e 4 podem ser feitas em paralelo mas devem estar prontas antes de tráfego real.

---

## Resumo dos achados (severidade)

| # | Sev | Área | Falha |
|---|-----|------|-------|
| F0.1 | **Crítico** | Segredos | `apps/api/env` commitado no git com chave privada Stellar, Privy secret, PIX api key + webhook secret, JWT secret, `DATABASE_URL` |
| F0.2 | **Crítico** | Segredos | `.gitignore` ignora `.env` mas não o arquivo `env` (causa raiz de F0.1) |
| F1.1 | **Crítico** | Auth | Webhook Pix NestJS fail-open: `rawBody` nunca habilitado → validação HMAC pulada, endpoint totalmente aberto |
| F1.2 | **Crítico** | Auth | pix-service webhook HMAC fail-open: `if not secret: return True` |
| F1.3 | **Crítico** | Auth | pix-service API-key fail-open: sem key configurada = tudo aberto (deposit/withdraw/collection) |
| F1.4 | **Crítico** | Auth | `JWT_SECRET` fraco (`dev-secret-change-me`, 20 chars) + fallback hardcoded em `jwt.strategy.ts` e `auth.module.ts` |
| F2.1 | **Crítico** | AuthZ | `POST /v1/pix/deposits`, `/withdrawals`, `GET /orders`, `/orders/:id`, `/orders/:id/refresh` **sem guard** → saque de dinheiro por qualquer um + IDOR |
| F2.2 | **Crítico** | AuthZ | Receivables `:id` (tokenize/activate/assign/prepare/submit) sem checagem de ownership → IDOR em ações on-chain e payouts |
| F2.3 | **Alto** | AuthZ | Documents por `:receivableId` sem ownership → leitura/escrita cross-tenant de documentos fiscais |
| F2.4 | **Alto** | AuthZ | Settlements sem ownership/role → qualquer user cria e lista settlements de toda a plataforma |
| F2.5 | **Médio** | AuthZ | Audit `?entityId=` sem checagem → leitura de trilha de auditoria de qualquer entidade |
| F2.6 | **Alto** | AuthZ | Registro público (`POST /auth/register`) contorna whitelist que Google/Privy aplicam |
| F2.7 | **Alto** | AuthZ | Sem `RolesGuard` declarativo — autorização por `assertOperator`/`assertInvestor` manual (frágil) |
| F2.8 | **Médio** | AuthZ | `operationalLimit` auto-editável via `PATCH /auth/me` (mass-assignment de controle financeiro) |
| F3.1 | **Alto** | DDoS | `trust proxy` não configurado → throttler conta o IP do proxy, 100 req/min compartilhado entre todos |
| F3.2 | **Alto** | DDoS | Throttler em memória → inútil com múltiplas instâncias / reseta no restart |
| F3.3 | **Alto** | DDoS | pix-service sem rate limiting; webhook público loga headers+body completos antes da validação |
| F3.4 | **Médio** | DDoS | Sem limite explícito de body-size (só o default 100kb do Express) |
| F3.5 | **Médio** | DDoS | Sem timeouts de request/keep-alive (slowloris); pix roda só 2 workers |
| F3.6 | **Médio** | DDoS | Sem limites de pool/`statement_timeout` no banco |
| F3.7 | **Médio** | DDoS | `findMany` sem paginação (receivables/investments/admin) |
| F3.8 | **Baixo** | DDoS | Webhooks sem janela de timestamp/replay robusta (id-less events geram uuid novo) |
| F4.1 | **Alto** | Infra | Postgres publicado no host (`5432`/`5433`) com senhas `credbridge:credbridge` / `pix:pix_secret` |
| F4.2 | **Médio** | Infra | CORS `*` no pix-service (money service credenciado) |
| F4.3 | **Médio** | Infra | Swagger `/docs` `/redoc` sempre públicos no pix-service |
| F4.4 | **Médio** | Infra | Containers rodam como root; `Dockerfile.web` roda `next dev` em produção |
| F4.5 | **Alto** | Infra | Logs em cleartext de tokens OAuth, headers de webhook e PII (pix-service) |
| F4.6 | **Médio** | Auth | Sem revogação de token / logout / blacklist; troca de senha não invalida sessões |
| F4.7 | **Baixo** | Auth | Enumeração de usuário (register/Google) + side-channel de timing no login |
| F4.8 | **Baixo** | Infra | Sem CDN/WAF/edge; pix-service não isolado em rede interna |
| F4.9 | **Baixo** | Auth | Endpoints stub `stellar/challenge`/`verify` retornam "token" falso |

---

## Fase 0 — Rotação de segredos e higiene de git (BLOQUEADOR ABSOLUTO)

> Enquanto os segredos reais estiverem no histórico do git, nenhuma outra correção importa: quem clonar o repo forja um JWT de `operator` e assina transações Stellar. Faça isto **primeiro** e trate o repositório como comprometido.

- [ ] Remover `apps/api/env` do índice: `git rm --cached apps/api/env`.
- [ ] Adicionar ao `.gitignore`: linhas `env` e `apps/api/env` (além do `.env` já existente). Confirmar com `git ls-files | grep -iE '(^|/)env$'` que não sobra nenhum.
- [ ] Purgar o arquivo de **todo o histórico** com `git filter-repo --path apps/api/env --invert-paths` (ou BFG). Reescrever o remoto e forçar re-clone em todas as máquinas.
- [ ] **Rotacionar TODOS os segredos expostos** (o `.env` raiz não-trackeado tem os mesmos valores — a rotação vale para ambos):
  - [ ] Gerar novo par de chaves Stellar (`STELLAR_SECRET_KEY`, `STELLAR_WALLET_SECRET`) e **mover os fundos** da conta antiga para a nova.
  - [ ] Rotacionar `PRIVY_APP_SECRET` no dashboard Privy.
  - [ ] Regenerar `PIX_SERVICE_API_KEY` e `PIX_WEBHOOK_SECRET` (+ chaves de compatibilidade `CREDBRIDGE_*`) e o par CorpX.
  - [ ] Gerar `JWT_SECRET` de alta entropia (≥ 32 bytes aleatórios, ex.: `openssl rand -base64 48`).
  - [ ] Rotacionar a senha do Postgres em `DATABASE_URL`.
- [ ] Mover todos os segredos de produção para o gerenciador de segredos do deploy (Coolify env vars), nunca em arquivo no repo.
- [ ] Confirmar que `.env.example` só contém placeholders (atualizar `change-me-in-production` etc.).

## Fase 1 — Fechar autenticação fail-open (BLOQUEADOR)

> Todo controle de "segredo ausente = permitir" precisa virar "segredo ausente = negar e não subir".

- [ ] **F1.4 — JWT env-only:** remover os fallbacks `?? 'dev-secret-change-me'` em `apps/api/src/modules/auth/jwt.strategy.ts:13` e `apps/api/src/modules/auth/auth.module.ts:22`. Fazer o boot lançar erro se `JWT_SECRET` estiver ausente. Reduzir `JWT_EXPIRES_IN` para access token curto (ex.: `15m`) — ver F4.6.
- [ ] **F1.1 — Webhook Pix NestJS fail-closed:**
  - [ ] `apps/api/src/main.ts`: `const app = await NestFactory.create(AppModule, { rawBody: true });` e registrar o body parser bruto.
  - [ ] `apps/api/src/modules/pix/pix.controller.ts:163`: trocar `if (webhookSecret && rawBody)` por rejeição **explícita** (401) quando `rawBody`, `signatureHeader` ou `timestampHeader` estiverem ausentes; exigir `PIX_WEBHOOK_SECRET` no boot (throw se vazio).
- [ ] **F1.2 — pix-service HMAC fail-closed:** `pix-service/app/security/hmac.py`: trocar o ramo `if not secret: return True` por `return False`; exigir `corpx_webhook_secret` em `corpx_env=production` (recusar boot se vazio).
- [ ] **F1.3 — pix-service API-key fail-closed:** `pix-service/app/api/orders.py` e `collections.py` em `_require_api_key`: rejeitar quando `expected_key` estiver vazio; exigir a setting em produção; usar `hmac.compare_digest` no lugar de `!=` (timing-safe).

## Fase 2 — Autorização e IDOR (BLOQUEADOR)

- [ ] **F2.1 — Guardar o PixController:**
  - [ ] Aplicar `@UseGuards(JwtAuthGuard)` no nível da classe em `apps/api/src/modules/pix/pix.controller.ts`.
  - [ ] Derivar `userId` **sempre** de `req.user.userId`; remover o query-param `userId` e o fallback `'system'`/`req.user?.id ?? 'system'`.
  - [ ] Remover ou trancar os endpoints crus `POST deposits`/`POST withdrawals`; manter o fluxo `withdrawals/build` + `withdrawals/submit`. Validar o burn de BRLT no servidor antes de qualquer Pix-Out.
  - [ ] Throttle por usuário nos endpoints de criação de ordem (ex.: `@Throttle({ default: { ttl: 60000, limit: 5 } })`).
- [ ] **F2.2 — Ownership em receivables:** em `receivables.controller.ts`/`receivables.service.ts`, passar `req.user.userId` e verificar `receivable.userId === req.user.userId` (ou `role === 'operator'`) em `findOne`, `tokenize`, `activate`, `request-assignment`, `assign`, `prepare-assignment`, `submit-assignment`. Retornar 404 em mismatch.
- [ ] **F2.3 — Ownership em documents:** validar que o `receivableId` pertence ao `req.user.userId` antes de listar/criar em `documents.controller.ts`.
- [ ] **F2.4 — Settlements:** restringir `create`/`findAll` a `role === 'operator'`; escopar `findByReceivable` ao dono.
- [ ] **F2.5 — Audit:** restringir consulta por `?entityId=` a `operator` ou verificar dono da entidade.
- [ ] **F2.7 — RolesGuard declarativo:** criar `RolesGuard` + decorator `@Roles('operator')` e aplicar nos módulos admin/investments/settlements; remover os `assertOperator`/`assertInvestor` manuais. Idealmente reler o role do banco no guard (não confiar só no token).
- [ ] **F2.6 — Modelo de registro:** decidir whitelist-only. Desabilitar `POST /auth/register` público ou exigir convite/aprovação de operador. Manter `'operator'` fora de `RegisterDto`/`SetRoleDto`.
- [ ] **F2.8 — `operationalLimit`:** remover `operationalLimit` de `update-profile.dto.ts`; só operador altera via admin.

## Fase 3 — Resiliência a DDoS / exaustão de recursos

- [ ] **F3.1 — trust proxy:** `apps/api/src/main.ts`: `app.set('trust proxy', 1)` (nº de hops do proxy) e garantir que o proxy (Traefik/Coolify) sobrescreve `X-Forwarded-For` do cliente. Sem isso o throttler é inútil atrás do proxy.
- [ ] **F3.2 — Throttler com store compartilhado:** trocar o storage em memória por Redis (`@nest-lab/throttler-storage-redis`) em `app.module.ts`, para o limite valer entre instâncias e sobreviver a restart.
- [ ] **F3.3 — Rate limit no pix-service:** adicionar `slowapi` (ou limite no proxy) especialmente em `/v1/webhooks/corpx`; validar HMAC **antes** de qualquer trabalho pesado ou log verboso.
- [ ] **F3.4 — Body-size:** `main.ts`: `app.use(json({ limit: '256kb' }))` e `urlencoded({ limit: '256kb', extended: false })`; manter o parser de webhook bruto também capado.
- [ ] **F3.5 — Timeouts:** Node — `app.getHttpServer().setTimeout(...)`, `requestTimeout`/`headersTimeout` (ex.: 30s/20s). Uvicorn — `--timeout-keep-alive 15` e considerar subir o nº de workers.
- [ ] **F3.6 — Banco:** setar pool + `pool_timeout` no SQLAlchemy (`pix-service/app/database.py`) e `connection_limit`/`pool_timeout` na `DATABASE_URL` do Prisma; `statement_timeout` (ex.: 10s) para as roles da aplicação.
- [ ] **F3.7 — Paginação:** adicionar `take`/`skip` com máximo (ex.: 100) em `receivables.repository.ts`, `investments.repository.ts` e `admin.service.ts`.
- [ ] **F3.8 — Replay:** exigir event id estável do provedor (rejeitar se ausente); janela de timestamp/skew no webhook de entrada; unique constraint em `pix_events.event_id`; persistir orphan events (hoje `PixEvent` é criado e descartado).

## Fase 4 — Endurecimento de infra e higiene

- [ ] **F4.1 — Postgres:** não publicar portas do DB em produção (remover `ports:` ou usar `127.0.0.1:5432:5432`); senhas fortes via env, não literais; DB só em rede interna Docker. Espelhar `docker-compose.coolify.yml` (que já usa `DATABASE_URL` gerenciada).
- [ ] **F4.5 — Logs:** redigir headers de `Authorization`/assinatura; remover log do corpo da resposta OAuth (token) e de bodies de provider em `pix-service/app/api/webhooks.py` e `providers/corpx.py`; corpo verboso só em DEBUG/não-produção.
- [ ] **F4.2 — CORS pix-service:** restringir `allow_origins` ao host da API CredBridge (ou desabilitar CORS, é service-to-service).
- [ ] **F4.3 — Swagger:** `docs_url=None`/`redoc_url=None`/`openapi_url=None` quando `corpx_env == 'production'`.
- [ ] **F4.4 — Containers:** adicionar `USER` não-root nos `Dockerfile*`; `Dockerfile.web` deve rodar `next build` + `next start`, não `next dev`.
- [ ] **F4.6 — Revogação de token:** adicionar `tokenVersion` no claim, checado contra o banco na strategy; bump no troca-de-senha; access token curto + refresh token.
- [ ] **F4.7 — Enumeração/timing:** mensagens uniformes em register/Google; no login, rodar um `bcrypt.compare` dummy quando o usuário não existe.
- [ ] **F4.8 — WAF/edge:** frontar ambos os serviços com CDN/WAF (Cloudflare ou equivalente): rate limit de borda, mitigação de bot/OPTIONS, cap de tamanho/conexão. **Não expor o pix-service publicamente** — isolar em rede interna.
- [ ] **F4.9 — Stubs:** remover `POST /auth/stellar/challenge` e `/verify` (retornam token falso) até implementação real.

---

## Verificação (antes de declarar concluído)

- [ ] `git ls-files | grep -iE '(^|/)env$'` retorna vazio; `git log` do arquivo purgado não mostra mais o blob.
- [ ] Teste negativo do webhook Pix NestJS: POST sem assinatura válida → **401** (hoje seria 200).
- [ ] Teste negativo pix-service: com secret/API-key vazios em ambiente de produção o serviço **não sobe**.
- [ ] Forjar JWT com o secret antigo → **rejeitado** (secret novo, boot falha sem env).
- [ ] Como user A, tentar `GET/PATCH` receivable/documento/settlement do user B → **404/403**.
- [ ] `POST /v1/pix/withdrawals` sem token → **401**.
- [ ] Atrás do proxy, throttle conta o IP real do cliente (não colapsa em um único bucket).
- [ ] `nmap`/scan externo não alcança `5432`/`5433` nem o pix-service.
- [ ] Rodar a suíte de testes existente (`apps/api`: `npm test`; `pix-service`: `pytest`) verde após as mudanças.
