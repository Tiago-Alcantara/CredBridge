# Painel do Operador — Situação da Pool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no dashboard do operador o estado real on-chain da liquidity pool (NAV, cotas, preço da cota, caixa/principal, status) e permitir consultar cotas de um investidor por endereço Stellar.

**Architecture:** Leituras read-only ao contrato Soroban via `simulateTransaction` (sem assinar, sem fee, sem alterar estado), decodificadas com `scValToNative`. Decimais lidos on-chain de cada token (`decimals()`), nunca assumidos. Endpoints `GET /admin/pool/status` e `/admin/pool/shares` gated por operador. Front consome via react-query e substitui o painel hardcoded por dados reais, com refresh manual.

**Tech Stack:** NestJS, @stellar/stellar-sdk (rpc, Contract, scValToNative, nativeToScVal), Next.js App Router, @tanstack/react-query.

**Spec:** `docs/superpowers/specs/2026-06-03-operator-pool-status-design.md`

> **Nota sobre verificação:** Por decisão do usuário, **não há testes com mock**. A verificação é feita batendo no **contrato testnet real** e comparando com `stellar contract invoke` / Stellar Expert.

---

## Estrutura de arquivos

- `apps/api/src/shared/blockchain/blockchain.interface.ts` — Modify: tipos `Scaled`, `PoolStatus`, `InvestorShares` + 2 métodos na interface.
- `apps/api/src/shared/blockchain/stellar.service.ts` — Modify: import `scValToNative`; helper `simulateRead`; métodos `getPoolStatus`, `getInvestorShares`.
- `apps/api/src/modules/admin/admin.service.ts` — Modify: 2 métodos que delegam ao `StellarService`.
- `apps/api/src/modules/admin/admin.controller.ts` — Modify: 2 rotas GET gated por `assertOperator`.
- `apps/web/src/lib/api/pool.ts` — Create: tipos + hooks `usePoolStatus`, `useInvestorShares`.
- `apps/web/src/app/(operator)/operator/dashboard/page.tsx` — Modify: substituir bloco da aba `pool-status` (~362-420) por dados reais.

---

### Task 1: Tipos e métodos na interface BlockchainService

**Files:**
- Modify: `apps/api/src/shared/blockchain/blockchain.interface.ts`

- [ ] **Step 1: Adicionar os tipos antes de `export interface BlockchainService`**

Inserir após o bloco `UnsignedSorobanTx` (linha 40):

```ts
export interface Scaled {
  /** Valor bruto em stroops (menor unidade do token), como string para preservar precisão. */
  raw: string;
  /** Valor já convertido para a unidade humana (raw / 10**decimals). */
  value: number;
}

export interface PoolStatus {
  poolContractId: string;
  brltTokenId: string;
  shareTokenId: string;
  admin: string;
  operator: string;
  paused: boolean;
  brltDecimals: number;
  shareDecimals: number;
  nav: Scaled;
  cashBalance: Scaled;
  totalPrincipal: Scaled;
  totalShares: Scaled;
  /** Preço da cota em BRLT por cota (raw escalado por 1e9). */
  sharePrice: { raw: string; value: number };
}

export interface InvestorShares {
  address: string;
  shares: Scaled;
  estimatedValueBrl: number;
}
```

- [ ] **Step 2: Adicionar os métodos à interface `BlockchainService`**

Inserir antes do fechamento `}` da interface (após `submitSignedTx`, linha 82):

```ts
  /** Lê o estado on-chain da liquidity pool (read-only, via simulação). */
  getPoolStatus(): Promise<PoolStatus>;
  /** Lê o saldo de cotas (share token) de um endereço Stellar. */
  getInvestorShares(address: string): Promise<InvestorShares>;
```

- [ ] **Step 3: Verificar que compila**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "stellar.service.spec" | grep "blockchain.interface" || echo "interface OK"`
Expected: `interface OK` (StellarService ainda não implementa — erro esperado de "missing methods" aparece na Task 2; o grep aqui filtra só erros do arquivo da interface).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/shared/blockchain/blockchain.interface.ts
git commit -m "feat(api): pool status types in blockchain interface"
```

