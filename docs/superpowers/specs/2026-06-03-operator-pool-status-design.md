# Painel do Operador — Situação da Pool (dados on-chain reais)

- **Data:** 2026-06-03
- **Status:** Aprovado (design)
- **Execução:** ao implementar, usar a skill `superpowers:executing-plans` sobre o plano derivado deste spec.

## Objetivo

Dar ao operador da CredBridge uma visão real e ao vivo do estado da liquidity pool
Soroban (Stellar testnet): patrimônio, cotas, preço da cota, caixa vs principal
aplicado, status de pausa, e a possibilidade de consultar as cotas de um investidor
por endereço Stellar.

Hoje a aba `pool-status` do dashboard do operador
(`apps/web/src/app/(operator)/operator/dashboard/page.tsx`, ~linhas 362-420) mostra
valores **hardcoded** e apenas IDs de contrato com links pro Stellar Expert. Este
trabalho substitui isso por dados lidos diretamente do contrato.

## Princípios

- **Somente dados reais on-chain.** Nada de valores hardcoded nem mocks no fluxo do
  produto. Os números vêm de chamadas read-only ao contrato.
- **Decimais lidos do contrato, não assumidos.** Os tokens definem `decimals` no
  `initialize` (ver `contracts/mock_brlt/src/lib.rs:20-26`), então a formatação lê
  `decimals()` on-chain de cada token. A única escala fixa é `PRICE_SCALE = 1e9`,
  constante do contrato da pool (`contracts/liquidity_pool/src/lib.rs:11`).
- **Read-only e sem custo.** Leituras usam `simulateTransaction` — não assinam, não
  pagam fee, não alteram estado.
- **Gated por operador.** Endpoints sob `/admin/*` com `assertOperator`.

## Contrato — o que é lido

Métodos read-only do contrato da pool (`contracts/liquidity_pool/src/lib.rs`):

- `get_pool_state()` → struct `PoolState`: `admin`, `operator`, `asset_address`
  (token BRLT), `share_token_address` (token de cotas CBPOOL), `total_principal`,
  `total_shares`, `paused`.
- `get_nav()` → i128: `cash_balance + total_principal` (caixa BRLT do endereço da
  pool + principal aplicado em invoices ativas).
- `get_share_price()` → i128: `nav * 1e9 / total_shares` (escala `PRICE_SCALE`).

Tokens (interface SEP-41 / FungibleToken):

- `decimals()` → u32, no token BRLT e no token de cotas.
- `balance(address)` → i128, no token de cotas (para a busca por investidor).

Derivação: `cash_balance = nav - total_principal` (evita uma leitura extra).

## Backend (NestJS — `apps/api`)

### 1. `StellarService` (`apps/api/src/shared/blockchain/stellar.service.ts`)

- **Importar** `scValToNative` de `@stellar/stellar-sdk`.
- **Helper privado `simulateRead(contractId, method, args[])`:** monta tx com
  `new Contract(contractId).call(method, ...args)` sobre uma conta de origem
  (a `platformKeypair`), chama `server.simulateTransaction(tx)`, valida com
  `rpc.Api.isSimulationSuccess`, e retorna `scValToNative(sim.result.retval)`.
  Em falha de simulação, lança erro com a mensagem da simulação.
- **`getPoolStatus(): Promise<PoolStatus>`:**
  1. lê `STELLAR_POOL_CONTRACT_ID` (lança se ausente);
  2. `state = simulateRead(pool, 'get_pool_state', [])`;
  3. `nav = simulateRead(pool, 'get_nav', [])`;
  4. `sharePrice = simulateRead(pool, 'get_share_price', [])`;
  5. `brltDecimals = simulateRead(state.asset_address, 'decimals', [])`;
  6. `shareDecimals = simulateRead(state.share_token_address, 'decimals', [])`;
  7. deriva `cash = nav - total_principal`;
  8. monta a resposta com valores **raw (stroops como string)** e **formatados**
     (ver tipos abaixo).
- **`getInvestorShares(address): Promise<InvestorShares>`:**
  1. `state = simulateRead(pool, 'get_pool_state', [])`;
  2. `shareDecimals = simulateRead(state.share_token_address, 'decimals', [])`;
  3. `sharePrice = simulateRead(pool, 'get_share_price', [])`;
  4. `balance = simulateRead(state.share_token_address, 'balance', [Address address])`;
  5. retorna cotas (raw + units) e valor estimado em BRLT
     (`units_cotas * sharePrice / 1e9`).

Notas de decode:
- `scValToNative` devolve a struct como objeto com as chaves snake_case do contrato;
  endereços viram strings (`C.../G...`); i128 vira `bigint`; bool vira boolean.
