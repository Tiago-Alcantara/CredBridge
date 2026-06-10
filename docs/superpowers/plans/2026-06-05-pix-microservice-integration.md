# Plano de Implementacao - Integracao Pix via Microservico Python e CorpX

> **Para agentes executores:** SUB-SKILL OBRIGATORIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** criar um microservico Python separado para integrar a CredBridge com a API CorpX v2.14.0, gerenciando ordens Pix de deposito e saque para PMEs e investidores. O microservico deve gerar QR Codes Pix dinamicos para depositos, executar Pix Out para saques, consultar/reconciliar status e avisar a API NestJS da CredBridge quando o dinheiro Pix for confirmado. A partir disso, a CredBridge executa os efeitos de BRLT/Soroban: mint, burn, escrow, deposito na pool ou liberacao do proximo passo.

**Base obrigatoria:** usar os contratos anexados:

- `corpx_api_openapi_v2_14_0.yaml`
- `corpx_api_postman_collection_v2_14_0.json`
- Docs: `https://docs.api.corpx.com/docs/getting-started`

**Arquitetura:** o microservico Pix e um adapter/orquestrador CorpX. Ele guarda ordens, chama a CorpX, recebe webhooks CorpX, normaliza eventos e chama a CredBridge. A CredBridge continua dona de usuarios, roles, regras de negocio, tokens BRLT, contratos Soroban e UI. O microservico Pix nunca deve movimentar tokens blockchain diretamente.

**Stack sugerida:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, PostgreSQL, httpx, pytest, Docker. A integracao no sistema atual usa NestJS 11, Prisma 7, PostgreSQL, `Transaction`, `AuditLog`, `StellarService` e Next.js 16.

---

## 1. Contrato CorpX que sera usado

### Ambientes

Conforme OpenAPI:

- Producao API: `https://api.corpxapi.com`
- Sandbox/dev API: `https://api.dev.corpxapi.com`
- Staging API: `https://api.stg.corpxapi.com`
- Producao auth: `https://auth.corpxapi.com`
- Sandbox auth: `https://auth.dev.corpxapi.com`

### Autenticacao

Endpoint:

- `POST /oauth2/token`
- Content-Type: `application/x-www-form-urlencoded`
- grant: `client_credentials`
- campos: `grant_type`, `client_id`, `client_secret`, `scope?`

Resposta:

- `access_token`
- `token_type`
- `expires_in`
- `scope?`

Todos os endpoints de negocio usam `Authorization: Bearer <access_token>`.

### Headers obrigatorios por chamada CorpX

Na maioria dos endpoints:

- `X-Tenant-Id`: tenant CorpX.
- `Idempotency-Key`: obrigatorio em chamadas de escrita como QR Code e Pix Out.

### Conta CorpX

Todas as operacoes Pix sao escopadas por:

- `accountId`: path param de `/v1/accounts/{accountId}/...`

Na primeira versao, usar uma conta operacional da CredBridge por ambiente. Se houver contas separadas por cliente/investidor no futuro, o modelo deve permitir mapear `ownerId -> corpxAccountId`.

### Deposito Pix - QR Code dinamico

Endpoint principal:

- `POST /v1/accounts/{accountId}/pix/qr-code/dynamic`

Body CorpX (`PixQrDynamicImmediateRequest`):

```json
{
  "pixKey": "contact@company.com.br",
  "value": 150.00,
  "expirationDate": "2026-06-05T19:00:00Z",
  "allowChangeValue": false,
  "message": "Aporte CredBridge",
  "identifier": "cb_tx_abc123",
  "payerPhysicalPerson": false
}
```

Campos importantes:

- `pixKey`: chave Pix da conta recebedora CorpX. Deve estar registrada na conta.
- `value`: valor em BRL com no maximo 2 casas decimais.
- `expirationDate`: expiracao ISO.
- `identifier`: identificador unico por conta, max 35 chars no QR dinamico. Este deve ser a chave de reconciliacao entre CredBridge, microservico Pix e CorpX.
- `allowChangeValue`: usar `false` para impedir valor divergente.

Resposta CorpX (`PixQrCodeCreateResponse`):

- `data.txid`: identificador interno/txid do QR.
- `data.payload`: EMV copia-e-cola.
- `data.location`: location do QR.
- `data.identifier`: identificador enviado.
- `data.status`: status inicial.
- `data.chave`: chave Pix usada.

Consulta de QR:

- `GET /v1/accounts/{accountId}/pix/qr-code/lookup?identifier=...`

Retorna `PixQrCode`, incluindo:

- `status`: `active`, `paid`, `cancelled`, `expired`
- `emv`
- `paidAt`
- `paidAmount`
- `endToEndId`
- `transactionId`
- `transaction.status`
- `payer`

Cancelamento:

- `DELETE /v1/accounts/{accountId}/pix/qr-code?identifier=...`

### Saque Pix - Pix Out

Endpoint sincrono:

- `POST /v1/accounts/{accountId}/pix/out`

Endpoint assincrono recomendado para alto volume ou maior resiliencia:

- `POST /v1/accounts/{accountId}/pix/out/async`

Body (`PixOutRequest`):