---

### Task 2: StellarService — simulateRead + getPoolStatus + getInvestorShares

**Files:**
- Modify: `apps/api/src/shared/blockchain/stellar.service.ts`

- [ ] **Step 1: Adicionar `scValToNative` ao import do SDK**

No import de `@stellar/stellar-sdk` (linhas 4-16), adicionar `scValToNative` (manter ordem alfabética junto de `nativeToScVal`):

```ts
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
```

- [ ] **Step 2: Importar os tipos da interface**

No bloco `import type { ... } from './blockchain.interface';` (linhas 17-24), adicionar:

```ts
  InvestorShares,
  PoolStatus,
  Scaled,
```

- [ ] **Step 3: Adicionar os métodos no fim da classe**

Inserir logo antes do `}` final da classe `StellarService` (após `submitSignedTx`, que termina na linha ~1112 após a Task de fee-bump):

```ts
  // -----------------------------------------------------------------------
  // Leitura read-only de contrato (simulação — sem assinar, sem fee)
  // -----------------------------------------------------------------------
  private async simulateRead(
    contractId: string,
    method: string,
    args: xdr.ScVal[] = [],
  ): Promise<unknown> {
    const { server, platformKeypair } = this.requireContractConfig();

    const account = await server.getAccount(platformKeypair.publicKey());
    const contract = new Contract(contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(TX_TIMEOUT_SECONDS)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim)) {
      throw new Error(`Simulation failed for ${method}: ${JSON.stringify(sim)}`);
    }
    if (!sim.result?.retval) {
      throw new Error(`No return value from ${method}`);
    }
    return scValToNative(sim.result.retval);
  }

  async getPoolStatus(): Promise<PoolStatus> {
    const poolId = process.env.STELLAR_POOL_CONTRACT_ID;
    if (!poolId) {
      throw new Error('STELLAR_POOL_CONTRACT_ID not configured');
    }

    const state = (await this.simulateRead(poolId, 'get_pool_state', [])) as {
      admin: string;
      operator: string;
      asset_address: string;
      share_token_address: string;
      total_principal: bigint;
      total_shares: bigint;
      paused: boolean;
    };
    const navRaw = (await this.simulateRead(poolId, 'get_nav', [])) as bigint;
    const sharePriceRaw = (await this.simulateRead(
      poolId,
      'get_share_price',
      [],
    )) as bigint;
    const brltDecimals = Number(
      await this.simulateRead(state.asset_address, 'decimals', []),
    );
    const shareDecimals = Number(
      await this.simulateRead(state.share_token_address, 'decimals', []),
    );

    const cashRaw = navRaw - state.total_principal;
    const toScaled = (raw: bigint, decimals: number): Scaled => ({
      raw: raw.toString(),
      value: Number(raw) / 10 ** decimals,
    });

    return {
      poolContractId: poolId,
      brltTokenId: state.asset_address,
      shareTokenId: state.share_token_address,
      admin: state.admin,
      operator: state.operator,
      paused: state.paused,
      brltDecimals,
      shareDecimals,
      nav: toScaled(navRaw, brltDecimals),
      cashBalance: toScaled(cashRaw, brltDecimals),
      totalPrincipal: toScaled(state.total_principal, brltDecimals),
      totalShares: toScaled(state.total_shares, shareDecimals),
      sharePrice: {
        raw: sharePriceRaw.toString(),
        value: Number(sharePriceRaw) / 1e9,
      },
    };
  }

  async getInvestorShares(address: string): Promise<InvestorShares> {
    const poolId = process.env.STELLAR_POOL_CONTRACT_ID;
    if (!poolId) {
      throw new Error('STELLAR_POOL_CONTRACT_ID not configured');
    }

    const state = (await this.simulateRead(poolId, 'get_pool_state', [])) as {
      share_token_address: string;
    };
    const shareDecimals = Number(
      await this.simulateRead(state.share_token_address, 'decimals', []),
    );
    const sharePriceRaw = (await this.simulateRead(
      poolId,
      'get_share_price',
      [],
    )) as bigint;
    const balanceRaw = (await this.simulateRead(
      state.share_token_address,
      'balance',
      [nativeToScVal(address, { type: 'address' })],
    )) as bigint;

    const sharesValue = Number(balanceRaw) / 10 ** shareDecimals;
    const sharePriceValue = Number(sharePriceRaw) / 1e9;

    return {
      address,
      shares: { raw: balanceRaw.toString(), value: sharesValue },
      estimatedValueBrl: sharesValue * sharePriceValue,
    };
  }
```

