# Investor — Compra de cotas (alocação direta por recebível)

**Data:** 2026-05-08
**Status:** Aprovado para implementação
**Escopo:** Investidor adquire cotas de recebíveis específicos do pool, com pagamento Pix simulado, deságio fixo de 3%, e visualização de posições.

---

## 1. Contexto

Investidor logado vê um pool de recebíveis (PME-originados) no dashboard. Hoje a tabela é informativa apenas. Esta entrega adiciona o fluxo de compra: o investidor escolhe um recebível, confirma um pagamento Pix mockado, e passa a ser dono daquela cota.

**Decisões tomadas no brainstorming:**

| Tópico | Decisão |
|---|---|
| Modelo da cota | Alocação direta por recebível (não pool agregado) |
| Funding | Total apenas — 1 investidor por recebível |
| Pagamento | Pix simulado (QR + copia-cola fakes, confirmação manual) |
| Visão pós-compra | Toggle "Pool / Minhas cotas" na mesma tabela do dashboard |
| Pricing | Deságio fixo 3% sobre face value |
| Entry point | Botão "Comprar" por linha do pool |

---

## 2. Modelo de dados

### Novo modelo `Investment`

```prisma
model Investment {
  id             String     @id @default(uuid())
  investorUserId String
  receivableId   String     @unique  // 1:1 — total funding only
  amountPaid     Float                // faceValue * (1 - discountRate)
  faceValue      Float                // valor do recebível na compra
  discountRate   Float      @default(0.03)
  status         String     @default("active")  // active | settled | defaulted
  pixTxId        String?              // id do "pix" mockado
  paidAt         DateTime   @default(now())
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  receivable     Receivable @relation(fields: [receivableId], references: [id])

  @@index([investorUserId])
}
```

### Mudança no `Receivable`

Adiciona relação reversa opcional:

```prisma
model Receivable {
  // ... campos existentes
  investment   Investment?
}
```

### Migration

`prisma migrate dev --name add_investment_model` cria a tabela e o índice.

---

## 3. API

Todos os endpoints sob `/v1`, protegidos por `JwtAuthGuard`. Role do JWT deve ser `investor` exceto onde indicado.

### Novo módulo `investments`

Estrutura:

```
apps/api/src/modules/investments/
  dto/create-investment.dto.ts
  investments.controller.ts
  investments.service.ts
  investments.repository.ts
  investments.module.ts
  investments.service.spec.ts
```

### Endpoints

| Método | Path | Body / Query | Resposta |
|---|---|---|---|
| `POST` | `/investments` | `{ receivableId: string, pixTxId?: string }` | `Investment` (com receivable incluído) |
| `GET`  | `/investments/me` | — | `Investment[]` (com receivable incluído) |
| `GET`  | `/investments/me/stats` | — | `{ totalInvested, expectedReturn, activePositions }` |

### Lógica de `POST /investments`

Executar dentro de `prisma.$transaction`:

1. Carregar receivable por id; 404 se não existir.
2. Validar `receivable.status ∈ {validated, active}` e que não tenha `investment` associado; 409 `Receivable indisponível` caso contrário.
3. Validar `receivable.userId !== req.user.userId` (impede PME comprar próprio recebível); 400 caso contrário.
4. Calcular `amountPaid = receivable.value * 0.97`.
5. Criar `Investment { investorUserId, receivableId, amountPaid, faceValue: receivable.value, discountRate: 0.03, pixTxId }`.
6. Atualizar `receivable.status = 'active'`.
7. Inserir `AuditLog { event: 'investment.created', entityType: 'investment', entityId: investment.id, userId: investor, metadata: { receivableId, amountPaid, faceValue } }`.

### Mudança em `receivables`

`findPool` (já existente) passa a excluir receivables que tenham `investment` associado:

```ts
this.prisma.receivable.findMany({
  where: {
    status: { in: ['validated', 'active'] },
    investment: null,
  },
  orderBy: { dueDate: 'asc' },
  take: limit,
});
```

`getPoolStats` aplica o mesmo filtro `investment: null` nas agregações.

