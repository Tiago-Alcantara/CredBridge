# Smart Account Financial Authorization — Design

**Date:** 2026-05-20  
**Status:** Approved for planning  
**Approach:** Progressive smart account authorization over existing login

---

## Goal

Keep CredBridge login simple with Google or email/password, but require smart account authorization for financial actions. The web session answers "who is using the app"; the smart account signature answers "did the wallet owner consent to this exact financial operation".

This design improves the current custodial wallet model without forcing a full rewrite of authentication. It reuses the existing `passkey-kit` smart wallet setup and moves it from login time to the first financial action.

---

## Sources And Direction

OpenZeppelin's Stellar smart account framework separates authorization into:

- context rules: what operation scope is being authorized;
- signers/verifiers: who can authenticate the operation;
- policies: business constraints such as limits, thresholds, or time windows.

CredBridge will adopt that model as an architectural direction. The MVP does not need to deploy the full OpenZeppelin accounts package immediately. Instead, it introduces a backend authorization boundary that can later be backed by OpenZeppelin context rules and policies without changing product flows.

Reference docs:

- https://docs.openzeppelin.com/stellar-contracts/accounts/smart-account
- https://docs.openzeppelin.com/stellar-contracts/accounts/context-rules
- https://docs.openzeppelin.com/stellar-contracts/accounts/signers-and-verifiers
- https://docs.openzeppelin.com/stellar-contracts/accounts/authorization-flow

---

## Non-goals

- Replacing Google/email login with wallet-only login.
- Deploying the full OpenZeppelin smart account framework in the first pass.
- Removing all platform execution. CredBridge may still assemble, submit, retry, and audit transactions after a valid user authorization.
- Building a complete recovery flow for lost passkeys.
- Implementing all anchor settlement details for deposit and withdrawal.

---

## Current State

The API currently creates deterministic custodial Stellar wallets through `createCustodialWallet(seedSource)`. It stores the resulting address in `User.stellarWalletId`.

The frontend already has `passkey-kit` code that can create and deploy a smart wallet contract and store `{ contractId, keyId }` through `/wallet/create`. Today, this setup is attempted after Google login when no wallet exists.

Financial flows are currently too coarse:

- `ReceivablesService.activate()` validates readiness, tokenizes the note, marks it active, and pays the PME in one flow.
- `InvestmentsService.create()` reserves the investment and then calls blockchain charge/transfer operations.
- Stellar challenge endpoints exist in `AuthService`, but they are placeholders.

This design separates these responsibilities so consent is collected at the right point.

---

## Product Model

### Identity

Users still authenticate with Google or email/password. The API issues the existing JWT and uses it for normal navigation and protected reads/writes.

### Financial Consent

Financial operations require an action-specific authorization signed by the user's smart account/passkey. This authorization includes operation type, resource id, amount, destination when relevant, nonce, expiration, network, and wallet id.

The authorization is not a generic "confirm" message. It is bound to one operation and can be consumed only once.

### Wallet Setup Timing

Smart account setup is mandatory at first financial action, not during login. If the user tries to activate/assign a receivable, buy, deposit, or withdraw without a smart account, the UI opens the setup flow. After setup succeeds, the user returns to the original action and signs it.

---

## PME Flows

### Receivable Lifecycle

The receivable lifecycle becomes explicit:

1. `pending`: PME creates the receivable.
2. `validated`: platform validates documents and business rules.
3. `tokenized`: platform tokenizes the note using policy/platform automation. No direct user signature is required because the PME has not yet assigned the receivable.
4. `assignment_pending`: the tokenized note is waiting for PME consent to assign it to CredBridge.
5. `active`: PME signed the assignment/activation, and the receivable can enter the investment pool.
6. `funded`: an investor has funded/bought the receivable.
7. `settled`: the receivable has been paid and settled.

### Tokenization

Tokenization can be automated through platform policy. The smart account model permits this because tokenization records the receivable but does not transfer the PME's economic right to CredBridge.

### Assignment / Activation

Assignment is the consent-heavy operation. When the PME activates a tokenized note, the UI must request a direct smart account authorization for `receivable.assignment`. The payload binds the signature to the receivable id, wallet id, CredBridge destination, network, nonce, and expiration.