- [ ] **Step 4: Verificar typecheck**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "stellar.service.spec" || echo "typecheck OK"`
Expected: `typecheck OK` (o único erro restante deve ser o pré-existente em `stellar.service.spec.ts(87)`, filtrado pelo grep).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/shared/blockchain/stellar.service.ts
git commit -m "feat(api): read-only pool status + investor shares from chain"
```

---

### Task 3: Admin service + controller (rotas operator)

**Files:**
- Modify: `apps/api/src/modules/admin/admin.service.ts`
- Modify: `apps/api/src/modules/admin/admin.controller.ts`

- [ ] **Step 1: Adicionar métodos ao `AdminService`**

Inserir antes do `}` final da classe (após `approveTransaction`, linha ~292):

```ts
  getPoolStatus() {
    return this.stellar.getPoolStatus();
  }

  getInvestorShares(address: string) {
    return this.stellar.getInvestorShares(address);
  }
```

- [ ] **Step 2: Adicionar `Query` ao import do controller**

Em `apps/api/src/modules/admin/admin.controller.ts`, no import de `@nestjs/common` (linhas 1-11), adicionar `BadRequestException` e `Query`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
```

- [ ] **Step 3: Adicionar as rotas no `AdminController`**

Inserir antes do `}` final da classe (após `approveTransaction`, linha ~85):

```ts
  @Get('pool/status')
  getPoolStatus(@Req() req: AuthRequest) {
    assertOperator(req);
    return this.service.getPoolStatus();
  }

  @Get('pool/shares')
  getInvestorShares(@Req() req: AuthRequest, @Query('address') address: string) {
    assertOperator(req);
    if (!address || !/^G[A-Z2-7]{55}$/.test(address)) {
      throw new BadRequestException('Endereço Stellar inválido');
    }
    return this.service.getInvestorShares(address);
  }
```

- [ ] **Step 4: Verificar typecheck**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "stellar.service.spec" || echo "typecheck OK"`
Expected: `typecheck OK`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/admin/admin.service.ts apps/api/src/modules/admin/admin.controller.ts
git commit -m "feat(api): operator routes GET /admin/pool/status and /shares"
```

---

### Task 4: Verificação real contra o contrato testnet (sem mock)

**Files:** nenhum (verificação manual com a API rodando).

- [ ] **Step 1: Subir a API**

Run (terminal separado): `cd apps/api && npm run start:dev`
Expected: Nest sobe sem erro; logs de StellarService presentes.

- [ ] **Step 2: Obter um token de operador**

Logar como operador no app (ou usar um JWT de operador existente). Exportar:

```bash
export OP_TOKEN="<jwt-do-operador>"
```

- [ ] **Step 3: Chamar o endpoint de status e ver dados reais**

Run:
```bash
curl -s -H "Authorization: Bearer $OP_TOKEN" http://localhost:3001/v1/admin/pool/status | npx --yes json
```
Expected: JSON com `nav`, `totalShares`, `sharePrice`, `cashBalance`, `totalPrincipal`, `paused`, `brltDecimals`, `shareDecimals`, IDs de contrato — todos com valores numéricos reais (não zero-hardcoded).

- [ ] **Step 4: Conferir contra o contrato via Stellar CLI**

Run:
```bash
stellar contract invoke --id CASSTE2CZFG72SBGCPD7YOXCRQC3WSMDS7QHRN6DKVNEZWVJM3EXXXWG \
  --network testnet --source <SUA_CONTA> -- get_pool_state