```json
{
  "accountId": "2e6b725b-84a0-400d-8740-22a5ba0f23e6",
  "keyType": "EMAIL",
  "key": "cliente@empresa.com",
  "amount": 150.00,
  "currency": "BRL",
  "description": "Saque CredBridge",
  "identifier": "cb_wd_abc123",
  "metadata": {
    "credbridgeTransactionId": "..."
  }
}
```

Tipos de chave:

- `CPF`
- `CNPJ`
- `EMAIL`
- `PHONE`
- `EVP`

Resposta sync (`PixOutResponse`):

- `transactionId`
- `status`: `APPROVED`, `PENDING`, `PROCESSING`, `REJECTED`
- `endToEndId`
- `amount`
- `currency`
- `paymentId`

Resposta async (`PixOutAsyncResponse`):

- `paymentId`
- `status = SCHEDULED`
- `scheduled = true`

Lookup de saque:

- `GET /v1/accounts/{accountId}/pix/payments/lookup?identifier=...`
- `GET /v1/accounts/{accountId}/pix/payments?paymentId=...|identifier=...|endToEndId=...`

Regra critica: se o Pix Out sync retornar `207 Multi-Status` por timeout de parceiro, nao repetir cegamente. Consultar status por `paymentId`, `identifier`, extrato ou webhook antes de retry.

### DICT e validacao de chave Pix

Endpoint:

- `GET /v1/accounts/{accountId}/pix/key/{pixKey}?keyType=...&noCache=false`

Uso:

- Validar chave antes de saque.
- Exibir nome/documento/banco ao usuario antes de confirmar.
- Respeitar rate limits de DICT.

### Webhooks CorpX

Gerenciamento:

- `GET /v1/webhooks`
- `POST /v1/webhooks`
- `PUT /v1/webhooks/{subscriptionId}`
- `DELETE /v1/webhooks/{subscriptionId}`
- `GET /v1/webhooks/events`
- `POST /v1/webhooks/replay`

Eventos relevantes:

- `qrcode.paid`
- `qrcode.expired`
- `qrcode.cancelled`
- `pix.in.completed`
- `pix.out.completed`
- `pix.out.failed`
- `pix.out.timeout`
- `pix.refund.completed`
- `pix.refund.failed`
- `pix.refund.received`
- `pix.med.opened`
- `pix.med.updated`

Assinatura:

- A assinatura e configurada na subscription com `authType: hmac`, `basic` ou `bearer`.
- Para este projeto, preferir `hmac`.
- O microservico Python recebe webhook CorpX, valida assinatura CorpX, normaliza evento e envia callback assinado para a CredBridge.

## 2. Encaixe no sistema CredBridge

CredBridge ja possui:

- `apps/api/src/shared/payments/pix.service.ts`: stub atual.
- `Transaction`: modelo usado para ordens de deposito/saque da pool.
- `AdminService.createDeposit`: cria deposito manual.
- `InvestmentsService.markAsPaid`: confirmacao manual do investidor.
- `AdminService.approveTransaction`: aprovacao manual e mint BRLT.
- `InvestmentsService.buildDepositStage/submitDepositStage`: investidor assina BRLT `approve` + pool `deposit`.

Novo comportamento:

- A confirmacao manual do Pix deve sair do caminho principal.
- O Pix service cria QR CorpX e acompanha status.
- Quando CorpX confirmar pagamento do QR, Pix service avisa a CredBridge.
- CredBridge minta BRLT e move `Transaction` para `APPROVED`.
- Investidor continua usando o fluxo ja existente de assinar `approve` + `deposit` na pool.

## 3. Modelo do microservico Pix

### Status interno normalizado

```text
CREATED
  -> PENDING_PAYMENT      (QR CorpX criado e ativo)
  -> PROCESSING           (Pix Out enviado ou agendado)
  -> CONFIRMED            (QR pago ou Pix Out concluido)
  -> FAILED               (Pix Out falhou ou provider rejeitou)
  -> EXPIRED              (QR expirado)
  -> CANCELED             (QR cancelado)
  -> TIMEOUT              (Pix Out timeout; exige lookup/reconciliacao)
  -> REFUNDED             (devolucao/reembolso)
```

### Tabelas do microservico

`pix_orders`:

- `id`
- `external_id` unico: ID da `Transaction` ou entidade CredBridge.
- `identifier` unico por conta CorpX: max 35 chars para QR dinamico.
- `type`: `DEPOSIT` ou `WITHDRAWAL`
- `owner_id`
- `owner_role`: `pme` ou `investor`
- `amount`: decimal BRL com 2 casas, ou `amount_cents` inteiro internamente.
- `status`
- `corpx_account_id`
- `corpx_tenant_id`
- `corpx_pix_key`
- `corpx_txid`
- `corpx_payment_id`
- `corpx_transaction_id`
- `end_to_end_id`
- `qr_code_payload`
- `qr_code_location`
- `pix_key`
- `pix_key_type`
- `description`
- `metadata_json`
- `expires_at`
- `confirmed_at`
- `failed_at`
- `failure_reason`
- `created_at`
- `updated_at`

`pix_events`:

- `id`
- `event_id` unico
- `pix_order_id`
- `source`: `corpx_webhook`, `corpx_lookup`, `internal`, `credbridge_callback`
- `event_type`
- `payload_json`
- `created_at`

`outbox_callbacks`:

- `id`
- `event_id`
- `pix_order_id`
- `target_url`
- `payload_json`
- `status`: `PENDING`, `SENT`, `FAILED`
- `attempt_count`
- `next_attempt_at`
- `last_error`
- `created_at`
- `updated_at`

## 4. Estrutura Python recomendada

```text
pix-service/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── api/
│   │   ├── orders.py
│   │   └── webhooks.py
│   ├── domain/
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── status.py
│   │   └── money.py
│   ├── services/
│   │   ├── orders_service.py
│   │   ├── callback_service.py
│   │   ├── reconciliation_service.py
│   │   └── idempotency_service.py
│   ├── providers/
│   │   ├── base.py
│   │   ├── sandbox.py
│   │   └── corpx.py
│   └── security/
│       ├── hmac.py
│       └── signatures.py
├── alembic/
├── tests/
├── Dockerfile
├── docker-compose.yml
└── pyproject.toml
```

## 5. Configuracao do microservico

```env
PIX_PROVIDER=corpx
CORPX_ENV=sandbox
CORPX_API_BASE_URL=https://api.dev.corpxapi.com
CORPX_AUTH_BASE_URL=https://auth.dev.corpxapi.com
CORPX_CLIENT_ID=
CORPX_CLIENT_SECRET=
CORPX_SCOPE=
CORPX_TENANT_ID=
CORPX_ACCOUNT_ID=
CORPX_RECEIVER_PIX_KEY=
CORPX_WEBHOOK_SECRET=
CREDBRIDGE_API_URL=http://localhost:3001
CREDBRIDGE_PIX_WEBHOOK_SECRET=
CREDBRIDGE_PIX_SERVICE_API_KEY=
DATABASE_URL=
```

## 6. API interna do microservico para a CredBridge

### `POST /v1/orders/deposits`

Cria QR dinamico CorpX.

Request:

```json
{
  "externalId": "credbridge-transaction-id",
  "ownerId": "credbridge-user-id",
  "ownerRole": "investor",
  "amount": 1000.00,
  "description": "Aporte CredBridge",
  "expiresInSeconds": 1800,
  "payerTaxNumber": "12345678900",
  "metadata": {
    "credbridgeEntityType": "transaction",
    "credbridgeEntityId": "..."
  }
}
```

Microservico chama CorpX:

- `POST /v1/accounts/{accountId}/pix/qr-code/dynamic`
- `identifier`: ID único curto gerado pela CredBridge (`pixIdentifier` indexado no banco, ex: NanoID de 12-15 caracteres), max 35 chars.
- `pixKey`: `CORPX_RECEIVER_PIX_KEY`
- `value`: valor BRL com 2 casas.
- `allowChangeValue`: `false`.

Response:

```json
{
  "pixOrderId": "pix_order_uuid",
  "status": "PENDING_PAYMENT",
  "amount": 1000.00,
  "identifier": "cbd_abc123",
  "txid": "corpx-txid",
  "qrCodePayload": "000201...",
  "qrCodeLocation": "https://...",
  "expiresAt": "2026-06-05T19:00:00Z"
}
```

### `POST /v1/orders/withdrawals`

Cria Pix Out CorpX.

Request:

```json
{
  "externalId": "credbridge-transaction-id",
  "ownerId": "credbridge-user-id",
  "ownerRole": "pme",
  "amount": 2500.00,
  "pixKey": "user@example.com",
  "pixKeyType": "EMAIL",
  "description": "Saque CredBridge",
  "metadata": {
    "walletAddress": "G..."
  }
}
```

Antes de executar Pix Out:

1. Opcional/recomendado: consultar DICT com `/pix/key/{pixKey}`.
2. Chamar `POST /v1/accounts/{accountId}/pix/out/async` por padrao.
3. Usar `identifier` unico para reconciliacao.

Response:

```json
{
  "pixOrderId": "pix_order_uuid",
  "status": "PROCESSING",
  "amount": 2500.00,
  "identifier": "cbw_abc123",
  "paymentId": "corpx-payment-id"
}
```

### Consultas

- `GET /v1/orders/{pixOrderId}`
- `GET /v1/orders/by-external-id/{externalId}`

Essas consultas retornam o estado local e, quando necessario, podem disparar reconciliacao defensiva:

- deposito: `GET /v1/accounts/{accountId}/pix/qr-code/lookup?identifier=...`
- saque: `GET /v1/accounts/{accountId}/pix/payments/lookup?identifier=...`

### Cancelamento

- `POST /v1/orders/{pixOrderId}/cancel`

Para deposito, chamar:

- `DELETE /v1/accounts/{accountId}/pix/qr-code?identifier=...`

## 7. Webhooks

### Webhook CorpX -> microservico

Endpoint:

- `POST /v1/webhooks/corpx`

Obrigatorio:

- Validar assinatura conforme configuracao `authType: hmac` da subscription CorpX.
- Persistir evento bruto em `pix_events`.
- Normalizar evento para a ordem local usando `identifier`, `txid`, `paymentId` ou `endToEndId`.
- Atualizar `pix_orders`.
- Criar item de outbox para callback CredBridge.

Mapeamento:

- `qrcode.paid` -> `DEPOSIT CONFIRMED`
- `qrcode.expired` -> `DEPOSIT EXPIRED`
- `qrcode.cancelled` -> `DEPOSIT CANCELED`
- `pix.in.completed` -> confirmar deposito se associado a QR/identifier
- `pix.out.completed` -> `WITHDRAWAL CONFIRMED`
- `pix.out.failed` -> `WITHDRAWAL FAILED`
- `pix.out.timeout` -> `WITHDRAWAL TIMEOUT`, exigir lookup antes de retry
- `pix.refund.*` -> marcar refund/remediacao
- `pix.med.*` -> abrir caso de risco operacional

### Callback microservico -> CredBridge

Endpoint CredBridge:

- `POST /v1/pix/webhooks/orders`

Headers:

- `X-CredBridge-Pix-Timestamp`
- `X-CredBridge-Pix-Signature`
- `X-CredBridge-Pix-Event-Id`

Payload:

```json
{
  "eventId": "uuid",
  "pixOrderId": "pix_order_uuid",
  "externalId": "credbridge-transaction-id",
  "identifier": "cbd_abc123",
  "type": "DEPOSIT",
  "status": "CONFIRMED",
  "amount": 1000.00,
  "txid": "corpx-txid",
  "paymentId": null,
  "transactionId": "corpx-transaction-id",
  "endToEndId": "E123...",
  "confirmedAt": "2026-06-05T18:35:00Z",
  "failureReason": null,
  "metadata": {
    "credbridgeEntityType": "transaction",
    "credbridgeEntityId": "..."
  }
}
```

CredBridge deve validar HMAC, timestamp e idempotencia por `eventId` antes de qualquer efeito em token.

## 8. Mudancas na API CredBridge

### Variaveis de ambiente

```env
PIX_SERVICE_BASE_URL=
PIX_SERVICE_API_KEY=
PIX_WEBHOOK_SECRET=
PIX_WEBHOOK_MAX_SKEW_SECONDS=300
PIX_DEPOSIT_EXPIRATION_SECONDS=1800
```

### Prisma

Estender `Transaction`:

- `pixOrderId String? @unique`
- `pixIdentifier String? @unique`
- `pixTxid String?`
- `pixPaymentId String?`
- `pixTransactionId String?`
- `pixEndToEndId String?`
- `pixQrCodePayload String?`
- `pixQrCodeLocation String?`
- `pixExpiresAt DateTime?`
- `pixConfirmedAt DateTime?`
- `pixFailureReason String?`
- `pixMetadata Json?`

Adicionar:

```prisma
model PixWebhookEvent {
  id          String   @id @default(uuid())
  eventId     String   @unique
  pixOrderId  String
  externalId  String
  identifier  String?
  status      String
  payload     Json
  processedAt DateTime @default(now())

  @@index([pixOrderId])
  @@index([externalId])
  @@index([identifier])
}
```

### Novo modulo NestJS `pix`

Criar:

- `apps/api/src/modules/pix/pix.module.ts`
- `apps/api/src/modules/pix/pix.client.ts`
- `apps/api/src/modules/pix/pix.controller.ts`
- `apps/api/src/modules/pix/pix.service.ts`
- `apps/api/src/modules/pix/dto/create-pix-deposit.dto.ts`
- `apps/api/src/modules/pix/dto/create-pix-withdrawal.dto.ts`
- `apps/api/src/modules/pix/dto/pix-webhook.dto.ts`
- `apps/api/src/modules/pix/pix-signature.ts`

Endpoints CredBridge:

- `POST /v1/pix/deposits`
- `GET /v1/pix/orders/:id`
- `POST /v1/pix/withdrawals`
- `GET /v1/pix/collections` (lista cobranças futuras das notas antecipadas da PME)
- `GET /v1/pix/collections/:id` (detalhes da cobrança para obter status e QR Code)
- `POST /v1/pix/webhooks/orders`

## 9. Fluxos de negocio

### Deposito do investidor para pool

```text
Investidor ou operador cria deposito
  -> CredBridge cria Transaction(DEPOSIT, PENDING_PAYMENT)
  -> CredBridge chama Pix service
  -> Pix service cria QR dinamico CorpX
  -> Front exibe EMV copia-e-cola e QR
  -> CorpX envia webhook qrcode.paid
  -> Pix service normaliza e chama CredBridge
  -> CredBridge valida callback e idempotencia
  -> CredBridge chama StellarService.mintBrlt(investorWallet, amount)
  -> Transaction vira APPROVED
  -> Investidor assina BRLT approve + Pool deposit
  -> Transaction vira COMPLETED
```

### Deposito PME/cliente para wallet BRLT

```text
PME cria deposito
  -> QR dinamico CorpX
  -> qrcode.paid
  -> CredBridge minta BRLT para wallet PME
  -> Transaction/PaymentOrder vira COMPLETED
```

### Saque PME/investidor via Pix

Sequencia segura:

```text
Usuario solicita saque
  -> CredBridge exige autorizacao financeira Privy
  -> CredBridge debita, bloqueia ou queima BRLT
  -> CredBridge chama Pix service
  -> Pix service valida chave via DICT
  -> Pix service chama CorpX Pix Out async
  -> CorpX envia pix.out.completed ou pix.out.failed
  -> Pix service chama CredBridge
  -> CredBridge marca COMPLETED ou estado de remediacao
```

Regra: nao enviar Pix de saida antes de debitar/bloquear tokens.

### Saque da PME com cobranca futura ao sacado

