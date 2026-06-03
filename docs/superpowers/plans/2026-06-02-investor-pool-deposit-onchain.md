# Investor Pool Deposit On-Chain (Privy Client-Side Signing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the investor's "Assinar e Emitir Cotas" step perform a real on-chain Soroban deposit (BRLT `approve` + Pool `deposit`) signed by the investor's Privy embedded wallet, replacing the current mock that fabricates a `Math.random()` transaction hash and never moves any tokens.

**Architecture:** All Soroban transaction building, simulation, assembly, and submission stays on the NestJS backend (it already holds `@stellar/stellar-sdk`, RPC config, and contract IDs). The backend builds each unsigned transaction with the investor's Privy address as source account, simulates+assembles it, and returns the transaction hash to sign. The Next.js client signs that 32-byte hash with Privy `signRawHash` (the only place the investor key exists) and posts the signature back. The backend attaches the decorated signature and submits via Stellar RPC. Because the investor is both the source account and the only `require_auth` party, the envelope signature satisfies authorization — no separate Soroban auth-entry signing is needed. The deposit-stage submission is the sole place that flips the transaction to `COMPLETED` with the RPC-returned hash, so the client can never forge it.

**Tech Stack:** NestJS 11, `@stellar/stellar-sdk` (RPC `Server`, `TransactionBuilder`, `Contract`, `assembleTransaction`, `Keypair`, `xdr.DecoratedSignature`), Prisma 7, Next.js 16 App Router, React 19, `@privy-io/react-auth` + `@privy-io/react-auth/extended-chains` (`useSignRawHash`), TanStack Query, Jest (API), Vitest (web).

**Reference Specs:** `docs/superpowers/specs/2026-05-20-smart-account-financial-auth-design.md`, `docs/superpowers/plans/2026-05-23-privy-auth-stellar-wallet.md`

---

## Background: What Is Broken Today

- `apps/web/src/components/investor/FinalizeAssignmentModal.tsx:35-78` (`handleFinalize`) calls `authorize()` twice (a WebAuthn/raw-hash authorization gate that signs a meaningless challenge), waits on two `setTimeout` calls, then fabricates `const stellarTxHash = "t" + Math.random()...` and posts it to the API. No tokens move.
- `apps/api/src/modules/investments/investments.service.ts:163-200` (`finalizeDeposit`) trusts the client-supplied `txHash`, sets `status: 'COMPLETED'`, and writes an audit log. No blockchain call.
- `apps/api/src/shared/blockchain/stellar.service.ts:727-822` (`depositToPool`) is dead code: nothing calls it, it re-mints BRLT (redundant — see next bullet), and it requires a server-held custodial keypair (`stellar.service.ts:752-756`) which is `null` for Privy wallets (`stellar.service.ts:646-647`), so it would throw for every Privy investor.
- The operator's approval (`apps/api/src/modules/admin/admin.service.ts:241-259`) already mints BRLT to `user.privyStellarWalletAddress` and sets the transaction to `APPROVED`. So at finalize time the BRLT already sits in the investor's Privy wallet; finalize must only `approve` the Pool as spender and `deposit` — it must NOT mint again.

## Target Flow

```text
Transaction status = APPROVED (operator already minted BRLT to investor Privy wallet)
  -> Client requests build of APPROVE tx        POST /investments/deposit/:id/onchain/build  { stage: "approve" }
  -> Backend builds+simulates+assembles approve(investor, pool, amount, expLedger), returns { xdr, hashToSign, signerPublicKey }
  -> Client signs hashToSign via Privy signRawHash
  -> Client submits signature                   POST /investments/deposit/:id/onchain/submit { stage: "approve", xdr, signature }
  -> Backend attaches sig, submits via RPC, waits SUCCESS, returns { hash }
  -> Client requests build of DEPOSIT tx         POST /investments/deposit/:id/onchain/build  { stage: "deposit" }
  -> Backend builds+simulates+assembles deposit(investor, amount), returns { xdr, hashToSign, signerPublicKey }
  -> Client signs hashToSign via Privy signRawHash
  -> Client submits signature                   POST /investments/deposit/:id/onchain/submit { stage: "deposit", xdr, signature }
  -> Backend attaches sig, submits, waits SUCCESS, sets transaction COMPLETED + real txHash + audit, returns { hash, status: "COMPLETED" }
  -> Client shows success with real hash
```

## File Structure