stellar contract invoke --id CASSTE2CZFG72SBGCPD7YOXCRQC3WSMDS7QHRN6DKVNEZWVJM3EXXXWG \
  --network testnet --source <SUA_CONTA> -- get_nav
stellar contract invoke --id CASSTE2CZFG72SBGCPD7YOXCRQC3WSMDS7QHRN6DKVNEZWVJM3EXXXWG \
  --network testnet --source <SUA_CONTA> -- get_share_price
```
Expected: os campos `raw` do JSON do endpoint batem exatamente com os valores do CLI. `sharePrice.raw` ÷ 1e9 = `sharePrice.value`. `nav.raw - totalPrincipal.raw = cashBalance.raw`.

- [ ] **Step 5: Verificar busca por investidor**

Run (use um address G... que tenha cotas):
```bash
curl -s -H "Authorization: Bearer $OP_TOKEN" \
  "http://localhost:3001/v1/admin/pool/shares?address=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" | npx --yes json
```
Expected: `shares.raw` bate com `balance` do share token via CLI; `estimatedValueBrl ≈ shares.value * sharePrice.value`. Address inválido (ex. `?address=abc`) → HTTP 400 "Endereço Stellar inválido".

---

### Task 5: Frontend — hooks de API da pool

**Files:**
- Create: `apps/web/src/lib/api/pool.ts`

- [ ] **Step 1: Criar o arquivo de hooks**

```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface Scaled {
  raw: string;
  value: number;
}

export interface PoolStatus {
  poolContractId: string;
  brltTokenId: string;
  shareTokenId: string;
  admin: string;
  operator: string;
  paused: boolean;
  brltDecimals: number;
  shareDecimals: number;
  nav: Scaled;
  cashBalance: Scaled;
  totalPrincipal: Scaled;
  totalShares: Scaled;
  sharePrice: { raw: string; value: number };
}

export interface InvestorShares {
  address: string;
  shares: Scaled;
  estimatedValueBrl: number;
}

export function usePoolStatus(enabled: boolean) {
  return useQuery<PoolStatus>({
    queryKey: ["operator", "pool", "status"],
    queryFn: () => apiFetch<PoolStatus>("/admin/pool/status"),
    staleTime: Infinity,
    enabled,
  });
}