No caso da PME, o saque esta ligado a uma NF-e antecipada. Quando a PME recebe liquidez agora, a plataforma/pool passa a ter o direito de receber do sacado no vencimento da nota. Portanto, o saque da PME deve gerar tambem uma cobranca futura vinculada ao `Receivable`.

Fluxo alvo:

```text
PME assina cessao da NF-e
  -> Pool paga BRLT para PME
  -> PME solicita saque Pix para converter BRLT em BRL
  -> CredBridge debita/bloqueia/queima BRLT da PME
  -> Pix service executa Pix Out para a PME
  -> Pix service cria uma cobranca futura para o sacado
  -> Cobranca futura usa a data de vencimento da NF-e (`Receivable.dueDate`)
  -> No vencimento, sacado paga a cobranca
  -> CorpX confirma pagamento
  -> CredBridge liquida o recebivel: `settle_invoice_in_pool` + `settle_nfe`
```

Modelo de dominio recomendado:

```text
Receivable
  -> PmeWithdrawalOrder
    -> PixOut para PME
  -> ReceivableCollectionOrder
    -> cobranca futura ao sacado
```

Criar tabela no microservico Pix:

`collection_orders`:

- `id`
- `receivable_id`
- `pme_user_id`
- `debtor_name`
- `debtor_document`
- `amount`
- `due_date`
- `payment_deadline`
- `status`: `PENDING_PAYMENT`, `PAID`, `EXPIRED`, `CANCELED`, `FAILED`
- `corpx_account_id`
- `corpx_pix_key`
- `identifier`
- `corpx_txid`
- `qr_code_payload`
- `qr_code_location`
- `end_to_end_id`
- `created_from_withdrawal_order_id`
- `created_at`
- `updated_at`
- `paid_at`

Criar tambem uma referencia na CredBridge, preferencialmente em novo modelo:

```prisma
model ReceivableCollection {
  id            String   @id @default(uuid())
  receivableId  String
  pixOrderId    String?  @unique
  identifier    String?  @unique
  amount        Float
  dueDate       DateTime
  status        String   @default("pending_payment")
  txHash        String?
  endToEndId    String?
  paidAt        DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Uso CorpX na primeira versao:

- O OpenAPI v2.14.0 expõe criação de QR dinâmico imediato:
  - `POST /v1/accounts/{accountId}/pix/qr-code/dynamic`
  - Aceita `expirationDate` e restrição de pagador por CPF/CNPJ.
- O OpenAPI mostra decodificação de QR `dynamic-due-date`, mas não mostra endpoint de criação desse tipo.
- Portanto, a criação da cobrança futura utilizará a API CorpX de QR Code Dinâmico Imediato com a seguinte estrutura:
  - **Endpoint:** `POST /v1/accounts/{accountId}/pix/qr-code/dynamic`
  - **Body (`PixQrDynamicImmediateRequest`):**
    ```json
    {
      "pixKey": "CORPX_RECEIVER_PIX_KEY",
      "value": 15000.00,
      "expirationDate": "2026-07-15T23:59:59Z",
      "allowChangeValue": false,
      "message": "Pagamento antecipacao NF-e <chave/numero>",
      "identifier": "col_<pixIdentifier_curto>",
      "payerPhysicalPerson": false
    }
    ```
  - **Mapeamento de Campos:**
    - `pixKey`: Chave Pix operacional da CredBridge cadastrada no ambiente da CorpX.
    - `value`: O valor nominal do recebível antecipado (`amount`).
    - `expirationDate`: O vencimento da NF-e (`Receivable.dueDate`), formatado em ISO 8601.
    - `identifier`: Identificador único curto com prefixo `col_` para conciliação (NanoID de 12-15 chars, total max 20 chars).
    - `allowChangeValue`: Definido como `false` para impedir divergências de pagamento.

Decisão de produto/operação para o MVP:

- **Geração Imediata:** A cobrança e seu respectivo QR Code dinâmico serão gerados **imediatamente** no momento do adiantamento/saque da PME, com expiração na data de vencimento da nota.
- **Sem Agendador:** Não haverá fila, agendador de tarefas ou cron jobs para geração tardia de QR Codes.

Endpoints internos do microserviço para cobrança futura:

- `POST /v1/collections`
  - Cria a cobrança futura e já gera o QR Code na CorpX imediatamente.

- `GET /v1/collections/{id}`
  - Consulta a cobrança localmente (status, payload EMV, location do QR Code).

- `POST /v1/collections/{id}/cancel`
  - Cancela a cobrança e o QR Code correspondente na CorpX caso o recebível seja cancelado, recomprado ou remediado.

Payload sugerido:

```json
{
  "receivableId": "receivable-id",
  "pmeUserId": "pme-user-id",
  "debtorName": "Sacado S.A.",
  "debtorDocument": "12345678000190",
  "amount": 15000.00,
  "dueDate": "2026-07-15",
  "paymentDeadline": "2026-07-15",
  "metadata": {
    "withdrawalOrderId": "pix-order-id",
    "nfeKey": "..."
  }
}
```

Quando a cobranca for paga:

```text
CorpX qrcode.paid
  -> Pix service identifica `collection_orders.identifier`
  -> Pix service marca collection como PAID
  -> Pix service chama CredBridge
  -> CredBridge cria Settlement completed
  -> CredBridge chama StellarService.settleInvoiceInPool(...)
  -> CredBridge chama contrato NF-e `settle_nfe`
  -> Receivable vira settled
