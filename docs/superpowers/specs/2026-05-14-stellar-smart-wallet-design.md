# Stellar Smart Wallet (Passkey-Kit + Google Passkeys)

**Date:** 2026-05-14  
**Status:** Approved  
**Approach:** A — `@stellar/passkey-kit` + CredBridge Launchpad

---

## Summary

Create a Stellar Soroban smart wallet for every CredBridge user, triggered automatically on first Google login. The wallet's only signer is a WebAuthn passkey (P-256) stored in Google Password Manager. CredBridge acts as the launchpad, sponsoring the Soroban factory contract call that deploys the wallet. No seed phrase exists. The server never has custody of the signing key.

---

## Architecture

```
Browser                        NestJS API                    Stellar Testnet
──────────────────────         ───────────────────────────   ───────────────────────
[Google OAuth Login]
        │
        ▼
[PasskeyKit.register()]  ──→  POST /wallet/create
  WebAuthn prompt              (StellarWalletService)
  (Google PM saves key)           │
        │                         ├─ verify passkey data
        │                         ├─ call factory contract
        │                         │  (CredBridge sponsor keypair)
        │                         ├─ store contractId in DB  ──→ [Soroban smart wallet deployed]
        │◄────────────────────── { contractId }
        │
  store contractId in
  auth-storage / React state
```

**Key constraint:** WebAuthn credential creation requires a user gesture (browser shows a dialog). This cannot be fully silent. "Automatic on first login" means the passkey prompt fires immediately after the Google OAuth flow completes, before the user reaches their dashboard.

---

## Data Model

### Prisma migration — add two nullable fields to `User`

```prisma
model User {
  // ... existing fields unchanged ...

  stellarWalletId  String?   // Soroban contract ID (C... address)
  passkeyId        String?   // WebAuthn credential ID (base64url), for UX reference only
}
```

- Both fields are nullable — existing users are unaffected until they complete wallet setup.
- `stellarWalletId` is the Soroban contract address (starts with `C` on Stellar).
- `passkeyId` is stored for display/debugging only; it is not a secret.

---

## Backend

### New module: `apps/api/src/modules/stellar-wallet/`

```
stellar-wallet/
  stellar-wallet.module.ts
  stellar-wallet.controller.ts
  stellar-wallet.service.ts
  stellar.service.ts          ← Soroban/SDK wrapper
  dto/
    create-wallet.dto.ts
```

### `StellarService` (injectable)

Wraps `@stellar/stellar-sdk`. Single responsibility: Soroban operations.

```typescript
deployPasskeyWallet(passkeyPublicKeyBase64: string, sponsorKeypair: Keypair): Promise<string>
// Returns the new Soroban contract ID (string)
```

Internals:
1. Decode the base64 public key bytes.
2. Build a Soroban `invokeContractFunction` transaction calling the factory's `create_account` entry point with the P-256 key as argument.
3. Sign and submit using `sponsorKeypair`.
4. Extract and return the contract ID from the operation result.

Network (testnet vs mainnet) driven by `STELLAR_NETWORK` env var.

### `AuthService` change — extend `googleLogin` response

The existing `googleLogin` response already includes `{ accessToken, user, needsRoleSelection }`. Add `stellarWalletId: string | null` to the `user` object so the frontend can check wallet status immediately without a second request.

### `StellarWalletService`

```typescript
createWallet(userId: string, passkeyId: string, publicKey: string): Promise<{ contractId: string }>
```

- **Idempotent:** if `User.stellarWalletId` is already set, return it immediately without re-deploying.
- Calls `StellarService.deployPasskeyWallet()`.
- On success: updates User with `stellarWalletId` and `passkeyId`.
- Throws `BadRequestException` if `publicKey` is malformed.
- Throws `ServiceUnavailableException` if Stellar submission fails (sponsor underfunded, network error).

```typescript
getWallet(userId: string): Promise<{ contractId: string; passkeyId: string } | null>
```

- Returns null if `stellarWalletId` is not set.

### `StellarWalletController`

Both routes are JWT-guarded (`@UseGuards(JwtAuthGuard)`).

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/wallet/create` | `{ passkeyId: string, publicKey: string }` | `{ contractId: string }` |
| `GET` | `/wallet` | — | `{ contractId, passkeyId } \| null` |

### New environment variables

```env
STELLAR_NETWORK=testnet                          # or "mainnet"
STELLAR_SPONSOR_SECRET_KEY=S...                  # CredBridge sponsor keypair secret
STELLAR_PASSKEY_FACTORY_ID=C...                  # Soroban factory contract ID (testnet: from Stellar Labs)
```

`StellarService` throws at module initialization if `STELLAR_SPONSOR_SECRET_KEY` or `STELLAR_PASSKEY_FACTORY_ID` are missing — fail fast, not silent runtime error.

---

## Frontend

### New dependency

```
apps/web/package.json: "@stellar/passkey-kit": "^1.x"
```

### New files

```
apps/web/src/lib/wallet/
  passkey-client.ts     ← PasskeyKit wrapper