---

## 4. Tipos compartilhados (`packages/types`)

Novo arquivo `packages/types/src/investment.ts`:

```ts
export type InvestmentStatus = 'active' | 'settled' | 'defaulted';

export interface Investment {
  id: string;
  investorUserId: string;
  receivableId: string;
  amountPaid: number;
  faceValue: number;
  discountRate: number;
  status: InvestmentStatus;
  pixTxId?: string;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
  receivable?: import('./receivable').Receivable;
}

export interface CreateInvestmentInput {
  receivableId: string;
  pixTxId?: string;
}

export interface InvestorPositionStats {
  totalInvested: number;
  expectedReturn: number;
  activePositions: number;
}
```

Reexportar de `packages/types/src/index.ts`.

---

## 5. Web — API client

Novo arquivo `apps/web/src/lib/api/investments.ts`:

- `useInvestorPositions()` → `GET /investments/me`
- `useInvestorPositionStats()` → `GET /investments/me/stats`
- `useBuyReceivable()` → `POST /investments`; on success, invalida `["receivables", "pool"]`, `["receivables", "pool", "stats"]`, `["investments", "me"]`, `["investments", "me", "stats"]`.

---

## 6. Web — UI

### Componentes novos (sob `apps/web/src/components/investor/`)

- `PoolToggle.tsx` — segmented control com props `value: 'pool' | 'mine'`, `onChange`.
- `PoolTable.tsx` — recebe `pool: Receivable[]` e `onBuy: (r) => void`. Coluna extra "Ação" com botão **Comprar**.
- `PositionsTable.tsx` — recebe `positions: Investment[]`. Colunas: ID, Sacado, Pago, Face, Lucro, Vencimento, Status.
- `BuyDrawer.tsx` — drawer 480px com 3 etapas inline:
  1. **Resumo:** sacado, face value, vencimento, dias até vencer, "paga R$ X · recebe R$ Y · lucro R$ Z". Botão **Continuar pagamento**.
  2. **Pix:** QR SVG mockado (placeholder estático), copia-cola Pix string fake fixa, "Aguardando pagamento", botão **Confirmar pagamento**, botão **Cancelar**.
  3. **Sucesso:** ícone check, "Cota adquirida", id da posição. Botão **Ver minhas cotas** (fecha + troca toggle pra `mine`).

### Página `apps/web/src/app/(investor)/investor/dashboard/page.tsx`

- Estado local `view: 'pool' | 'mine'` (default `pool`).
- Estado local `buyTarget: Receivable | null` (controla abertura do drawer).
- KPIs do header alternam entre `useInvestorStats` (pool) e `useInvestorPositionStats` (mine) conforme `view`.
- Abaixo do `<PoolToggle>` renderiza `<PoolTable>` ou `<PositionsTable>` conforme `view`.
- `<BuyDrawer>` montado quando `buyTarget !== null`. Após sucesso, fecha drawer e troca `view` pra `mine`.

### Estados especiais (UI)

| Caso | Comportamento |
|---|---|
| Pool vazio | Mensagem "Sem recebíveis disponíveis" no body da tabela |
| Sem posições | Mensagem "Nenhuma cota adquirida" no body |
| Loading do pool | Linha "Carregando…" (já existe) |
| Loading da compra | Botão **Confirmar pagamento** com spinner; bloqueia interação |
| Erro 409 (corrida) | Mostra "Outro investidor adquiriu primeiro", fecha drawer, refresh pool |
| Erro genérico | "Erro ao processar compra. Tentar novamente?" — botão de retry |

---

## 7. Tratamento de erros

### Backend (HTTP codes)

| Código | Quando |
|---|---|
| 400 | PME tentando comprar próprio recebível |
| 401 | Sem JWT |
| 403 | Role do JWT ≠ `investor` |
| 404 | Receivable inexistente |
| 409 | Receivable já comprado ou status inválido |

Reutilizar `extractApiErrorMessage` no frontend (já existe). Adicionar traduções no mapa `translateApiError` se necessário (provavelmente reuso direto das mensagens do backend em PT).