The API may submit the final transaction after validation, but it must not assign or activate the receivable without a valid authorization.

### PME Withdrawal

PME withdrawals require direct signature. The UI asks for amount and destination, then requests smart account authorization for `pme.withdrawal`. The API starts the withdrawal or anchor flow only after validating the signed payload.

---

## Investor Flows

Investor operations are stricter because almost every relevant action changes patrimonial state.

The following actions require direct smart account authorization:

- `investor.deposit`
- `investment.purchase`
- `investor.withdrawal`
- any future blockchain movement or destination change that affects balances or ownership

For purchases, the API validates authorization before creating or finalizing patrimonial movement. The reservation step must not become a path to execute `chargeInvestor` or transfer ownership without consent.

---

## Authorization Payload

The backend creates a canonical payload. The frontend signs it with the smart account/passkey. The backend verifies and consumes it before executing the action.

Example:

```json
{
  "domain": "credbridge.finance.authorization",
  "version": "1",
  "network": "stellar-testnet",
  "operation": "receivable.assignment",
  "userId": "user-id",
  "walletId": "C...",
  "resourceId": "receivable-id",
  "amount": "1000.00",
  "destination": "credbridge-pool",
  "nonce": "random-nonce",
  "expiresAt": "2026-05-20T15:00:00.000Z"
}
```

Canonicalization rules:

- stable field order before hashing/signing;
- amounts represented as decimal strings with fixed precision;
- `network` included to prevent cross-network replay;
- `walletId` included to prevent reuse across accounts;
- `operation` must be one of a known enum;
- `expiresAt` must be short-lived;
- `nonce` must be random and single-use.

---

## Backend Design

### New Authorization Boundary

Add a focused backend service named `FinancialAuthorizationService`, with responsibilities:

- decide whether an operation requires authorization;
- create an authorization challenge;
- persist nonce, expiration, operation metadata, and payload hash;
- verify returned signatures;
- mark authorizations consumed exactly once;
- expose clear errors to business services and controllers.

Business services should not hand-roll signature or replay checks.

### Operation Enum

Initial operations:

```ts
type FinancialOperation =
  | 'receivable.tokenize'
  | 'receivable.assignment'
  | 'pme.withdrawal'
  | 'investor.deposit'
  | 'investment.purchase'
  | 'investor.withdrawal';
```

`receivable.tokenize` is policy/platform-authorized for PME. The others require direct user authorization.

### Persistence

Add a table similar to `FinancialAuthorization`:

```prisma
model FinancialAuthorization {
  id            String    @id @default(uuid())
  userId        String
  walletId      String
  operation     String
  resourceId    String?
  amount        String?
  destination   String?
  nonce         String    @unique
  payloadHash   String    @unique
  signature     String?
  expiresAt     DateTime
  verifiedAt    DateTime?
  consumedAt    DateTime?
  createdAt     DateTime  @default(now())

  user          User      @relation(fields: [userId], references: [id])

  @@index([userId, operation])
  @@index([expiresAt])
}
```

The final implementation can choose exact names, but it must preserve nonce uniqueness, payload hash uniqueness, expiration, and consumed-at tracking.

### User Wallet Fields

Keep current fields and add explicit classification:

```prisma
walletType   String? // "custodial" | "smart_account"
walletStatus String? // "missing" | "ready" | "needs_recovery"
```

Existing users remain compatible. If a user has a `G...` custodial wallet, financial actions can require setup of a `C...` smart account before proceeding.

### API Shape