export function useInvestorShares(address: string) {
  return useQuery<InvestorShares>({
    queryKey: ["operator", "pool", "shares", address],
    queryFn: () =>
      apiFetch<InvestorShares>(`/admin/pool/shares?address=${address}`),
    enabled: false,
  });
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "lib/api/pool" || echo "pool.ts OK"`
Expected: `pool.ts OK`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/pool.ts
git commit -m "feat(web): pool status + investor shares api hooks"
```

---

### Task 6: Frontend — painel "Situação da Pool" com dados reais

**Files:**
- Modify: `apps/web/src/app/(operator)/operator/dashboard/page.tsx`

- [ ] **Step 1: Adicionar imports e remover constantes hardcoded de saldo**

No topo do arquivo, adicionar ao import de hooks (após o import de `@/lib/api/admin`, linha 17):

```ts
import { usePoolStatus, useInvestorShares } from "@/lib/api/pool";
```

Remover a linha 31 (`const poolBrltBalance = "0 BRLT";`). Manter `stellarExpertContractBaseUrl` (linha 28). As linhas 29-30 (`poolContractId`, `brltTokenContractId`) podem ficar como fallback dos links, mas os valores reais virão do hook.

- [ ] **Step 2: Adicionar estado e hooks no componente**

Logo após `const activeTab = searchParams.get("tab") || "dashboard";` (linha 37):

```ts
  const poolTabActive = activeTab === "pool-status";
  const { data: poolStatus, isFetching: poolFetching, isError: poolError, refetch: refetchPool } = usePoolStatus(poolTabActive);
  const [investorAddress, setInvestorAddress] = useState("");
  const { data: investorShares, isFetching: sharesFetching, isError: sharesError, refetch: refetchShares } = useInvestorShares(investorAddress.trim());
```

- [ ] **Step 3: Substituir o bloco da aba `pool-status`**

Substituir todo o bloco `{activeTab === "pool-status" && ( ... )}` (linhas ~362-420) por:

```tsx
      {/* Pool Status Tab */}
      {activeTab === "pool-status" && (
        <div className="card" style={{ padding: 24 }}>
          <div className="row between" style={{ marginBottom: 20 }}>
            <div>
              <h3>Situação da pool</h3>
              <p className="t-3" style={{ fontSize: 12, marginTop: 4 }}>Dados lidos diretamente do contrato na Stellar testnet.</p>
            </div>
            <button className="btn btn-ghost btn-sm" disabled={poolFetching} onClick={() => refetchPool()}>
              <Icon name="refresh" size={14} /> {poolFetching ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          {poolError ? (
            <div className="t-3" style={{ padding: 24, textAlign: "center", color: "var(--red)" }}>Falha ao ler o estado da pool on-chain.</div>
          ) : !poolStatus ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <Skeleton style={{ height: 110 }} />
              <Skeleton style={{ height: 110 }} />
              <Skeleton style={{ height: 110 }} />
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
                <MiniKpi label="NAV (patrimônio)" value={fmtBRL(poolStatus.nav.value)} sub="Caixa + principal aplicado" color="#00D4FF" icon="wallet" />
                <MiniKpi label="Total de cotas" value={poolStatus.totalShares.value.toLocaleString("pt-BR")} sub="CBPOOL mintadas" color="#7B2FFF" icon="layers" />
                <MiniKpi label="Preço da cota" value={`${poolStatus.sharePrice.value.toFixed(4)} BRLT`} sub="NAV / total de cotas" color="#00FF94" icon="trending_up" />
                <MiniKpi label="Caixa BRLT" value={fmtBRL(poolStatus.cashBalance.value)} sub="Disponível na pool" color="#00D4FF" icon="dollar" />
                <MiniKpi label="Principal aplicado" value={fmtBRL(poolStatus.totalPrincipal.value)} sub="Em invoices ativas" color="#FFB020" icon="doc" />
                <MiniKpi label="Status" value={poolStatus.paused ? "Pausada" : "Ativa"} sub={poolStatus.paused ? "Operações bloqueadas" : "Operando normalmente"} color={poolStatus.paused ? "#FF5577" : "#00FF94"} icon="shield" />
              </div>

              <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 20, marginBottom: 24 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Cotas por investidor</div>
                <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <input type="text" className="input" placeholder="Endereço Stellar (G...)" value={investorAddress} onChange={(e) => setInvestorAddress(e.target.value)} style={{ flex: 1, minWidth: 280, padding: 10, background: "var(--surface)", border: "1px solid var(--line)", fontFamily: "monospace", fontSize: 13 }} />
                  <button className="btn btn-violet btn-sm" disabled={sharesFetching || investorAddress.trim().length < 56} onClick={() => refetchShares()}>{sharesFetching ? "Buscando..." : "Buscar"}</button>
                </div>
                {sharesError ? (
                  <div className="t-3" style={{ color: "var(--red)", fontSize: 13 }}>Falha ao buscar cotas (endereço válido?).</div>
                ) : investorShares ? (
                  <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>Cotas</div>
                      <div className="kpi num" style={{ fontSize: 24 }}>{investorShares.shares.value.toLocaleString("pt-BR")}</div>
                    </div>
                    <div>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>Valor estimado</div>
                      <div className="kpi num" style={{ fontSize: 24 }}>{fmtBRL(investorShares.estimatedValueBrl)}</div>
                    </div>
                    <a className="btn btn-ghost btn-sm" href={`https://stellar.expert/explorer/testnet/account/${investorShares.address}`} rel="noreferrer" target="_blank" style={{ gridColumn: "1 / -1", justifySelf: "start" }}>Ver no Stellar Expert <Icon name="arrow_right" size={14} /></a>
                  </div>
                ) : null}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 20 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Contrato da Pool</div>
                  <div className="mono" style={{ fontSize: 13, wordBreak: "break-all", marginBottom: 16 }}>{poolStatus.poolContractId}</div>
                  <a className="btn btn-violet btn-sm" href={`${stellarExpertContractBaseUrl}/${poolStatus.poolContractId}`} rel="noreferrer" target="_blank">Ver Pool no Stellar Expert <Icon name="arrow_right" size={14} /></a>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 20 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Token BRLT</div>
                  <div className="mono" style={{ fontSize: 13, wordBreak: "break-all", marginBottom: 16 }}>{poolStatus.brltTokenId}</div>
                  <a className="btn btn-ghost btn-sm" href={`${stellarExpertContractBaseUrl}/${poolStatus.brltTokenId}`} rel="noreferrer" target="_blank">Ver BRLT no Stellar Expert <Icon name="arrow_right" size={14} /></a>
                </div>
                <div style={{ background: "var(--surface)", border: "1px solid var(--line-2)", borderRadius: 8, padding: 20 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Token de cotas (CBPOOL)</div>
                  <div className="mono" style={{ fontSize: 13, wordBreak: "break-all", marginBottom: 16 }}>{poolStatus.shareTokenId}</div>
                  <a className="btn btn-ghost btn-sm" href={`${stellarExpertContractBaseUrl}/${poolStatus.shareTokenId}`} rel="noreferrer" target="_blank">Ver CBPOOL no Stellar Expert <Icon name="arrow_right" size={14} /></a>
                </div>
              </div>
            </>
          )}
        </div>
      )}