apps/web/src/lib/api/
  wallet.ts             ← React Query hooks for /wallet endpoints
```

### `passkey-client.ts`

```typescript
export async function registerPasskey(userName: string): Promise<{ keyId: string; publicKey: string }>
```

- Calls `PasskeyKit.register(userName)` — triggers browser WebAuthn dialog.
- Returns `keyId` (credential ID, base64url) and `publicKey` (P-256 public key, base64).
- Throws `PasskeyAbortedError` (custom) if user cancels (`NotAllowedError`).

### `wallet.ts` (React Query)

```typescript
export function useCreateWallet(): UseMutationResult<{ contractId: string }, Error, { passkeyId: string; publicKey: string }>
export function useGetWallet(): UseQueryResult<{ contractId: string; passkeyId: string } | null>
```

### Wallet setup trigger — integration points

**New Google users** (go through onboarding): wallet creation is added as the final step in `KycFlow`, after KYC completes and before `onDone()` is called. `KycFlow` gets a prop `onWalletCreated` that is called when the passkey prompt succeeds or is skipped.

**Returning Google users** (skip onboarding, `needsRoleSelection: false`): `GoogleSignInButton`'s `onSuccess` handler checks `data.stellarWalletId`. If null, calls `registerPasskey()` then `createWallet` mutation before navigating to dashboard.

**UX on passkey prompt:** no custom UI — the browser/Google Password Manager native dialog handles everything. A loading state ("Configurando sua carteira...") is shown while the Stellar transaction is in flight after the passkey dialog closes.

**Skipped wallet:** if user cancels the passkey dialog, a dismissible banner appears on their dashboard: "Carteira Stellar não configurada. [Configurar agora]" — links to a settings page (out of scope for this feature, but the entry point is defined).

---

## Error Handling

| Failure | Behavior |
|---------|----------|
| User cancels passkey prompt | Catch `PasskeyAbortedError`. Non-blocking — user reaches dashboard with banner. |
| `POST /wallet/create` returns 503 | Toast error. Retry available from dashboard banner. |
| `POST /wallet/create` called twice | Idempotent — second call returns existing `contractId`. No re-deployment. |
| Sponsor keypair underfunded | Backend returns 503 with `"Stellar network error"`. Operational alert needed (out of scope). |
| `STELLAR_SPONSOR_SECRET_KEY` missing | NestJS module init throws — server won't start. Caught in CI. |
| Malformed `publicKey` in request | Backend returns 400 `"Invalid passkey public key"`. |

---

## Testing

### Backend

- **Unit — `StellarService.deployPasskeyWallet()`:** mock `@stellar/stellar-sdk` `Server` and `TransactionBuilder`. Assert the correct factory contract is invoked with the given public key bytes.
- **Unit — `StellarWalletService.createWallet()` idempotency:** set up a User with `stellarWalletId` already present. Assert `StellarService.deployPasskeyWallet()` is NOT called and existing ID is returned.
- **Integration — `POST /wallet/create`:** end-to-end request with valid JWT, mock `StellarService`, assert DB `stellarWalletId` updated.

### Frontend

- PasskeyKit uses `navigator.credentials` — not available in Jest/jsdom. No unit tests for `passkey-client.ts`.
- `useCreateWallet` and `useGetWallet` hooks: standard React Query mock-fetch tests.
- Full passkey + wallet flow: manual testing in Chrome with a real Google account on testnet.

### Manual testnet checklist

1. Fund sponsor keypair via Friendbot.
2. Sign in with Google → passkey prompt appears → save in Google Password Manager.
3. Assert `POST /wallet/create` returns a `contractId` starting with `C`.
4. Assert `User.stellarWalletId` updated in DB.
5. Sign in again → no passkey prompt → wallet already exists.
6. Cancel passkey prompt → dashboard banner appears.

---

## Out of Scope

- Transaction signing with the wallet (future: `PasskeyKit.sign()`).
- Wallet settings page / re-registration flow.
- Mainnet deployment and sponsorship funding model.
- Operational monitoring for sponsor balance.
