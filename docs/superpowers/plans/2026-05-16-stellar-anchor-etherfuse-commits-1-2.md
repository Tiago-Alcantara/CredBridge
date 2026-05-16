# Stellar Anchor — Etherfuse Integration (Commits 1 & 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document the Etherfuse anchor integration design (commit 1) and port the portable TypeScript anchor-client library from the regional-starter-pack into a CredBridge workspace package (commit 2).

**Architecture:** Commit 1 is documentation only (ADR + STATUS.md update). Commit 2 creates `packages/anchor-client/` — a framework-agnostic TypeScript package that wraps `EtherfuseClient` (BRL on/off-ramp via PIX) and the SEP-10/24/38 helpers. The API app (`apps/api`) will depend on this package in commit 3 — this plan does NOT wire it into NestJS.

**Tech Stack:** TypeScript 5, `@stellar/stellar-sdk ^15` (peer dep), Jest/ts-jest, native `fetch` (Node 18+). Source reference: `https://github.com/ElliotFriend/regional-starter-pack`.

**TESOURO issuer (mainnet + testnet):** `GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4`

---

## File Map

### Commit 1 — docs only
| Action | Path |
|--------|------|
| Create | `documentacao/anchor-etherfuse-integration.md` |
| Modify | `docs/STATUS.md` (add anchor decision to "Decisões fixadas") |

### Commit 2 — new package
| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/anchor-client/package.json` | Package metadata + deps |
| Create | `packages/anchor-client/tsconfig.json` | TypeScript config |
| Create | `packages/anchor-client/jest.config.js` | Jest config |
| Create | `packages/anchor-client/src/types.ts` | Shared `Anchor` interface + all supporting types (ported verbatim) |
| Create | `packages/anchor-client/src/etherfuse/types.ts` | Etherfuse API request/response types (ported verbatim) |
| Create | `packages/anchor-client/src/etherfuse/client.ts` | `EtherfuseClient` implementing `Anchor` (ported, minor adaptation) |
| Create | `packages/anchor-client/src/etherfuse/index.ts` | Re-exports `EtherfuseClient` |
| Create | `packages/anchor-client/src/sep/sep10.ts` | SEP-10 Web Auth helpers (ported verbatim) |
| Create | `packages/anchor-client/src/sep/sep24.ts` | SEP-24 interactive deposit/withdraw (ported verbatim) |
| Create | `packages/anchor-client/src/sep/sep38.ts` | SEP-38 quotes/RFQ (ported verbatim) |
| Create | `packages/anchor-client/src/index.ts` | Public API barrel export |
| Create | `packages/anchor-client/src/__tests__/etherfuse-client.test.ts` | Unit tests (shape, currencies, tokens) |
| Create | `packages/anchor-client/src/__tests__/sep38-utils.test.ts` | Unit tests for SEP-38 asset ID helpers |

---

## COMMIT 1 — `docs: anchor integration design — Etherfuse SEP flow for BRL on/off-ramp`

### Task 1: Update STATUS.md with anchor decision

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Add anchor decision to "Decisões fixadas" section**

Open `docs/STATUS.md`. Find the block that starts with `## Decisões fixadas`. Add this entry after the existing items:

```markdown
- **Stellar Anchor:** Etherfuse selecionado para on/off-ramp BRL↔TESOURO via PIX.
  Token: `TESOURO` (issuer `GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4`).
  SEPs: SEP-38 (quotes), SEP-10 (auth), SEP-24 (interactive flows).
  PIX/Brasil está em sandbox — não usar em produção ainda.
```

Also update the "Blockchain (Stellar)" row in the visão geral table from `5%` to `15%`.

---

### Task 2: Create ADR document

**Files:**
- Create: `documentacao/anchor-etherfuse-integration.md`

- [ ] **Step 1: Create the ADR file with full content**