### Race condition

A transação isola check-then-create-then-update. Por causa do `@unique` em `Investment.receivableId`, mesmo sem `SELECT FOR UPDATE` o segundo POST falha por unique violation, que mapeamos pra 409.

---

## 8. Testes

### Unitários — API (`investments.service.spec.ts`)

Cobertura mínima:

1. `create()` calcula `amountPaid = value * 0.97` corretamente
2. `create()` falha com `ConflictException` quando receivable já tem investment
3. `create()` falha com `BadRequestException` quando `receivable.userId === investorUserId`
4. `create()` falha com `NotFoundException` quando receivable não existe
5. `create()` insere AuditLog após sucesso
6. `findMine()` retorna apenas posições do investorUserId passado
7. `getMyStats()` calcula `totalInvested`, `expectedReturn = sum(faceValue - amountPaid)`, `activePositions`
8. Transação faz rollback se update do receivable falhar (mock prisma rejeitando update)

### Unitários — API (`receivables.service.spec.ts`)

Adicionar:

9. `findPool()` exclui receivables com investment associado
10. `getPoolStats()` exclui receivables com investment associado

### Frontend

Sem suite e2e/unit no projeto atualmente. Validação manual:

- Registrar conta `investor`
- Login → `/investor/dashboard`
- Aba **Pool**: clicar **Comprar** numa linha → drawer abre
- Etapa resumo → continuar → etapa Pix → confirmar → etapa sucesso
- Aba muda pra **Minhas cotas**, posição visível
- Voltar pra **Pool**: receivable desapareceu
- Tentar comprar receivable inexistente via DevTools → erro tratado

---

## 9. Auditoria

Toda compra registra entrada em `AuditLog`:

```ts
{
  event: 'investment.created',
  entityType: 'investment',
  entityId: investment.id,
  userId: investorUserId,
  metadata: { receivableId, amountPaid, faceValue }
}
```

---

## 10. Estrutura de arquivos novos / modificados

```
apps/api/prisma/schema.prisma               (modificar — add Investment + relação)
apps/api/prisma/migrations/.../migration.sql (gerado)
apps/api/src/modules/investments/
  dto/create-investment.dto.ts              (novo)
  investments.controller.ts                 (novo)
  investments.service.ts                    (novo)
  investments.repository.ts                 (novo)
  investments.module.ts                     (novo)
  investments.service.spec.ts               (novo)
apps/api/src/app.module.ts                  (modificar — importar InvestmentsModule)
apps/api/src/modules/receivables/receivables.repository.ts  (modificar — filtro investment:null)
apps/api/src/modules/receivables/receivables.service.spec.ts (novo ou modificar)

packages/types/src/investment.ts            (novo)
packages/types/src/index.ts                 (modificar — reexportar)

apps/web/src/lib/api/investments.ts         (novo)
apps/web/src/components/investor/
  BuyDrawer.tsx                             (novo)
  PoolTable.tsx                             (novo)
  PositionsTable.tsx                        (novo)
  PoolToggle.tsx                            (novo)
apps/web/src/app/(investor)/investor/dashboard/page.tsx (modificar)
```

---

## 11. Notas de compatibilidade com seed

O seed atual cria receivables com `status: 'active'` sem associar `Investment`. Após esta feature, a semântica é "active = comprado por um investidor". O filtro `investment: null` no `findPool` ignora a inconsistência e mantém esses receivables visíveis no pool. Como ação opcional na implementação: o `seed.ts` pode ser atualizado para criar `Investment` records para os receivables atualmente 'active', associados ao usuário investor `gabriel@capitalventures.com.br`. Não é bloqueador — pode ser deixado como limpeza futura.

---

## 12. Fora de escopo

- Liquidação real (sacado pagando no vencimento → investment.status = settled)
- Inadimplência (defaulted)
- Rateio (parcial funding)
- Pagamento Pix real (gateway)
- Smart contract Stellar pra registrar cessão on-chain
- Página dedicada de portfólio histórico
- Notificações por email