- Conversão de formatação: `valor_humano = Number(raw) / 10**decimals`;
  `sharePriceHuman = Number(rawSharePrice) / 1e9` (BRLT por cota).
- Manter o raw como string no payload pra não perder precisão; o número humano é
  para exibição.

### 2. Interface (`apps/api/src/shared/blockchain/blockchain.interface.ts`)

Adicionar à `BlockchainService`:

```ts
getPoolStatus(): Promise<PoolStatus>;
getInvestorShares(address: string): Promise<InvestorShares>;
```

Tipos de resposta:

```ts
interface Scaled { raw: string; value: number } // raw em stroops; value já formatado

interface PoolStatus {
  poolContractId: string;
  brltTokenId: string;
  shareTokenId: string;
  admin: string;
  operator: string;
  paused: boolean;
  brltDecimals: number;
  shareDecimals: number;
  nav: Scaled;            // BRLT
  cashBalance: Scaled;    // BRLT (derivado)
  totalPrincipal: Scaled; // BRLT
  totalShares: Scaled;    // cotas
  sharePrice: { raw: string; value: number }; // BRLT por cota (raw/1e9)
}

interface InvestorShares {
  address: string;
  shares: Scaled;          // cotas
  estimatedValueBrl: number; // cotas * sharePrice
}
```

### 3. Admin (`apps/api/src/modules/admin/`)

- **Controller** (`admin.controller.ts`):
  - `GET /admin/pool/status` → `assertOperator(req)` → `service.getPoolStatus()`.
  - `GET /admin/pool/shares?address=G...` → `assertOperator(req)` → valida formato
    do endereço (Stellar pubkey, começa com `G`, 56 chars) → `service.getInvestorShares(address)`.
    Endereço inválido → `BadRequestException`.
- **Service** (`admin.service.ts`): injeta `BLOCKCHAIN_SERVICE` e delega aos dois
  métodos novos.
- **Erros:** pool não configurada / não inicializada / RPC indisponível → erro
  propagado; o front exibe toast. Mensagens claras em PT.

## Frontend (`apps/web`)

### 4. `apps/web/src/lib/api/pool.ts` (novo)

- Tipos `PoolStatus` e `InvestorShares` (espelham o backend).
- `usePoolStatus()`: `useQuery` com `queryKey ["operator","pool","status"]`,
  `queryFn: () => apiFetch<PoolStatus>("/admin/pool/status")`, `staleTime: Infinity`,
  `enabled` controlado (só quando a aba `pool-status` está ativa). Refetch disparado
  pelo botão Atualizar.
- `useInvestorShares(address)`: `useQuery` com `enabled: false` por padrão; dispara
  manualmente (refetch) quando o operador clica Buscar. `queryKey` inclui o address.

### 5. Painel (`apps/web/src/app/(operator)/operator/dashboard/page.tsx`, ~362-420)

Substituir o conteúdo hardcoded da aba `pool-status` por:

- **Cabeçalho** + botão **Atualizar** (chama `refetch`; desabilitado em `isFetching`).
- **Cards `MiniKpi`** (`components/patterns/MiniKpi.tsx`): NAV (BRL), Total de cotas,
  Preço da cota (BRLT/cota), Caixa BRLT, Principal aplicado, e badge de status
  (Ativa / Pausada).
- **Loading:** `Skeleton` (`components/primitives/Skeleton.tsx`).
- **Erro:** `useToast().showToast(..., "error")`.
- **Busca por investidor:** input de endereço `G...` + botão Buscar → card com cotas
  e valor estimado em BRLT + link Stellar Expert pro endereço.
- **Manter** os cards de IDs de contrato (pool e BRLT) com links Stellar Expert que
  já existem, agora usando os IDs vindos do `PoolStatus`.

Estilo: objetos `style` inline em **uma linha** (convenção do projeto), classes
`card`/`eyebrow`/`kpi`/`num`/`mono`, tokens de cor de `styles/tokens.css`.

## Verificação (sem mocks)

- Implementação validada batendo no **contrato testnet real**: chamar o endpoint
  `/admin/pool/status` (API rodando) e comparar os números com
  `stellar contract invoke ... -- get_pool_state | get_nav | get_share_price` e com o
  Stellar Expert. Os valores têm que bater.
- Invariantes conferidas: `nav ≈ caixa BRLT do pool + total_principal`;
  `sharePrice = nav*1e9/total_shares`; soma das cotas dos investidores = `total_shares`.
- Opcional (não-mock): teste de função pura da formatação stroops→decimal.

## Fora de escopo

- Busca por usuário/email (resolução no banco) — só por endereço Stellar.
- Auto-refresh periódico — refresh é manual.
- Qualquer ação de escrita na pool a partir do painel (depósito/saque/compra de
  invoice já existem em outros fluxos).