```

Importante: essa cobranca futura nao deve ser confundida com o saque da PME. O saque paga a PME hoje; a cobranca futura cobra o sacado no vencimento da NF-e.

## 10. Mudancas no frontend

### Acompanhamento de ordens pelo usuario

O usuario precisa conseguir acompanhar todas as ordens Pix dele sem depender do operador. A tela deve mostrar tanto depositos quanto saques, com status de Pix e status token-side.

Modelo de exibicao recomendado:

```text
Ordem Pix
  tipo: deposito | saque
  valor
  status Pix
  status CredBridge/token
  QR/copia-e-cola, se deposito pendente
  chave Pix, se saque
  identificador CorpX
  E2E, quando existir
  datas: criada, expira, confirmada, falhou
  acao atual: pagar, aguardar, finalizar aporte, ver comprovante, tentar novamente
```

Estados que a UI deve exibir:

- `PENDING_PAYMENT`: deposito aguardando pagamento Pix; mostrar QR, copia-e-cola e timer de expiracao.
- `PROCESSING`: saque enviado para processamento CorpX; mostrar que esta aguardando confirmacao bancaria.
- `CONFIRMED`: Pix confirmado; se ainda houver etapa token-side pendente, mostrar isso claramente.
- `APPROVED`: Pix confirmado e BRLT creditado/mintado; para investidor, mostrar botao `Finalizar Aporte`.
- `COMPLETED`: fluxo finalizado.
- `EXPIRED`: QR expirado; permitir criar nova ordem.
- `CANCELED`: ordem cancelada.
- `FAILED`: falha no Pix ou token-side; mostrar motivo e instrucao.
- `TIMEOUT`: Pix Out com timeout; informar que esta em reconciliacao e bloquear retry duplicado.

Endpoints CredBridge para acompanhamento:

- `GET /v1/pix/orders`
  - lista ordens do usuario autenticado.
  - query params: `type`, `status`, `limit`, `cursor`.
  - usuario comum ve somente suas ordens.
  - operador pode filtrar por `userId`.

- `GET /v1/pix/orders/:id`
  - detalhe de uma ordem.
  - retorna status Pix, status token-side, QR, chave Pix, identificadores CorpX, auditoria resumida e proximas acoes.

- `POST /v1/pix/orders/:id/refresh`
  - dispara reconciliacao defensiva.
  - deposito: microservico consulta `GET /v1/accounts/{accountId}/pix/qr-code/lookup?identifier=...`.
  - saque: microservico consulta `GET /v1/accounts/{accountId}/pix/payments/lookup?identifier=...`.
  - usar rate limit para evitar abuso.

Formato de resposta sugerido:

```json
{
  "id": "transaction-id",
  "pixOrderId": "pix-order-id",
  "type": "DEPOSIT",
  "purpose": "investor_pool",
  "amount": 1000.00,
  "status": "APPROVED",
  "pixStatus": "CONFIRMED",
  "tokenStatus": "BRLT_MINTED",
  "identifier": "cbd_abc123",
  "txid": "corpx-txid",
  "paymentId": null,
  "endToEndId": "E123...",
  "qrCodePayload": "000201...",
  "qrCodeLocation": "https://...",
  "pixKey": null,
  "pixKeyType": null,
  "failureReason": null,
  "createdAt": "2026-06-05T18:00:00Z",
  "expiresAt": "2026-06-05T18:30:00Z",
  "confirmedAt": "2026-06-05T18:10:00Z",
  "nextAction": "FINALIZE_POOL_DEPOSIT"
}
```

`nextAction` recomendado:

- `PAY_PIX`: mostrar QR e copia-e-cola.
- `WAIT_PIX_CONFIRMATION`: aguardando CorpX.
- `WAIT_TOKEN_CREDIT`: Pix confirmado, token ainda pendente.
- `FINALIZE_POOL_DEPOSIT`: investidor deve assinar `approve` + `deposit`.
- `VIEW_RECEIPT`: fluxo concluido.
- `RETRY_OR_CONTACT_SUPPORT`: falha/remediacao.
- `NONE`: sem acao.

Frontend:

- Investidor: adicionar aba ou bloco `Minhas ordens Pix` no dashboard.
- PME: 
  - Adicionar bloco `Ordens Pix` no dashboard ou configurações financeiras.
  - **Seção "Cobranças":** Exibir listagem das cobranças futuras geradas para os sacados de suas notas antecipadas (ReceivableCollection). Deve exibir o sacado, valor, data de vencimento da NF-e, status da cobrança (agendado, aguardando pagamento, pago, expirado) e disponibilizar a visualização de QR Code/copia-e-cola quando ativo.
- Operador: manter visao consolidada no painel, mas com link para a mesma estrutura de detalhe.

Atualizacao em tempo real:

- Primeira versao: polling com TanStack Query a cada 5-10 segundos enquanto houver ordem nao terminal.
- Versao futura: SSE ou WebSocket da CredBridge para status Pix/token.
- Nao usar callback direto do microservico para o browser.

Historico e comprovantes:

- Guardar eventos em `AuditLog` e `PixWebhookEvent`.
- Mostrar uma timeline curta no detalhe da ordem:
  - ordem criada;
  - QR gerado;
  - Pix confirmado/expirado/falhou;
  - BRLT creditado/debitado;
  - etapa on-chain concluida, se houver.
- Exibir `endToEndId` como identificador de comprovante Pix quando disponivel.

### Deposito do investidor

- Remover QR fake em `DepositModal`.
- Exibir `pixQrCodePayload` e `pixQrCodeLocation`/QR renderizado.
- Mostrar expiracao.
- Remover `Ja realizei a transferencia` como fonte da verdade.
- Fazer polling de `Transaction`/Pix order.
- Mostrar `Finalizar Aporte` somente apos Pix confirmado e BRLT mintado (`APPROVED`).

### Operador

- Mostrar `pixIdentifier`, `txid`, `paymentId`, `endToEndId`.
- Mostrar status Pix e expiracao.
- Manter override manual apenas como acao emergencial com motivo.

### Saque

- Criar drawer de saque BRLT/Pix em substituição definitiva ao fluxo anterior de Anchor/TESOURO.
- Campos: valor, chave Pix, tipo da chave, preview DICT, assinatura Privy, status.
- Para PME, mostrar tambem a cobranca futura vinculada ao saque:
  - sacado;
  - valor;
  - vencimento da NF-e;
  - status da cobranca;
  - QR/copia-e-cola quando gerado;
  - status de liquidacao do recebivel.

## 11. Seguranca e idempotencia

- CorpX OAuth token cacheado ate `expires_in`.
- Renovar token antes de expirar.
- Usar `Idempotency-Key` em toda escrita CorpX.
- Usar `identifier` unico e curto para reconciliacao.
- Nao retryar Pix Out sync apos `207` sem lookup.
- Validar webhooks CorpX.
- Validar callbacks Pix service -> CredBridge.
- Persistir `eventId` antes de mint/burn.
- Conferir valor recebido no QR (`paidAmount`) contra valor esperado.
- Conferir `identifier` e `externalId`.
- Registrar `AuditLog` em toda transicao.

## 12. Tarefas

### Tarefa 1: Preparar microservico Python

- [ ] Criar `pix-service/` com FastAPI, SQLAlchemy, Alembic, pytest e Docker.
- [ ] Criar `GET /health`.
- [ ] Criar config para CorpX e CredBridge.
- [ ] Criar testes smoke.

### Tarefa 2: Implementar client CorpX

- [ ] Criar `providers/corpx.py`.
- [ ] Implementar OAuth2 client credentials.
- [ ] Implementar cache de token.
- [ ] Implementar headers `Authorization`, `X-Tenant-Id`, `Idempotency-Key`.
- [ ] Implementar `create_dynamic_qr`.
- [ ] Implementar `lookup_qr`.
- [ ] Implementar `cancel_qr`.
- [ ] Implementar `dict_lookup`.
- [ ] Implementar `create_pix_out_async`.
- [ ] Implementar `lookup_payment`.
- [ ] Testar serializacao de requests conforme OpenAPI.

### Tarefa 3: Persistencia e estados

- [ ] Criar tabelas `pix_orders`, `pix_events`, `outbox_callbacks`.
- [ ] Criar status normalizado.
- [ ] Criar transicoes permitidas.
- [ ] Criar idempotencia por `external_id`, `identifier` e `event_id`.
- [ ] Testar duplicidade.

### Tarefa 4: Endpoints internos do Pix service

- [ ] `POST /v1/orders/deposits`.
- [ ] `POST /v1/orders/withdrawals`.
- [ ] `GET /v1/orders/{pixOrderId}`.
- [ ] `GET /v1/orders/by-external-id/{externalId}`.
- [ ] `POST /v1/orders/{pixOrderId}/cancel`.
- [ ] Exigir API key da CredBridge.

### Tarefa 5: Webhooks CorpX e outbox

- [ ] Criar `POST /v1/webhooks/corpx`.
- [ ] Validar assinatura HMAC CorpX.
- [ ] Normalizar eventos `qrcode.*` e `pix.out.*`.
- [ ] Reconciliar via lookup quando evento estiver incompleto.
- [ ] Criar callback para CredBridge via outbox.
- [ ] Implementar retry de callback.
- [ ] Testar webhook duplicado.

### Tarefa 6: Modulo Pix na CredBridge

- [ ] Criar `apps/api/src/modules/pix`.
- [ ] Criar `PixClient`.
- [ ] Criar HMAC verifier.
- [ ] Criar controller e service.
- [ ] Adicionar `PixModule` ao `AppModule`.
- [ ] Adicionar envs.
- [ ] Testar callback idempotente.
- [ ] Implementar `GET /v1/pix/orders`.
- [ ] Implementar `GET /v1/pix/orders/:id`.
- [ ] Implementar `POST /v1/pix/orders/:id/refresh`.

### Tarefa 7: Banco e tipos CredBridge

- [ ] Atualizar `schema.prisma`.
- [ ] Criar migration.
- [ ] Atualizar `packages/types`.
- [ ] Atualizar DTOs e responses de `Transaction`.

### Tarefa 8: Substituir deposito manual do investidor

- [ ] `AdminService.createDeposit` deve criar QR CorpX via Pix service.
- [ ] Criar deposito self-service se aprovado pelo produto.
- [ ] Remover QR fake do frontend.
- [ ] Remover confirmacao manual como fonte da verdade.
- [ ] Ao callback confirmado, mintar BRLT e marcar `APPROVED`.
- [ ] Preservar fluxo de assinatura on-chain para pool.
- [ ] Criar listagem `Minhas ordens Pix` para o investidor.
- [ ] Criar detalhe de ordem Pix com QR, timeline, identificadores CorpX e proxima acao.

### Tarefa 9: Implementar saques

- [ ] Definir politica de burn/escrow/resgate antes do Pix Out.
- [ ] Exigir autorizacao financeira Privy.
- [ ] Validar chave via DICT.
- [ ] Criar Pix Out async.
- [ ] Processar `pix.out.completed`, `pix.out.failed`, `pix.out.timeout`.
- [ ] Criar remediacao manual para token debitado e Pix falho.
- [ ] Para saque PME vinculado a recebivel, criar cobranca futura com `Receivable.dueDate`.
- [ ] Criar tabela/modelo `ReceivableCollection` na CredBridge ou equivalente.
- [ ] Criar tabela `collection_orders` no microservico Pix.
- [ ] Criar endpoints internos `POST /v1/collections`, `GET /v1/collections/:id` e `POST /v1/collections/:id/cancel`.
- [ ] Gerar o QR Code dinâmico da cobrança futura imediatamente ao criar a cobrança no momento do saque, configurando a expiração para a data de vencimento.
- [ ] Ao pagamento da cobranca futura, liquidar pool e NF-e on-chain.

### Tarefa 10: Observabilidade e operador

- [ ] Eventos: `pix.deposit.created`, `pix.deposit.confirmed`, `pix.withdrawal.created`, `pix.withdrawal.confirmed`, `pix.order.failed`, `pix.order.timeout`.
- [ ] Tela do operador com status CorpX.
- [ ] Acao de retry/reconciliacao.
- [ ] Acao de replay de webhook se necessario.

### Tarefa 11: Verificacao ponta a ponta

- [ ] Teste sandbox: QR dinamico -> webhook `qrcode.paid` -> mint BRLT -> pool deposit.
- [ ] Teste saque: token debitado -> Pix Out async -> `pix.out.completed`.
- [ ] Teste saque PME com cobranca futura: saque confirmado -> cobranca criada com vencimento da NF-e -> pagamento da cobranca -> recebivel liquidado.
- [ ] Teste timeout: Pix Out `207` ou `pix.out.timeout` -> lookup antes de retry.
- [ ] Teste idempotencia: replay de webhook nao duplica mint/burn.
- [ ] Teste QR expirado/cancelado.

## 13. Rollout

1. Implementar provider CorpX em sandbox.
2. Configurar webhook CorpX sandbox apontando para o microservico.
3. Integrar CredBridge em ambiente local/dev.
4. Trocar QR fake do investidor por QR CorpX.
5. Habilitar deposito assistido por operador.
6. Habilitar deposito self-service.
7. Implementar saque apos decisao de burn/escrow.
8. Fazer reconciliacao diaria: CorpX statement/QR/payment lookup vs `pix_orders` vs `Transaction`.
9. Desativar aprovacao manual como fluxo padrao.

## 14. Decisões Definidas e Alinhadas

- **Qual `accountId` CorpX será usado por ambiente?**
  - Conta corporativa operacional única da CredBridge para cada ambiente (Sandbox e Produção).
- **Qual chave Pix CorpX recebedora será usada para QR dinâmico?**
  - Chave Pix corporativa cadastrada na conta CredBridge do ambiente correspondente.
- **Depósitos serão assistidos por operador, self-service ou ambos?**
  - Ambos. Investidores fazem self-service no painel; operadores possuem tela de controle e suporte técnico.
- **Para saque, BRLT será queimado, transferido para escrow ou convertido por outro mecanismo?**
  - O BRLT será **queimado (burn)** na carteira do usuário. A transação Soroban correspondente deve ser executada e confirmada na blockchain Stellar **antes** de enviar a ordem de Pix Out à CorpX.
- **Substituição da Etherfuse:**
  - A integração anterior com a Etherfuse (Anchor/TESOURO) será **totalmente substituída** pelo fluxo Pix (BRL/BRLT) da CorpX. O drawer e o módulo de backend de Anchor/TESOURO serão deprecados/removidos.
- **Geração do Identificador Pix (`identifier`):**
  - Devido ao limite de 35 caracteres da CorpX/Banco Central, usaremos um `pixIdentifier` curto (ex: NanoID alfanumérico de 12 a 15 caracteres) gerado pela CredBridge e armazenado no banco para mapeamento 1:1 com o UUID original da transação.
- **Vamos restringir QR por CPF/CNPJ (`allowedPayerTaxNumber`)?**
  - Não. Não utilizaremos a restrição de pagador (allowedPayerTaxNumber) em depósitos ou cobranças para simplificar testes em ambiente de Sandbox e reduzir o atrito do MVP.
- **Tratamento de MED (Mecanismo Especial de Devolução):**
  - Webhooks de MED/refund abrirão automaticamente um caso de auditoria no sistema para bloqueio manual de cotas ou saldo, com alerta imediato para a mesa operacional.