**Backend (NestJS API):**
- Modify `apps/api/src/shared/blockchain/stellar.service.ts` — add three methods: `buildApproveTx`, `buildDepositTx`, `submitSignedTx`. Keep the existing `depositToPool` for the legacy custodial path but stop relying on it for Privy.
- Modify `apps/api/src/shared/blockchain/blockchain.interface.ts` — declare the three new methods on `BlockchainService`.
- Modify `apps/api/src/shared/blockchain/blockchain.mock.ts` (if present) — implement the three methods for the mock provider.
- Modify `apps/api/src/modules/investments/investments.service.ts` — add `buildDepositStage` and `submitDepositStage`; harden `finalizeDeposit` so it is no longer the trust boundary.
- Modify `apps/api/src/modules/investments/investments.controller.ts` — add `POST /investments/deposit/:id/onchain/build` and `POST /investments/deposit/:id/onchain/submit`.
- Create `apps/api/src/modules/investments/dto/onchain-deposit.dto.ts` — DTOs for build/submit.
- Test `apps/api/src/modules/investments/investments.service.spec.ts` — unit tests for the new service methods.

**Frontend (Next.js web):**
- Modify `apps/web/src/lib/api/investments.ts` — add `useBuildDepositStage` / `useSubmitDepositStage` (or plain async fns) hitting the new endpoints.
- Create `apps/web/src/lib/stellar/sign-deposit.ts` — orchestrator `runOnChainDeposit({ transactionId, privyAddress, signRawHash, onStage })` that loops the two stages.
- Modify `apps/web/src/components/investor/FinalizeAssignmentModal.tsx` — replace the mock body of `handleFinalize` with the real orchestrator; resolve the Privy address the same way `useFinancialAuthorization` does.
- Test `apps/web/src/components/investor/FinalizeAssignmentModal.spec.tsx` — verify no fabricated hash, real flow invoked, error surfaced.

## Contract Method Signatures (confirmed from `depositToPool`, `stellar.service.ts:786-816`)

- BRLT (SEP-41) `approve(from: Address, spender: Address, amount: i128, expiration_ledger: u32)`
- Pool `deposit(from: Address, amount: i128)`
- Amount scaling: `BigInt(Math.round(amountBrl * 10_000_000))` (7 decimals).
- `expiration_ledger`: current ledger + 100000 (mirror existing `liveUntilLedger`).

---

## Task 1: Declare the three new methods on the blockchain interface

**Files:**
- Modify: `apps/api/src/shared/blockchain/blockchain.interface.ts`

- [ ] **Step 1: Add the method signatures to the `BlockchainService` interface**

Add these members (match the existing interface style — promise-returning methods):

```typescript
export interface UnsignedSorobanTx {
  /** Base64 transaction envelope XDR, simulated + assembled, unsigned. */
  xdr: string;
  /** Hex-encoded 32-byte transaction hash the wallet must sign. */
  hashToSign: string;
  /** Stellar public key (G...) expected to provide the signature. */
  signerPublicKey: string;
}

export interface BlockchainService {
  // ...existing members unchanged...

  /** Build the BRLT approve(investor -> pool) tx, source = investor Privy address. */
  buildApproveTx(investorAddress: string, amountBrl: number): Promise<UnsignedSorobanTx>;

  /** Build the Pool deposit(investor, amount) tx, source = investor Privy address. */
  buildDepositTx(investorAddress: string, amountBrl: number): Promise<UnsignedSorobanTx>;

  /** Attach a Privy ed25519 signature to an unsigned XDR and submit via RPC; resolves to the confirmed tx hash. */
  submitSignedTx(input: {
    xdr: string;
    signerPublicKey: string;
    signatureHex: string;
  }): Promise<string>;
}
```