Recommended endpoints:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/financial-authorizations/challenge` | Create an action-specific payload to sign |
| `POST` | `/financial-authorizations/verify` | Verify signature and mark authorization verified |
| business endpoint | existing/new route | Consumes `financialAuthorizationId` or verified authorization reference |

Business endpoints must fail if the required authorization is missing, expired, invalid, or already consumed.

### Error Codes

Return machine-readable codes:

- `wallet_required`
- `authorization_required`
- `authorization_expired`
- `authorization_invalid`
- `authorization_already_used`
- `authorization_operation_mismatch`
- `authorization_resource_mismatch`

---

## Frontend Design

### First Financial Action Setup

When a financial action starts, the frontend checks wallet state:

1. no smart account: run `registerAndDeployWallet()`;
2. store wallet through `/wallet/create`;
3. resume original action;
4. request authorization challenge;
5. show an operation summary;
6. sign with passkey/smart account;
7. verify authorization;
8. call the business endpoint with the verified authorization reference.

### Operation Summary

Before signing, show:

- operation label;
- amount when present;
- receivable or destination when present;
- wallet short address;
- expiration window.

If the user cancels the passkey prompt, no business mutation is submitted.

### Retry Behavior

Expired or cancelled authorizations are not reused. The UI requests a new challenge.

---

## Business Flow Changes

### Receivables

Split current activation behavior into separate actions:

- validate;
- tokenize;
- request assignment authorization;
- assign/activate after authorization.

The existing `activate` route can be replaced or internally separated, but the user-facing behavior must reflect the new lifecycle.

### Investments

Investment purchase must require a valid `investment.purchase` authorization before patrimonial movement. The service should avoid charging the investor or transferring ownership unless the authorization has been validated and consumed.

### Withdrawals And Deposits

PME withdrawal, investor deposit, and investor withdrawal need explicit authorization before the API starts the anchor/on-chain flow.

---

## Audit Events

Add audit records for:

- authorization challenge created;
- authorization verified;
- authorization consumed;
- authorization rejected;
- wallet setup required;
- wallet setup completed;
- receivable tokenized by policy;
- receivable assignment signed;
- investor purchase signed;
- withdrawal signed.

Audit metadata should include operation, resource id, amount, wallet id, and payload hash. Do not store secrets.

---

## OpenZeppelin Compatibility Path

The MVP's `FinancialAuthorizationService` maps cleanly to OpenZeppelin smart accounts:

- `FinancialOperation` maps to context rules.
- passkey/smart account signature maps to signer/verifier validation.
- policy-only tokenization maps to a platform policy context.
- amount or destination constraints can later move into policy contracts.
- explicit authorization id/payload binding mirrors OpenZeppelin's explicit context rule selection and replay protection goals.

This keeps the first implementation practical while preserving the route to contract-level policy enforcement.

---

## Testing

### Backend Unit Tests

- operation policy matrix: tokenization does not require direct signature; assignment, withdrawals, deposits, and purchases do;
- challenge creation creates unique nonce and payload hash;
- expired challenge fails verification;
- consumed authorization cannot be reused;
- operation/resource/amount mismatches fail;
- missing smart account returns `wallet_required`.

### Backend Service Tests

- receivable tokenization can move `validated` to `tokenized` without direct user signature;
- receivable assignment requires valid authorization before moving to `active`;
- investor purchase requires valid authorization before charge/transfer calls;
- PME withdrawal requires valid authorization;
- investor deposit and withdrawal require valid authorization.

### Frontend Tests

- first financial action without wallet opens setup;
- cancelled passkey prompt does not submit business mutation;
- successful setup resumes original action;
- expired authorization prompts re-sign;
- operation summary renders amount/resource/destination.

### Manual Test Checklist

1. Existing user with no smart account logs in normally.
2. User attempts to activate a receivable and is prompted to create wallet.
3. User completes wallet setup and sees assignment summary.
4. User cancels signature and the receivable remains tokenized, not active.
5. User signs assignment and the receivable becomes active.
6. Investor purchase without wallet triggers setup and signature.
7. Reusing the same authorization fails.
8. Expired authorization fails.

---

## Acceptance Criteria

- Login remains usable without smart account setup.
- First financial action requires smart account setup if missing.
- Receivable tokenization and assignment are separate states/actions.
- PME assignment and withdrawal require direct authorization.
- Investor deposit, purchase, and withdrawal require direct authorization.
- Authorizations are nonce-bound, expiring, operation-specific, and single-use.
- Business services consume authorizations through one shared backend boundary.
- Audit events record wallet setup and financial authorization lifecycle.
- The design does not block future OpenZeppelin context rule and policy integration.