```markdown
---
title: Integração Anchor Stellar — Etherfuse
tags:
  - ADR
  - stellar
  - anchor
  - etherfuse
  - sep
  - blockchain
date: 2026-05-16
status: aceito
---

# ADR: Integração Anchor Stellar — Etherfuse

## Contexto

O CredBridge usa Stellar para tokenizar NF-es (Soroban) e liquidar pagamentos
entre PMEs e investidores. Até agora os pagamentos on-chain usam XLM nativo,
o que cria fricção: usuários precisam comprar XLM antes de operar.

Para remover essa fricção e manter os pagamentos em BRL, precisamos de um
**Stellar Anchor** que faça a ponte fiat ↔ on-chain via PIX.

## Decisão

Usar **Etherfuse** como anchor para on/off-ramp de BRL.

### Por quê Etherfuse?

- Único provider no regional-starter-pack com suporte explícito a BRL + PIX
- Token TESOURO lastreado 1:1 em BRL (títulos do Tesouro Nacional)
- Suporte aos 3 SEPs necessários: SEP-38, SEP-10, SEP-24
- API bem documentada com sandbox
- Issuer verificado: `GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4`

### Caveat

Suporte PIX/Brasil está em **sandbox apenas**. Não usar em produção até
Etherfuse documentar e estabilizar o endpoint para BRL.

## Token TESOURO

```
Asset code:   TESOURO
Issuer:       GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4
Network:      Testnet (dev) / Mainnet (prod)
Rail:         PIX (Brasil)
Paridade:     1 TESOURO = 1 BRL
```

Wallets custodiais precisam estabelecer uma **trustline** para TESOURO antes
de poder receber o token. Isso é feito no `createCustodialWallet` via
`Operation.changeTrust`.

## SEPs utilizados

| SEP | Finalidade | Quando usar |
|-----|-----------|-------------|
| SEP-38 | Cotação BRL ↔ TESOURO | Antes de iniciar on-ramp ou off-ramp |
| SEP-10 | Autenticação da wallet Stellar | Ao conectar wallet do usuário ao anchor |
| SEP-24 | Fluxo interativo de depósito/saque | UI de on-ramp (investor) e off-ramp (PME) |

## Fluxo: Investor On-Ramp (BRL → TESOURO)

```
1. Investor abre tela de depósito no CredBridge
2. Frontend chama POST /v1/anchor/onramp/quote  (SEP-38)
   └─ Recebe: taxa de câmbio, fee, expiração
3. Investor confirma valor
4. Frontend chama POST /v1/anchor/onramp/start  (SEP-24 deposit)
   └─ Recebe: interactiveUrl (iframe Etherfuse)
5. Investor completa KYC + PIX dentro do iframe Etherfuse
6. Etherfuse credita TESOURO na wallet Stellar do investor
7. Investor usa TESOURO para comprar recebível (chargeInvestor)
```

## Fluxo: PME Off-Ramp (TESOURO → BRL)

```
1. Liquidação acontece: platform envia TESOURO para wallet PME (payPme)
2. PME vê saldo TESOURO no dashboard
3. PME abre tela de saque
4. Frontend chama POST /v1/anchor/offramp/quote  (SEP-38)
5. PME confirma
6. Frontend chama POST /v1/anchor/offramp/start  (SEP-24 withdraw)
   └─ Recebe: interactiveUrl (iframe Etherfuse)
7. PME informa chave PIX dentro do iframe
8. Etherfuse recebe TESOURO, envia BRL via PIX para PME
```

## O que muda no fluxo existente

| Componente | Antes | Depois |
|-----------|-------|--------|
| `payPme` — asset | `Asset.native()` (XLM) | `new Asset('TESOURO', ISSUER)` |
| `chargeInvestor` — asset | `Asset.native()` (XLM) | `new Asset('TESOURO', ISSUER)` |
| `createCustodialWallet` | cria + funda via Friendbot | cria + funda + adiciona trustline TESOURO |
| `BlockchainInterface` | `amountXlm: number` | `amountBrl: number` |
| Soroban `tokenizeNfe` | inalterado | inalterado |
| `AnchorModule` | não existe | novo módulo NestJS (commit 3) |

## Referências

- [regional-starter-pack](https://github.com/ElliotFriend/regional-starter-pack)
- [Etherfuse API Docs](https://docs.etherfuse.com)
- [SEP-10 spec](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md)
- [SEP-24 spec](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md)
- [SEP-38 spec](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md)
```