- [ ] **Step 2: Build the API project to confirm the interface compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: errors ONLY of the form "Property 'buildApproveTx' is missing in type 'StellarService'" / mock — confirms the interface changed and implementors must follow. (Type errors are expected here; they get resolved in Tasks 2-3.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/shared/blockchain/blockchain.interface.ts
git commit -m "feat(blockchain): declare buildApproveTx/buildDepositTx/submitSignedTx on interface"
```

---

## Task 2: Implement build + submit on StellarService

**Files:**
- Modify: `apps/api/src/shared/blockchain/stellar.service.ts`

Note the existing imports at the top of the file already include the stellar-sdk symbols used elsewhere (`nativeToScVal`, `rpc`, `TransactionBuilder`, `Contract`, `BASE_FEE`, `Networks`/`networkPassphrase`, `Keypair`, `xdr`). If any of `Keypair` or `xdr` are not yet imported, add them to the existing `import * as StellarSdk` / named import block. Verify against the file's current import style and follow it (do not introduce a second import style).

- [ ] **Step 1: Write a failing unit test for `buildApproveTx`**

Add to `apps/api/src/shared/blockchain/stellar.service.spec.ts` (create the file if it does not exist, following the project's Jest setup). This test verifies the method returns a hash to sign derived from the assembled transaction and uses the investor as source.

```typescript
import { StellarService } from './stellar.service';

describe('StellarService.buildApproveTx', () => {
  it('returns xdr + hashToSign + signerPublicKey with investor as source', async () => {
    const service = new StellarService(/* inject mocked PrismaService */ {} as any);
    // Arrange: stub the private rpc server + horizon used inside the method.
    const fakeAccount = { accountId: () => 'GINVESTOR', sequenceNumber: () => '100' };
    (service as any).server = {
      getAccount: jest.fn().mockResolvedValue(fakeAccount),
      simulateTransaction: jest.fn().mockResolvedValue({ /* minimal success sim */ }),
    };
    (service as any).horizon = {
      ledgers: () => ({ order: () => ({ limit: () => ({ call: async () => ({ records: [{ sequence: 3000000 }] }) }) }) }),
    };
    process.env.STELLAR_POOL_CONTRACT_ID = 'CPOOL...';
    process.env.STELLAR_BRLT_TOKEN_ID = 'CBRLT...';

    // NOTE: full assembleTransaction needs a richer simulation stub; if mocking the
    // SDK assemble path is impractical at unit level, mark this test as the integration
    // boundary and assert shape via a thin seam method `assembleAndHash(tx)` instead.
    const result = await service.buildApproveTx('GINVESTOR', 100);

    expect(result.signerPublicKey).toBe('GINVESTOR');
    expect(result.hashToSign).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof result.xdr).toBe('string');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && npx jest stellar.service.spec.ts -t buildApproveTx`
Expected: FAIL — `service.buildApproveTx is not a function`.

- [ ] **Step 3: Implement `buildApproveTx`, `buildDepositTx`, and a shared private helper**

Add these methods to `StellarService`. The shared helper `buildAndAssemble` builds a single-operation Soroban contract-call transaction with the investor as source, simulates, assembles, and returns the unsigned result. Place near `depositToPool`.

```typescript
private async buildAndAssemble(
  investorAddress: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[],
): Promise<UnsignedSorobanTx> {
  if (!this.server) {
    throw new Error('Stellar RPC server not configured');
  }
  const account = await this.server.getAccount(investorAddress);
  const contract = new StellarSdk.Contract(contractId);

  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: this.networkPassphrase, // existing field used elsewhere in this file
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await this.server.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed for ${method}: ${sim.error}`);
  }
  tx = StellarSdk.rpc.assembleTransaction(tx, sim).build();

  return {
    xdr: tx.toXDR(),
    hashToSign: tx.hash().toString('hex'),
    signerPublicKey: investorAddress,
  };
}

async buildApproveTx(
  investorAddress: string,
  amountBrl: number,
): Promise<UnsignedSorobanTx> {
  const poolContractId = process.env.STELLAR_POOL_CONTRACT_ID;
  const brltContractId = process.env.STELLAR_BRLT_TOKEN_ID;
  if (!poolContractId || !brltContractId) {
    throw new Error('STELLAR_POOL_CONTRACT_ID / STELLAR_BRLT_TOKEN_ID not configured');
  }
  const amountInStroops = BigInt(Math.round(amountBrl * 10_000_000));

  const latestLedgers = await this.horizon.ledgers().order('desc').limit(1).call();
  const currentLedger = latestLedgers.records[0]?.sequence ?? 3000000;
  const liveUntilLedger = currentLedger + 100000;

  this.logger.log(`buildApproveTx — investor ${investorAddress}, amount ${amountBrl}`);
  return this.buildAndAssemble(investorAddress, brltContractId, 'approve', [
    StellarSdk.nativeToScVal(investorAddress, { type: 'address' }),
    StellarSdk.nativeToScVal(poolContractId, { type: 'address' }),
    StellarSdk.nativeToScVal(amountInStroops, { type: 'i128' }),
    StellarSdk.nativeToScVal(liveUntilLedger, { type: 'u32' }),
  ]);
}

async buildDepositTx(
  investorAddress: string,
  amountBrl: number,
): Promise<UnsignedSorobanTx> {
  const poolContractId = process.env.STELLAR_POOL_CONTRACT_ID;
  if (!poolContractId) {
    throw new Error('STELLAR_POOL_CONTRACT_ID not configured');
  }
  const amountInStroops = BigInt(Math.round(amountBrl * 10_000_000));

  this.logger.log(`buildDepositTx — investor ${investorAddress}, amount ${amountBrl}`);
  return this.buildAndAssemble(investorAddress, poolContractId, 'deposit', [
    StellarSdk.nativeToScVal(investorAddress, { type: 'address' }),
    StellarSdk.nativeToScVal(amountInStroops, { type: 'i128' }),
  ]);
}
```

Adjust `this.networkPassphrase` / `this.horizon` / `this.server` to the exact field names already used in the file (grep first; the file already references `this.server`, `this.horizon`, and a network passphrase when building txs elsewhere — reuse those identifiers verbatim).

- [ ] **Step 4: Run the build test to verify it passes**

Run: `cd apps/api && npx jest stellar.service.spec.ts -t buildApproveTx`
Expected: PASS (or, if the SDK assemble path cannot be unit-mocked cleanly, the test asserts shape via the documented seam — keep the assertion on `signerPublicKey` and the hex `hashToSign`).

- [ ] **Step 5: Write a failing test for `submitSignedTx`**

```typescript
describe('StellarService.submitSignedTx', () => {
  it('attaches the decorated signature and returns the confirmed hash', async () => {
    const service = new StellarService({} as any);
    const sent = { status: 'PENDING', hash: 'abc123' };
    (service as any).server = {
      sendTransaction: jest.fn().mockResolvedValue(sent),
      getTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
    };
    // Build a real unsigned tx XDR for a no-op so fromXDR succeeds, or stub TransactionBuilder.fromXDR.
    const hash = await service.submitSignedTx({
      xdr: '<valid-unsigned-xdr>',
      signerPublicKey: 'GINVESTOR...',
      signatureHex: '00'.repeat(64),
    });
    expect(hash).toBe('abc123');
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd apps/api && npx jest stellar.service.spec.ts -t submitSignedTx`
Expected: FAIL — `service.submitSignedTx is not a function`.

- [ ] **Step 7: Implement `submitSignedTx`**

```typescript
async submitSignedTx(input: {
  xdr: string;
  signerPublicKey: string;
  signatureHex: string;
}): Promise<string> {
  if (!this.server) {
    throw new Error('Stellar RPC server not configured');
  }
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    input.xdr,
    this.networkPassphrase,
  ) as StellarSdk.Transaction;

  const keypair = StellarSdk.Keypair.fromPublicKey(input.signerPublicKey);
  const signature = Buffer.from(input.signatureHex.replace(/^0x/, ''), 'hex');

  // Defense in depth: verify the signature matches the tx hash before submitting.
  if (!keypair.verify(tx.hash(), signature)) {
    throw new Error('Signature does not match transaction hash');
  }

  tx.addDecoratedSignature(
    new StellarSdk.xdr.DecoratedSignature({
      hint: keypair.signatureHint(),
      signature,
    }),
  );

  const sendResult = await this.server.sendTransaction(tx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`sendTransaction failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  let getResult = await this.server.getTransaction(sendResult.hash);
  let attempts = 0;
  while (getResult.status === 'NOT_FOUND' && attempts < 30) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    getResult = await this.server.getTransaction(sendResult.hash);
    attempts += 1;
  }

  if (getResult.status !== 'SUCCESS') {
    throw new Error(`Transaction did not succeed: ${getResult.status}`);
  }
  this.logger.log(`submitSignedTx confirmed — hash ${sendResult.hash}`);
  return sendResult.hash;
}
```

- [ ] **Step 8: Run the submit test to verify it passes**

Run: `cd apps/api && npx jest stellar.service.spec.ts -t submitSignedTx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/shared/blockchain/stellar.service.ts apps/api/src/shared/blockchain/stellar.service.spec.ts
git commit -m "feat(blockchain): build/submit unsigned Soroban approve+deposit txs for Privy signing"
```

---

## Task 3: Implement the three methods on the mock blockchain provider

**Files:**
- Modify: `apps/api/src/shared/blockchain/blockchain.mock.ts` (confirm exact filename via `ls apps/api/src/shared/blockchain/`; the project injects `BLOCKCHAIN_SERVICE` and a mock exists for tests/dev)

- [ ] **Step 1: Add deterministic mock implementations**

```typescript
async buildApproveTx(investorAddress: string, amountBrl: number): Promise<UnsignedSorobanTx> {
  return {
    xdr: `mock-approve-xdr:${investorAddress}:${amountBrl}`,
    hashToSign: 'a'.repeat(64),
    signerPublicKey: investorAddress,
  };
}

async buildDepositTx(investorAddress: string, amountBrl: number): Promise<UnsignedSorobanTx> {
  return {
    xdr: `mock-deposit-xdr:${investorAddress}:${amountBrl}`,
    hashToSign: 'b'.repeat(64),
    signerPublicKey: investorAddress,
  };
}

async submitSignedTx(input: { xdr: string; signerPublicKey: string; signatureHex: string }): Promise<string> {
  return `stellar-mock-submit-${Date.now()}`;
}
```

- [ ] **Step 2: Build to confirm no missing-member errors remain**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS (no "Property ... is missing in type" errors).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/shared/blockchain/blockchain.mock.ts
git commit -m "feat(blockchain): mock build/submit Soroban tx methods"
```

---

## Task 4: Add DTOs and service orchestration in InvestmentsService

**Files:**
- Create: `apps/api/src/modules/investments/dto/onchain-deposit.dto.ts`
- Modify: `apps/api/src/modules/investments/investments.service.ts`
- Test: `apps/api/src/modules/investments/investments.service.spec.ts`

- [ ] **Step 1: Create the DTOs**

```typescript
import { IsIn, IsString, MinLength } from 'class-validator';

export type DepositStage = 'approve' | 'deposit';

export class BuildDepositStageDto {
  @IsIn(['approve', 'deposit'])
  stage: DepositStage;
}

export class SubmitDepositStageDto {
  @IsIn(['approve', 'deposit'])
  stage: DepositStage;

  @IsString()
  @MinLength(1)
  xdr: string;

  @IsString()
  @MinLength(1)
  signature: string; // hex, with or without 0x prefix
}
```

- [ ] **Step 2: Write a failing test for `submitDepositStage` completing the deposit**

Add to `investments.service.spec.ts`:

```typescript
it('submitDepositStage(deposit) submits on-chain and marks transaction COMPLETED with the RPC hash', async () => {
  const tx = { id: 'tx1', userId: 'inv1', amount: 500, status: 'APPROVED' };
  prisma.transaction.findFirst.mockResolvedValue(tx);
  prisma.transaction.update.mockResolvedValue({ ...tx, status: 'COMPLETED', txHash: 'realhash' });
  blockchain.submitSignedTx.mockResolvedValue('realhash');

  const result = await service.submitDepositStage('tx1', 'inv1', {
    stage: 'deposit',
    xdr: 'x',
    signature: 'ab',
  });

  expect(blockchain.submitSignedTx).toHaveBeenCalled();
  expect(prisma.transaction.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', txHash: 'realhash' }) }),
  );
  expect(result.status).toBe('COMPLETED');
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/api && npx jest investments.service.spec.ts -t submitDepositStage`
Expected: FAIL — `service.submitDepositStage is not a function`.

- [ ] **Step 4: Implement `buildDepositStage` and `submitDepositStage`; harden `finalizeDeposit`**

Add to `InvestmentsService`. Resolve the investor's Privy address from the user record (the operator minted BRLT to `privyStellarWalletAddress || stellarWalletId`, mirror that). Inject the same resolution the controller can pass, or load the user here.

```typescript
private async resolveInvestorAddress(investorUserId: string): Promise<string> {
  const user = await this.prisma.user.findUnique({
    where: { id: investorUserId },
    select: { privyStellarWalletAddress: true, stellarWalletId: true },
  });
  const address = user?.privyStellarWalletAddress ?? user?.stellarWalletId;
  if (!address) {
    throw new BadRequestException('Investidor não possui carteira Stellar configurada');
  }
  return address;
}

private async loadApprovedDeposit(transactionId: string, investorUserId: string) {
  const transaction = await this.prisma.transaction.findFirst({
    where: { id: transactionId, userId: investorUserId },
  });
  if (!transaction) {
    throw new NotFoundException('Transação não encontrada');
  }
  if (transaction.type !== 'DEPOSIT') {
    throw new BadRequestException('Transação não é um depósito');
  }
  if (transaction.status !== 'APPROVED') {
    throw new BadRequestException('Esta transação ainda não foi aprovada pelo admin');
  }
  return transaction;
}

async buildDepositStage(
  transactionId: string,
  investorUserId: string,
  stage: 'approve' | 'deposit',
) {
  const transaction = await this.loadApprovedDeposit(transactionId, investorUserId);
  const investorAddress = await this.resolveInvestorAddress(investorUserId);

  return stage === 'approve'
    ? this.blockchain.buildApproveTx(investorAddress, transaction.amount)
    : this.blockchain.buildDepositTx(investorAddress, transaction.amount);
}

async submitDepositStage(
  transactionId: string,
  investorUserId: string,
  dto: { stage: 'approve' | 'deposit'; xdr: string; signature: string },
) {
  const transaction = await this.loadApprovedDeposit(transactionId, investorUserId);
  const investorAddress = await this.resolveInvestorAddress(investorUserId);

  const hash = await this.blockchain.submitSignedTx({
    xdr: dto.xdr,
    signerPublicKey: investorAddress,
    signatureHex: dto.signature,
  });

  // The approve stage does not complete the deposit — only the deposit stage does.
  if (dto.stage === 'approve') {
    return { hash, status: transaction.status };
  }

  const updated = await this.prisma.transaction.update({
    where: { id: transactionId },
    data: { status: 'COMPLETED', txHash: hash },
  });
  await this.prisma.auditLog.create({
    data: {
      event: 'pool.deposit_completed',
      entityId: transactionId,
      entityType: 'transaction',
      userId: investorUserId,
      txHash: hash,
      metadata: { amount: transaction.amount },
    },
  });
  return { hash, status: updated.status };
}
```

Then harden the now-legacy `finalizeDeposit` so it can no longer be the forgery boundary. Either delete it and its route (preferred, see Task 5) or, if kept temporarily, reject client hashes:

```typescript
async finalizeDeposit(): Promise<never> {
  throw new BadRequestException(
    'finalizeDeposit is deprecated — use /investments/deposit/:id/onchain/submit',
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/api && npx jest investments.service.spec.ts -t submitDepositStage`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/investments/
git commit -m "feat(investments): orchestrate Privy-signed on-chain pool deposit, deprecate client-hash finalize"
```

---

## Task 5: Expose the build/submit endpoints and remove the mock finalize route

**Files:**
- Modify: `apps/api/src/modules/investments/investments.controller.ts`

- [ ] **Step 1: Add the two routes and remove (or deprecate) the old finalize route**

Match the existing controller decorators (`@UseGuards`, role guard for investor, `@CurrentUser`/request user extraction — copy from the existing `markAsPaid`/`finalizeDeposit` handlers in the same file).

```typescript
@Post('deposit/:id/onchain/build')
buildOnchainDeposit(
  @Param('id') id: string,
  @CurrentUser('id') investorUserId: string,
  @Body() dto: BuildDepositStageDto,
) {
  return this.investmentsService.buildDepositStage(id, investorUserId, dto.stage);
}

@Post('deposit/:id/onchain/submit')
submitOnchainDeposit(
  @Param('id') id: string,
  @CurrentUser('id') investorUserId: string,
  @Body() dto: SubmitDepositStageDto,
) {
  return this.investmentsService.submitDepositStage(id, investorUserId, dto);
}
```

Delete the old `@Post('deposit/:id/finalize')` handler (the route that accepted a client `txHash`). Remove its now-unused DTO import.

- [ ] **Step 2: Build the API**

Run: `cd apps/api && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run the full investments test suite**

Run: `cd apps/api && npx jest investments`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/investments/investments.controller.ts
git commit -m "feat(investments): add onchain build/submit routes, drop client-hash finalize route"
```

---

## Task 6: Frontend API bindings for the new endpoints

**Files:**
- Modify: `apps/web/src/lib/api/investments.ts`

- [ ] **Step 1: Replace `useFinalizeDeposit` with build/submit bindings**

Remove `useFinalizeDeposit` (the `/finalize` mutation) and add:

```typescript
export interface UnsignedSorobanTx {
  xdr: string;
  hashToSign: string;
  signerPublicKey: string;
}

export type DepositStage = "approve" | "deposit";

export function buildDepositStage(id: string, stage: DepositStage) {
  return apiFetch<UnsignedSorobanTx>(`/investments/deposit/${id}/onchain/build`, {
    method: "POST",
    body: { stage },
  });
}

export function submitDepositStage(
  id: string,
  stage: DepositStage,
  xdr: string,
  signature: string,
) {
  return apiFetch<{ hash: string; status: string }>(
    `/investments/deposit/${id}/onchain/submit`,
    { method: "POST", body: { stage, xdr, signature } },
  );
}
```

Keep `useInvestorTransactions`, `useNotifyDepositPayment`, etc. unchanged. (These are plain async fns, not hooks, because the orchestrator in Task 7 calls them imperatively inside a signing loop; React Query cache invalidation happens in the modal's `onSuccess`.)

- [ ] **Step 2: Typecheck the web app**

Run: `cd apps/web && npx tsc --noEmit`
Expected: errors only where `useFinalizeDeposit` is still imported (resolved in Task 7).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/investments.ts
git commit -m "feat(web): add onchain deposit build/submit api bindings"
```

---

## Task 7: On-chain deposit orchestrator + modal rewrite

**Files:**
- Create: `apps/web/src/lib/stellar/sign-deposit.ts`
- Modify: `apps/web/src/components/investor/FinalizeAssignmentModal.tsx`
- Test: `apps/web/src/components/investor/FinalizeAssignmentModal.spec.tsx`

- [ ] **Step 1: Create the orchestrator**

```typescript
import { buildDepositStage, submitDepositStage, type DepositStage } from "@/lib/api/investments";

type SignRawHash = (input: {
  address: string;
  chainType: "stellar";
  hash: `0x${string}`;
}) => Promise<{ signature: string }>;

export async function runOnChainDeposit(params: {
  transactionId: string;
  privyAddress: string;
  signRawHash: SignRawHash;
  onStage?: (stage: DepositStage) => void;
}): Promise<{ depositHash: string }> {
  const stages: DepositStage[] = ["approve", "deposit"];
  let depositHash = "";

  for (const stage of stages) {
    params.onStage?.(stage);
    const built = await buildDepositStage(params.transactionId, stage);
    const { signature } = await params.signRawHash({
      address: params.privyAddress,
      chainType: "stellar",
      hash: `0x${built.hashToSign}`,
    });
    const result = await submitDepositStage(
      params.transactionId,
      stage,
      built.xdr,
      signature,
    );
    if (stage === "deposit") {
      depositHash = result.hash;
    }
  }

  return { depositHash };
}
```

- [ ] **Step 2: Write a failing modal test**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { FinalizeAssignmentModal } from "./FinalizeAssignmentModal";

vi.mock("@/lib/stellar/sign-deposit", () => ({
  runOnChainDeposit: vi.fn().mockResolvedValue({ depositHash: "REALHASH" }),
}));

it("runs the real on-chain deposit and never fabricates a hash", async () => {
  const onSuccess = vi.fn();
  render(
    <FinalizeAssignmentModal
      isOpen
      transaction={{ id: "tx1", amount: 500, type: "DEPOSIT", status: "APPROVED" } as any}
      onClose={() => {}}
      onSuccess={onSuccess}
      userEmail="inv@x.com"
    />,
  );
  fireEvent.click(screen.getByText(/Assinar e Emitir Cotas/i));
  await waitFor(() => expect(screen.getByText(/Cotas CBPOOL Emitidas/i)).toBeInTheDocument());
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd apps/web && npx vitest run FinalizeAssignmentModal`
Expected: FAIL — modal still calls the old `authorize()`/`Math.random()` path / imports removed `useFinalizeDeposit`.

- [ ] **Step 4: Rewrite `handleFinalize` in FinalizeAssignmentModal**

Resolve the Privy address exactly like `useFinancialAuthorization` does (via `useGetWallet()` + `useUser().linkedAccounts`, `chainType === 'stellar'`). Replace the mock body:

```tsx
import { useUser } from "@privy-io/react-auth";
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { useGetWallet } from "@/lib/api/wallet";
import { runOnChainDeposit } from "@/lib/stellar/sign-deposit";
// remove: useFinalizeDeposit, useFinancialAuthorization (no longer used here)

// inside component:
const { data: wallet } = useGetWallet();
const { user } = useUser();
const { signRawHash } = useSignRawHash();

const resolvePrivyAddress = (): string => {
  if (wallet?.walletType === "privy_stellar" && wallet.contractId) return wallet.contractId;
  const acct = (user?.linkedAccounts as Array<{ type?: string; address?: string; chainType?: string; chain_type?: string }> | undefined)?.find(
    (a) => a.type === "wallet" && (a.chainType === "stellar" || a.chain_type === "stellar") && typeof a.address === "string",
  );
  if (!acct?.address) throw new Error("Carteira Stellar Privy não encontrada");
  return acct.address;
};

const handleFinalize = async () => {
  try {
    setErrorMessage(null);
    setSigningStep("approve_brlt");
    const privyAddress = resolvePrivyAddress();

    await runOnChainDeposit({
      transactionId: transaction.id,
      privyAddress,
      signRawHash,
      onStage: (stage) => setSigningStep(stage === "approve" ? "approve_brlt" : "deposit_pool"),
    });

    setSigningStep("success");
    showToast("Cotas CBPOOL emitidas com sucesso na sua carteira!", "success");
  } catch (err: any) {
    setSigningStep("error");
    setErrorMessage(err?.message || "Erro ao assinar transações on-chain.");
    showToast("Falha na assinatura on-chain via Privy.", "error");
  }
};
```

Delete the `Math.random()` hash, both `setTimeout` calls, and the two `authorize()` calls. The `onSuccess` callback already triggers React Query refetch in the parent (`useInvestorTransactions` invalidation); confirm the parent dashboard invalidates `["investments","me","transactions"]` after `onSuccess` and add invalidation there if missing.

- [ ] **Step 5: Run the modal test to verify it passes**

Run: `cd apps/web && npx vitest run FinalizeAssignmentModal`
Expected: PASS.

- [ ] **Step 6: Full web typecheck + tests**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: PASS (no dangling `useFinalizeDeposit` imports).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/stellar/sign-deposit.ts apps/web/src/components/investor/FinalizeAssignmentModal.tsx apps/web/src/components/investor/FinalizeAssignmentModal.spec.tsx
git commit -m "feat(web): real Privy-signed on-chain pool deposit, remove fabricated hash"
```

---

## Task 8: End-to-end manual verification on testnet

**Files:** none (manual)

- [ ] **Step 1: Confirm env config**

Verify `apps/api` has `STELLAR_POOL_CONTRACT_ID`, `STELLAR_BRLT_TOKEN_ID`, `STELLAR_RPC_URL`, `STELLAR_NETWORK=testnet` set, and that the investor's Privy wallet is funded (login funds 1 XLM; Soroban fees may need more — top up via Friendbot if `txMalformed`/insufficient-fee occurs).

- [ ] **Step 2: Run the full deposit happy path**

1. Operator creates deposit order (`POST /admin/transactions/deposit`).
2. Investor pays Pix (mock) and notifies (`PATCH /investments/deposit/:id/pay`).
3. Operator approves (`POST /admin/transactions/:id/approve`) — confirm BRLT minted to investor Privy address (check balance on `getTokenBalances` / explorer).
4. Investor opens FinalizeAssignmentModal → "Assinar e Emitir Cotas" → approve Privy prompt → deposit Privy prompt.
5. Confirm: transaction status `COMPLETED`, `txHash` is a real testnet hash (look it up on stellar.expert testnet), BRLT moved out of investor wallet into the Pool contract, CBPOOL shares minted to investor.

- [ ] **Step 3: Verify the forgery boundary is closed**

Attempt `POST /investments/deposit/:id/onchain/submit` with a bogus signature; expect HTTP 400/500 ("Signature does not match transaction hash") and the transaction NOT marked `COMPLETED`.

- [ ] **Step 4: Final commit / branch wrap-up**

Use superpowers:finishing-a-development-branch to decide merge/PR.

---

## Self-Review Notes

- **Spec coverage:** mock removal (Tasks 4-7), real approve+deposit signing (Tasks 2,7), Privy-only key custody (Task 7 — backend never signs investor txs, only attaches the Privy signature), forgery boundary moved server-side (Tasks 4,8). Covered.
- **No re-mint:** finalize path never calls mint; relies on operator's earlier `mintBrlt`. The dead `depositToPool` is left untouched but unused (legacy custodial path); a follow-up may delete it.
- **Type consistency:** `UnsignedSorobanTx { xdr, hashToSign, signerPublicKey }` and stage union `"approve" | "deposit"` are identical across interface, service, controller DTO, web bindings, and orchestrator.
- **Open risk:** if the investor is NOT the source account of the assembled tx (should not happen — we set source = investor), Soroban `require_auth` would need `authorizeEntry` signing instead. The build uses `getAccount(investorAddress)` as source, so source-account auth applies and envelope signing suffices. Verify during Task 8; if simulation returns address-based auth entries, escalate to an auth-entry signing sub-plan.