```

- [ ] **Step 2.5: Adicionar import do Skeleton**

No topo, junto dos imports de primitives (após linha 5):

```ts
import { Skeleton } from "@/components/primitives/Skeleton";
```

- [ ] **Step 4: Confirmar nomes de Icon existentes**

Run: `cd apps/web && grep -oE '"(refresh|layers|trending_up|dollar|wallet|doc|shield|arrow_right)"' src/components/primitives/Icon.tsx | sort -u`
Expected: cada ícone usado no JSX aparece na lista. Se algum não existir, trocar pelo ícone equivalente disponível em `Icon.tsx` (ex. usar `wallet`/`doc`/`arrow_right` que já são usados no arquivo).

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | grep "operator/dashboard/page" || echo "page OK"`
Expected: `page OK`

- [ ] **Step 6: Verificar no browser (dados reais)**

Subir web (`cd apps/web && npm run dev`) e API, logar como operador, abrir `/operator/dashboard?tab=pool-status`.
Expected: cards mostram NAV/cotas/preço reais (iguais ao Task 4); botão Atualizar refaz a leitura; busca por endereço retorna cotas reais; loading mostra Skeleton; endereço inválido não dispara (botão exige ≥56 chars).

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(operator)/operator/dashboard/page.tsx"
git commit -m "feat(web): live on-chain pool status panel for operator"
```

---

## Self-Review (preenchido)

- **Cobertura do spec:** tipos+interface (T1), leitura on-chain + decimais reais (T2), rotas operator (T3), verificação real sem mock (T4), hooks front (T5), painel com NAV/cotas/preço/caixa/principal/status + busca por investidor + refresh manual (T6). ✔
- **Placeholders:** nenhum `<...>` exceto onde o executor precisa fornecer dado de ambiente real (JWT do operador, address de teste, conta `--source`). Esses são entradas de ambiente, não código a inventar.
- **Consistência de tipos:** `Scaled`/`PoolStatus`/`InvestorShares` idênticos entre `blockchain.interface.ts` (T1) e `pool.ts` (T5); `sharePrice` é `{ raw, value }` nos dois; nomes de campos snake_case do `get_pool_state` (`asset_address`, `share_token_address`, `total_principal`, `total_shares`) usados consistentemente no decode.