---

### Task 3: Commit 1

- [ ] **Step 1: Stage and commit**

```bash
git add documentacao/anchor-etherfuse-integration.md docs/STATUS.md
git commit -m "docs: anchor integration design — Etherfuse SEP flow for BRL on/off-ramp"
```

---

## COMMIT 2 — `feat: port anchor-client library from regional-starter-pack`

### Task 4: Create package scaffold

**Files:**
- Create: `packages/anchor-client/package.json`
- Create: `packages/anchor-client/tsconfig.json`
- Create: `packages/anchor-client/jest.config.js`

- [ ] **Step 1: Create `packages/anchor-client/package.json`**

```json
{
  "name": "@credbridge/anchor-client",
  "version": "0.0.1",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest"
  },
  "peerDependencies": {
    "@stellar/stellar-sdk": "^15.0.0"
  },
  "devDependencies": {
    "@stellar/stellar-sdk": "^15.1.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.0.0",
    "jest": "^30.0.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.7.3"
  }
}
```

- [ ] **Step 2: Create `packages/anchor-client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/__tests__/**/*"]
}
```

- [ ] **Step 3: Create `packages/anchor-client/jest.config.js`**

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@stellar/stellar-sdk$': '<rootDir>/node_modules/@stellar/stellar-sdk',
  },
};
```

- [ ] **Step 4: Install deps for the package**

```bash
cd packages/anchor-client && npm install
```

Expected: `node_modules/` created with `@stellar/stellar-sdk`, `jest`, `ts-jest`.

---

### Task 5: Write failing tests first (TDD)

**Files:**
- Create: `packages/anchor-client/src/__tests__/etherfuse-client.test.ts`
- Create: `packages/anchor-client/src/__tests__/sep38-utils.test.ts`

These tests will fail until the source files are ported in Tasks 6–9.

- [ ] **Step 1: Create `packages/anchor-client/src/__tests__/etherfuse-client.test.ts`**

```typescript
import { EtherfuseClient } from '../etherfuse';
import type { Anchor } from '../types';

const TESOURO_ISSUER = 'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4';

describe('EtherfuseClient', () => {
  let client: Anchor;

  beforeEach(() => {
    client = new EtherfuseClient({ apiKey: 'test-key' });
  });

  it('exposes name "etherfuse"', () => {
    expect(client.name).toBe('etherfuse');
  });

  it('supports BRL currency', () => {
    expect(client.supportedCurrencies).toContain('BRL');
  });

  it('supports pix rail', () => {
    expect(client.supportedRails).toContain('pix');
  });

  it('has TESOURO token with correct issuer', () => {
    const tesouro = client.supportedTokens.find((t) => t.symbol === 'TESOURO');
    expect(tesouro).toBeDefined();
    expect(tesouro!.issuer).toBe(TESOURO_ISSUER);
  });

  it('satisfies the Anchor interface (required methods present)', () => {
    expect(typeof client.createCustomer).toBe('function');
    expect(typeof client.getCustomer).toBe('function');
    expect(typeof client.getQuote).toBe('function');
    expect(typeof client.createOnRamp).toBe('function');
    expect(typeof client.createOffRamp).toBe('function');
    expect(typeof client.getKycStatus).toBe('function');
    expect(typeof client.getFiatAccounts).toBe('function');
  });
});
```

- [ ] **Step 2: Create `packages/anchor-client/src/__tests__/sep38-utils.test.ts`**

```typescript
import { stellarAssetId, fiatAssetId, parseAssetId } from '../sep/sep38';

