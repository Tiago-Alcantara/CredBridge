# Plano de Implementacao - Integracao do Frontend com o Microservico Pix (Geracao Local)

> **Para agentes executores:** SUB-SKILL OBRIGATORIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** Conectar o frontend da CredBridge ao novo microserviço de Pix. Isso envolve atualizar o modal de depósito no portal do investidor para exibir o QR Code em Base64 gerado localmente pelo microserviço Pix (usando a biblioteca `segno`), ligar a criação de ordens do operador ao fluxo integrado com o microserviço, e implementar um runner automático em background no microserviço Pix para enviar os callbacks outbox pendentes para o NestJS.

---

## Detalhes das Tarefas

### Tarefa 1: Adicionar Dependência e Atualizar Modelos no Pix Service
- [ ] Adicionar a dependência `"segno>=1.6.1"` no `pyproject.toml` do `pix-service`.
- [ ] Atualizar o model `PixOrder` em `pix-service/app/domain/models.py` para incluir a coluna `qr_code_base64: Mapped[str | None] = mapped_column(Text, nullable=True)`.
- [ ] Atualizar o model `CollectionOrder` em `pix-service/app/domain/models.py` para incluir a coluna `qr_code_base64: Mapped[str | None] = mapped_column(Text, nullable=True)`.
- [ ] Criar e aplicar a migration do Alembic para adicionar as novas colunas.

### Tarefa 2: Gerar QR Code Localmente em Base64
- [ ] Adicionar o helper `generate_qr_base64(payload: str) -> str` usando `segno` no `pix-service`.
- [ ] Atualizar `OrdersService.create_deposit` em `pix-service/app/services/orders_service.py` para gerar e persistir o QR Code Base64 no banco.
- [ ] Atualizar `orders_service.py` na criação de cobranças (`create_collection`) para gerar e persistir o QR Code Base64 também para cobranças futuras.
- [ ] Atualizar os schemas Pydantic `PixOrderResponse` e `CollectionOrderResponse` em `pix-service/app/domain/schemas.py` para incluir o campo `qr_code_base64`.

### Tarefa 3: Atualizar Banco e Client do NestJS
- [ ] Modificar `apps/api/prisma/schema.prisma` para adicionar `pixQrCodeBase64 String? @db.Text` ao model `Transaction`.
- [ ] Aplicar alteração ao banco com `npx prisma db push`.
- [ ] Atualizar a interface `PixOrderResponse` e o mapeamento camelCase em `apps/api/src/modules/pix/pix.client.ts` para receber `qrCodeBase64`.
- [ ] Atualizar `PixService.createDepositOrder` em `apps/api/src/modules/pix/pix.service.ts` para persistir o `pixQrCodeBase64` do microserviço na transação local.

### Tarefa 4: Runner de Outbox em Background no FastAPI
- [ ] Modificar `pix-service/app/main.py` para criar um loop de background (`lifespan` event) executando `send_pending_callbacks` a cada 5 segundos para despachar as confirmações de Pix de volta para o NestJS de forma automática.

### Tarefa 5: Script de Simulação de Webhook
- [ ] Criar o script `scripts/simulate_webhook.py` que calcula a assinatura HMAC-SHA256 usando `CORPX_WEBHOOK_SECRET` do `.env` e envia o evento `qrcode.paid` simulando o gateway de pagamento.

### Tarefa 6: Frontend - Tipos e Integração
- [ ] Modificar `apps/web/src/lib/api/investments.ts` para adicionar `pixQrCodeBase64?: string` ao tipo `InvestorTransaction`.
- [ ] Modificar `apps/web/src/lib/api/admin.ts` alterando o endpoint de `useCreateDeposit` de `/admin/transactions/deposit` para `/pix/deposits`.
- [ ] Modificar `apps/web/src/components/investor/DepositModal.tsx` para renderizar o QR Code a partir de `transaction.pixQrCodeBase64` (ex: `<img src={`data:image/png;base64,${transaction.pixQrCodeBase64}`} />`) e usar `transaction.pixQrCodePayload` para copiar a chave.