const ISSUER = 'GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4';

describe('SEP-38 asset ID helpers', () => {
  it('stellarAssetId formats correctly for custom asset', () => {
    const id = stellarAssetId('TESOURO', ISSUER);
    expect(id).toBe(`stellar:TESOURO:${ISSUER}`);
  });

  it('fiatAssetId formats correctly', () => {
    const id = fiatAssetId('BRL');
    expect(id).toBe('iso4217:BRL');
  });

  it('parseAssetId returns type and code', () => {
    const result = parseAssetId(`stellar:TESOURO:${ISSUER}`);
    expect(result.type).toBe('stellar');
    expect(result.code).toBe('TESOURO');
    expect(result.issuer).toBe(ISSUER);
  });

  it('parseAssetId handles fiat', () => {
    const result = parseAssetId('iso4217:BRL');
    expect(result.type).toBe('iso4217');
    expect(result.code).toBe('BRL');
    expect(result.issuer).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests — verify they FAIL**

```bash
cd packages/anchor-client && npm test
```

Expected: `Cannot find module '../etherfuse'` and `Cannot find module '../sep/sep38'` — this is correct, the source doesn't exist yet.

---

### Task 6: Port `src/types.ts`

**Files:**
- Create: `packages/anchor-client/src/types.ts`

- [ ] **Step 1: Fetch and copy the types file verbatim**

Go to `https://raw.githubusercontent.com/ElliotFriend/regional-starter-pack/main/src/lib/anchors/types.ts` and copy the entire content into `packages/anchor-client/src/types.ts`.

The file defines: `KycStatus`, `TransactionStatus`, `Customer`, `Quote`, `PaymentInstructions` (including `PixPaymentInstructions`), `FiatAccountInput` (including `PixFiatAccountInput`), `OnRampTransaction`, `OffRampTransaction`, `Anchor` interface, `AnchorError` class, and all input/output types.

**Do not modify anything.** The file is pure TypeScript with no framework dependencies.

---

### Task 7: Port `src/etherfuse/types.ts`

**Files:**
- Create: `packages/anchor-client/src/etherfuse/types.ts`

- [ ] **Step 1: Fetch and copy verbatim**

Go to `https://raw.githubusercontent.com/ElliotFriend/regional-starter-pack/main/src/lib/anchors/etherfuse/types.ts` and copy entire content into `packages/anchor-client/src/etherfuse/types.ts`.

**Do not modify anything.** Contains Etherfuse-specific API types only.

---

### Task 8: Port `src/etherfuse/client.ts` (with one adaptation)

**Files:**
- Create: `packages/anchor-client/src/etherfuse/client.ts`

- [ ] **Step 1: Fetch source**

Go to `https://raw.githubusercontent.com/ElliotFriend/regional-starter-pack/main/src/lib/anchors/etherfuse/client.ts` and copy entire content into `packages/anchor-client/src/etherfuse/client.ts`.

- [ ] **Step 2: Fix the import path for types**

The original file imports from relative paths that match the SvelteKit structure. Find any import that looks like:

```typescript
import type { Anchor, ... } from '../types.js';
```

Change `.js` extension to no extension (CommonJS resolution):

```typescript
import type { Anchor, ... } from '../types';
```

Do the same for `./types.js` → `./types`.

- [ ] **Step 3: Verify no Svelte/SvelteKit imports exist**

Run:

```bash
grep -n "svelte\|SvelteKit\|\$lib\|\$app" packages/anchor-client/src/etherfuse/client.ts
```

Expected: no output. If any found, remove those lines — the client is described as framework-agnostic.

---

### Task 9: Create `src/etherfuse/index.ts`

**Files:**
- Create: `packages/anchor-client/src/etherfuse/index.ts`

- [ ] **Step 1: Create the file**

```typescript
export { EtherfuseClient } from './client';
export type * from './types';
```

---

### Task 10: Port `src/sep/` files

**Files:**
- Create: `packages/anchor-client/src/sep/sep10.ts`
- Create: `packages/anchor-client/src/sep/sep24.ts`
- Create: `packages/anchor-client/src/sep/sep38.ts`

- [ ] **Step 1: Fetch and copy `sep10.ts` verbatim**

`https://raw.githubusercontent.com/ElliotFriend/regional-starter-pack/main/src/lib/anchors/sep/sep10.ts`
→ `packages/anchor-client/src/sep/sep10.ts`

- [ ] **Step 2: Fetch and copy `sep24.ts` verbatim**

`https://raw.githubusercontent.com/ElliotFriend/regional-starter-pack/main/src/lib/anchors/sep/sep24.ts`
→ `packages/anchor-client/src/sep/sep24.ts`

- [ ] **Step 3: Fetch and copy `sep38.ts` verbatim**

`https://raw.githubusercontent.com/ElliotFriend/regional-starter-pack/main/src/lib/anchors/sep/sep38.ts`
→ `packages/anchor-client/src/sep/sep38.ts`

- [ ] **Step 4: Fix `.js` import extensions in all three files**

```bash
grep -rn "\.js'" packages/anchor-client/src/sep/
```

Replace any `from '...something.js'` → `from '...something'` in all three files.

---

### Task 11: Create public API barrel export

**Files:**
- Create: `packages/anchor-client/src/index.ts`

- [ ] **Step 1: Create `packages/anchor-client/src/index.ts`**

```typescript
export * from './types';
export { EtherfuseClient } from './etherfuse';
export type * from './etherfuse/types';
export * as sep10 from './sep/sep10';
export * as sep24 from './sep/sep24';
export * as sep38 from './sep/sep38';
```

---

### Task 12: Run tests — verify they PASS

- [ ] **Step 1: Run tests**

```bash
cd packages/anchor-client && npm test
```

Expected output:
```
PASS src/__tests__/etherfuse-client.test.ts
  EtherfuseClient
    ✓ exposes name "etherfuse"
    ✓ supports BRL currency
    ✓ supports pix rail
    ✓ has TESOURO token with correct issuer
    ✓ satisfies the Anchor interface (required methods present)

PASS src/__tests__/sep38-utils.test.ts
  SEP-38 asset ID helpers
    ✓ stellarAssetId formats correctly for custom asset
    ✓ fiatAssetId formats correctly
    ✓ parseAssetId returns type and code
    ✓ parseAssetId handles fiat

Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
```

If tests fail: check import paths in client.ts and sep38.ts — most likely a `.js` extension issue or a type mismatch between the ported files.

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd packages/anchor-client && npm run build
```

Expected: `dist/` created with `.js` + `.d.ts` files, zero type errors.

---

### Task 13: Commit 2

- [ ] **Step 1: Stage and commit**

```bash
git add packages/anchor-client/
git commit -m "feat: port anchor-client library from regional-starter-pack"
```

---

## Self-Review

**Spec coverage:**
- [x] Etherfuse chosen as anchor provider — documented in ADR (Task 2)
- [x] BRL + PIX support confirmed — ADR + test `supportedCurrencies`/`supportedRails`
- [x] TESOURO token + issuer documented — ADR + test `supportedTokens`
- [x] On-ramp investor flow — ADR
- [x] Off-ramp PME flow — ADR
- [x] SEPs used (38, 10, 24) — ADR
- [x] What changes in existing code — ADR table
- [x] Package created as workspace package — Task 4
- [x] All 6 source files ported — Tasks 6–10
- [x] Tests verify contract shape — Tasks 5, 12
- [x] TypeScript compiles — Task 12 step 2

**Out of scope (commit 3):**
- NestJS `AnchorModule` wiring
- Trustline addition to `createCustodialWallet`
- `amountXlm` → `amountBrl` rename in `BlockchainInterface`
- Frontend SEP-24 iframe UI
- `.env` variables for `ETHERFUSE_API_KEY`, `ETHERFUSE_BASE_URL`
