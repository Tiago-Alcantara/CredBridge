# Stellar Smart Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Soroban passkey-based smart wallet for every CredBridge user, triggered automatically after Google login, using `passkey-kit` for WebAuthn/passkey registration and Launchtube for testnet fee sponsorship.

**Architecture:** The browser calls `PasskeyKit.createWallet()` which registers a WebAuthn passkey (Google Password Manager saves it) and builds a signed Soroban transaction. `PasskeyServer.send()` submits that transaction to Launchtube, which sponsors fees and deploys the smart wallet contract on Stellar testnet. The resulting `contractId` and `keyId` are persisted via `POST /wallet/create`. The backend stores them in the User record. No private key ever touches the server.

**Tech Stack:** `passkey-kit` (new, frontend only), `@stellar/stellar-sdk` (existing), NestJS + Prisma (existing), React Query + Next.js (existing)

---

## File Map

**Backend (create):**
- `apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts` — validates `{ contractId, keyId }` from client
- `apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts` — idempotent DB write + read
- `apps/api/src/modules/stellar-wallet/stellar-wallet.service.spec.ts` — unit tests
- `apps/api/src/modules/stellar-wallet/stellar-wallet.controller.ts` — `POST /wallet/create`, `GET /wallet`
- `apps/api/src/modules/stellar-wallet/stellar-wallet.module.ts` — NestJS module

**Backend (modify):**
- `apps/api/prisma/schema.prisma` — add `stellarWalletId`, `passkeyId` fields to User
- `apps/api/src/app.module.ts` — register `StellarWalletModule`
- `apps/api/src/modules/auth/auth.service.ts` — include `stellarWalletId` in `googleLogin` response
- `apps/api/.env.example` — add Launchtube/Stellar env vars

**Frontend (create):**
- `apps/web/src/lib/wallet/passkey-client.ts` — wraps `PasskeyKit.createWallet()` + `PasskeyServer.send()`
- `apps/web/src/lib/api/wallet.ts` — React Query hooks for `/wallet` endpoints
- `apps/web/src/components/auth/WalletSetupBanner.tsx` — dismissible banner for users without wallet

**Frontend (modify):**
- `apps/web/src/lib/api/auth.ts` — add `stellarWalletId` to `AuthUser` and `GoogleAuthResponse`
- `apps/web/src/components/auth/KycFlow.tsx` — trigger wallet creation on final step
- `apps/web/src/app/(auth)/login/page.tsx` — trigger wallet creation for returning Google users
- `apps/web/src/app/(pme)/pme/dashboard/page.tsx` — render `WalletSetupBanner`
- `apps/web/src/app/(investor)/investor/dashboard/page.tsx` — render `WalletSetupBanner`

---

## Task 1: Prisma schema — add wallet fields to User

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add fields to User model**

In `apps/api/prisma/schema.prisma`, add after the `name` field (around line 63):

```prisma
  stellarWalletId  String?
  passkeyId        String?
```

The full User block should look like:

```prisma
model User {
  id               String   @id @default(uuid())
  email            String   @unique
  passwordHash     String?
  googleId         String?  @unique
  provider         String   @default("email")
  role             String?
  name             String?
  stellarWalletId  String?
  passkeyId        String?
  phone            String?
  address          String?
  companyName      String?
  cnpj             String?  @unique
  monthlyRevenue   Float?
  sector           String?
  investorType     String?
  riskProfile      String?
  operationalLimit Float?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  receivables      Receivable[] @relation("UserReceivables")
  investments      Investment[] @relation("UserInvestments")
  auditLogs        AuditLog[]   @relation("UserAuditLogs")
}
```

- [ ] **Step 2: Generate and run migration**

```bash
cd apps/api
npx prisma migrate dev --name add_stellar_wallet_fields
```

Expected output ends with: `✓ Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add stellarWalletId and passkeyId to User"
```

---

## Task 2: Backend — StellarWalletModule

**Files:**
- Create: `apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts`
- Create: `apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts`
- Create: `apps/api/src/modules/stellar-wallet/stellar-wallet.controller.ts`
- Create: `apps/api/src/modules/stellar-wallet/stellar-wallet.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts`:

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  contractId!: string;

  @IsString()
  @IsNotEmpty()
  keyId!: string;
}
```

- [ ] **Step 2: Create StellarWalletService**

Create `apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts`:

```typescript
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Injectable()
export class StellarWalletService {
  constructor(private readonly prisma: PrismaService) {}

  async createWallet(userId: string, dto: CreateWalletDto): Promise<{ contractId: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ConflictException('User not found');

    if (user.stellarWalletId) {
      return { contractId: user.stellarWalletId };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { stellarWalletId: dto.contractId, passkeyId: dto.keyId },
    });

    return { contractId: dto.contractId };
  }

  async getWallet(userId: string): Promise<{ contractId: string; passkeyId: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { stellarWalletId: true, passkeyId: true },
    });
    if (!user?.stellarWalletId) return null;
    return { contractId: user.stellarWalletId, passkeyId: user.passkeyId ?? '' };
  }
}
```

- [ ] **Step 3: Create StellarWalletController**

Create `apps/api/src/modules/stellar-wallet/stellar-wallet.controller.ts`:

```typescript
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StellarWalletService } from './stellar-wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';

interface AuthRequest {
  user: { userId: string };
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class StellarWalletController {
  constructor(private readonly walletService: StellarWalletService) {}

  @Post('create')
  create(@Req() req: AuthRequest, @Body() body: CreateWalletDto) {
    return this.walletService.createWallet(req.user.userId, body);
  }

  @Get()
  get(@Req() req: AuthRequest) {
    return this.walletService.getWallet(req.user.userId);
  }
}
```

- [ ] **Step 4: Create StellarWalletModule**

Create `apps/api/src/modules/stellar-wallet/stellar-wallet.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StellarWalletController } from './stellar-wallet.controller';
import { StellarWalletService } from './stellar-wallet.service';

@Module({
  imports: [AuthModule],
  controllers: [StellarWalletController],
  providers: [StellarWalletService],
})
export class StellarWalletModule {}
```

- [ ] **Step 5: Register in AppModule**

In `apps/api/src/app.module.ts`, add the import:

```typescript
import { StellarWalletModule } from './modules/stellar-wallet/stellar-wallet.module';
```

And add `StellarWalletModule` to the `imports` array (after `AuthModule`):

```typescript
    AuthModule,
    HealthModule,
    StellarWalletModule,
```

- [ ] **Step 6: Verify the API compiles**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/stellar-wallet/ apps/api/src/app.module.ts
git commit -m "feat(api): add StellarWalletModule with create and get endpoints"
```

---

## Task 3: Backend tests — StellarWalletService

**Files:**
- Create: `apps/api/src/modules/stellar-wallet/stellar-wallet.service.spec.ts`

- [ ] **Step 1: Write the tests**

Create `apps/api/src/modules/stellar-wallet/stellar-wallet.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { StellarWalletService } from './stellar-wallet.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  stellarWalletId: null,
  passkeyId: null,
};

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('StellarWalletService', () => {
  let service: StellarWalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarWalletService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<StellarWalletService>(StellarWalletService);
    jest.clearAllMocks();
  });

  describe('createWallet', () => {
    it('stores contractId and keyId when user has no wallet', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        stellarWalletId: 'CCONTRACT123',
        passkeyId: 'key-abc',
      });

      const result = await service.createWallet('user-1', {
        contractId: 'CCONTRACT123',
        keyId: 'key-abc',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { stellarWalletId: 'CCONTRACT123', passkeyId: 'key-abc' },
      });
      expect(result).toEqual({ contractId: 'CCONTRACT123' });
    });

    it('returns existing contractId without re-deploying (idempotent)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        stellarWalletId: 'CEXISTING456',
      });

      const result = await service.createWallet('user-1', {
        contractId: 'CDIFFERENT789',
        keyId: 'key-xyz',
      });

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(result).toEqual({ contractId: 'CEXISTING456' });
    });

    it('throws ConflictException when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createWallet('bad-id', { contractId: 'C123', keyId: 'k1' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getWallet', () => {
    it('returns contractId and passkeyId when wallet exists', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        stellarWalletId: 'CCONTRACT123',
        passkeyId: 'key-abc',
      });

      const result = await service.getWallet('user-1');
      expect(result).toEqual({ contractId: 'CCONTRACT123', passkeyId: 'key-abc' });
    });

    it('returns null when no wallet set', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        stellarWalletId: null,
        passkeyId: null,
      });

      const result = await service.getWallet('user-1');
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd apps/api
npx jest stellar-wallet.service.spec --no-coverage
```

Expected: 5 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/stellar-wallet/stellar-wallet.service.spec.ts
git commit -m "test(api): unit tests for StellarWalletService"
```

---

## Task 4: Extend googleLogin response with stellarWalletId

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`

- [ ] **Step 1: Update the googleLogin return**

In `apps/api/src/modules/auth/auth.service.ts`, find the `googleLogin` method's return block (lines ~123-126):

```typescript
    const tokenResult = await this.issueToken(user.id, user.email, user.role);
    return {
      ...tokenResult,
      needsRoleSelection: user.role === null,
    };
```

Replace with:

```typescript
    const tokenResult = await this.issueToken(user.id, user.email, user.role);
    return {
      ...tokenResult,
      user: { ...tokenResult.user, stellarWalletId: user.stellarWalletId ?? null },
      needsRoleSelection: user.role === null,
    };
```

- [ ] **Step 2: Verify types compile**

```bash
cd apps/api
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run existing auth tests to confirm no regression**

```bash
cd apps/api
npx jest auth.service.spec --no-coverage
```

Expected: all existing tests pass. (The mock user lacks `stellarWalletId` — Prisma returns `null` for missing fields, so `user.stellarWalletId ?? null` resolves cleanly.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts
git commit -m "feat(api): include stellarWalletId in googleLogin response"
```

---

## Task 5: Add env vars for passkey-kit / Launchtube

**Files:**
- Modify: `apps/api/.env.example` (root level, already has Stellar section)
- Modify: `apps/web/.env.example` or `apps/web/.env.local` (create if needed)

- [ ] **Step 1: Add backend env vars**

In `.env.example`, the Stellar section already has `STELLAR_NETWORK`, `STELLAR_HORIZON_URL`, `STELLAR_SECRET_KEY`. Add nothing to the backend — wallet creation is fully client-side; the backend needs no new env vars.

- [ ] **Step 2: Create web env vars**

Create or add to `apps/web/.env.local` (never commit this file — it holds the Launchtube JWT):

```env
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
# Get walletWasmHash from: https://github.com/kalepail/passkey-kit — check .env.example in the repo
NEXT_PUBLIC_STELLAR_WALLET_WASM_HASH=
# Get a free testnet JWT from: https://testnet.launchtube.xyz/gen (valid 3 months)
NEXT_PUBLIC_LAUNCHTUBE_URL=https://testnet.launchtube.xyz
NEXT_PUBLIC_LAUNCHTUBE_JWT=
```

- [ ] **Step 3: Add example entries to root .env.example**

In `.env.example`, add a Frontend section if one doesn't exist:

```env
# Frontend — Stellar / Passkey
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_WALLET_WASM_HASH=
NEXT_PUBLIC_LAUNCHTUBE_URL=https://testnet.launchtube.xyz
NEXT_PUBLIC_LAUNCHTUBE_JWT=
```

- [ ] **Step 4: Install passkey-kit in web app**

```bash
cd apps/web
npm install passkey-kit
```

Expected: `passkey-kit` appears in `apps/web/package.json` dependencies.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package-lock.json .env.example
git commit -m "feat(web): install passkey-kit and add Stellar/Launchtube env vars"
```

---

## Task 6: Frontend — passkey-client.ts

**Files:**
- Create: `apps/web/src/lib/wallet/passkey-client.ts`

- [ ] **Step 1: Create passkey-client.ts**

Create `apps/web/src/lib/wallet/passkey-client.ts`:

```typescript
import { PasskeyKit, PasskeyServer } from 'passkey-kit';

// Testnet network passphrase — hardcoded to avoid importing @stellar/stellar-sdk in the browser bundle
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

export class PasskeyAbortedError extends Error {
  constructor() {
    super('Passkey registration cancelled by user');
    this.name = 'PasskeyAbortedError';
  }
}

function getNetworkPassphrase(): string {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? MAINNET_PASSPHRASE
    : TESTNET_PASSPHRASE;
}

export async function registerAndDeployWallet(
  userEmail: string,
): Promise<{ contractId: string; keyId: string }> {
  const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL!;
  const walletWasmHash = process.env.NEXT_PUBLIC_STELLAR_WALLET_WASM_HASH!;

  const account = new PasskeyKit({
    rpcUrl,
    networkPassphrase: getNetworkPassphrase(),
    walletWasmHash,
  });

  let keyIdBase64: string;
  let contractId: string;
  let signedTx: string;

  try {
    const result = await account.createWallet('CredBridge', userEmail);
    keyIdBase64 = result.keyIdBase64;
    contractId = result.contractId;
    signedTx = result.signedTx;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      throw new PasskeyAbortedError();
    }
    throw err;
  }

  const server = new PasskeyServer({
    rpcUrl,
    launchtubeUrl: process.env.NEXT_PUBLIC_LAUNCHTUBE_URL!,
    launchtubeJwt: process.env.NEXT_PUBLIC_LAUNCHTUBE_JWT!,
  });

  await server.send(signedTx);

  return { contractId, keyId: keyIdBase64 };
}
```

> **Note:** If `PasskeyKit` or `PasskeyServer` TypeScript errors appear after install, check the actual export names with `node -e "console.log(Object.keys(require('passkey-kit')))"`. The `createWallet` return shape (`keyIdBase64`, `contractId`, `signedTx`) and `server.send()` method should be verified against the installed version's types in `node_modules/passkey-kit/dist/index.d.ts`.

- [ ] **Step 2: Verify types**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: no errors. If `passkey-kit` has no TypeScript types, add `// @ts-expect-error` above the import and re-check.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/wallet/passkey-client.ts
git commit -m "feat(web): add passkey-client with registerAndDeployWallet"
```

---

## Task 7: Frontend — wallet API hooks + update auth types

**Files:**
- Create: `apps/web/src/lib/api/wallet.ts`
- Modify: `apps/web/src/lib/api/auth.ts`

- [ ] **Step 1: Update AuthUser and GoogleAuthResponse**

In `apps/web/src/lib/api/auth.ts`, find the `AuthUser` interface and add `stellarWalletId`:

```typescript
export interface AuthUser {
  id: string;
  email: string;
  role: string | null;
  stellarWalletId?: string | null;
}
```

The `GoogleAuthResponse` extends `AuthResponse` which includes `user: AuthUser`, so no further change needed there.

- [ ] **Step 2: Create wallet.ts**

Create `apps/web/src/lib/api/wallet.ts`:

```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from './client';

interface WalletInfo {
  contractId: string;
  passkeyId: string;
}

interface CreateWalletInput {
  contractId: string;
  keyId: string;
}

export function useCreateWallet() {
  return useMutation({
    mutationFn: (input: CreateWalletInput) =>
      apiFetch<{ contractId: string }>('/wallet/create', {
        method: 'POST',
        body: input,
      }),
  });
}

export function useGetWallet() {
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () => apiFetch<WalletInfo | null>('/wallet'),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 3: Verify types**

```bash
cd apps/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api/wallet.ts apps/web/src/lib/api/auth.ts
git commit -m "feat(web): wallet API hooks and extend AuthUser with stellarWalletId"
```

---

## Task 8: WalletSetupBanner component

**Files:**
- Create: `apps/web/src/components/auth/WalletSetupBanner.tsx`

- [ ] **Step 1: Create the banner**

Create `apps/web/src/components/auth/WalletSetupBanner.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { Icon } from "@/components/primitives/Icon";
import { useGetWallet, useCreateWallet } from "@/lib/api/wallet";
import { registerAndDeployWallet, PasskeyAbortedError } from "@/lib/wallet/passkey-client";
import { useMe } from "@/lib/api/me";

export function WalletSetupBanner() {
  const { data: wallet, isLoading, refetch } = useGetWallet();
  const { data: me } = useMe();
  const createWallet = useCreateWallet();
  const [dismissed, setDismissed] = useState(false);
  const [setting, setSetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = useCallback(async () => {
    if (!me?.email) return;
    setSetting(true);
    setError(null);
    try {
      const { contractId, keyId } = await registerAndDeployWallet(me.email);
      await createWallet.mutateAsync({ contractId, keyId });
      await refetch();
    } catch (err) {
      if (err instanceof PasskeyAbortedError) {
        setDismissed(true);
        return;
      }
      setError("Erro ao configurar carteira. Tente novamente.");
    } finally {
      setSetting(false);
    }
  }, [me?.email, createWallet, refetch]);

  if (isLoading || wallet || dismissed) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        marginBottom: 24,
      }}
    >
      <span style={{ color: "var(--blue)", flexShrink: 0 }}>
        <Icon name="wallet" size={18} />
      </span>
      <span style={{ flex: 1, fontSize: 13.5 }}>
        {error ?? "Carteira Stellar não configurada."}
      </span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={handleSetup}
        disabled={setting}
        style={{ flexShrink: 0 }}
      >
        {setting ? "Configurando…" : "Configurar agora"}
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setDismissed(true)}
        style={{ flexShrink: 0, padding: "4px 8px" }}
        aria-label="Fechar"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
```

> **Note:** This uses `useMe` from `apps/web/src/lib/api/me.ts` (already exists) and the `wallet` icon from the Icon primitive. If the `wallet` or `x` icon names don't exist in the icon set, substitute with valid names from `apps/web/src/components/primitives/Icon.tsx`.

- [ ] **Step 2: Check the Icon primitive for valid icon names**

```bash
grep "case\|name\|wallet\|close\|x\b" /home/tiago-linux/projects/CredBridge/apps/web/src/components/primitives/Icon.tsx | head -30
```

Substitute any invalid icon names with ones that exist.

- [ ] **Step 3: Verify types**

```bash
cd apps/web
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/WalletSetupBanner.tsx
git commit -m "feat(web): WalletSetupBanner for users without Stellar wallet"
```

---

## Task 9: Frontend — KycFlow wallet creation (new user path)

**Files:**
- Modify: `apps/web/src/components/auth/KycFlow.tsx`

- [ ] **Step 1: Add wallet creation to handleFinish**

In `apps/web/src/components/auth/KycFlow.tsx`:

1. Add these imports at the top (after existing imports):

```tsx
import { registerAndDeployWallet, PasskeyAbortedError } from "@/lib/wallet/passkey-client";
import { useCreateWallet } from "@/lib/api/wallet";
import { useMe } from "@/lib/api/me";
```

2. Inside the `KycFlow` function body, after the `updateProfile` hook line, add:

```tsx
  const createWallet = useCreateWallet();
  const { data: me } = useMe();
```

3. Replace the existing `handleFinish` function:

```tsx
  const handleFinish = async () => {
    setError(null);
    try {
      await updateProfile.mutateAsync({
        name: name || undefined,
        phone: phone || undefined,
        companyName: companyName || undefined,
        cnpj: cnpj || undefined,
        monthlyRevenue: MONTHLY_REVENUE_MAP[revenueKey],
        sector,
      });
    } catch {
      setError("Erro ao salvar perfil. Tente novamente.");
      return;
    }

    try {
      const { contractId, keyId } = await registerAndDeployWallet(
        me?.email ?? 'credbridge-user',
      );
      await createWallet.mutateAsync({ contractId, keyId });
    } catch (err) {
      if (!(err instanceof PasskeyAbortedError)) {
        setError("Erro ao criar carteira. Você pode configurar depois no painel.");
      }
      // PasskeyAbortedError or network error: still proceed to dashboard
    }

    onDone();
  };
```

4. Update the "Ir para painel" button's `disabled` prop to also consider `createWallet.isPending`:

```tsx
          disabled={updateProfile.isPending || createWallet.isPending}
```

5. Update the button label to reflect wallet setup in progress:

```tsx
            {updateProfile.isPending || createWallet.isPending ? "Aguarde…" : "Ir para painel"}{" "}
            {!updateProfile.isPending && !createWallet.isPending && <Icon name="arrow_right" size={14} />}
```

- [ ] **Step 2: Verify types**

```bash
cd apps/web
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/auth/KycFlow.tsx
git commit -m "feat(web): trigger wallet creation at end of KYC onboarding"
```

---

## Task 10: Frontend — login page returning user wallet trigger

**Files:**
- Modify: `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Add wallet state and imports to login page**

In `apps/web/src/app/(auth)/login/page.tsx`, add these imports after the existing ones:

```tsx
import { registerAndDeployWallet, PasskeyAbortedError } from "@/lib/wallet/passkey-client";
import { useCreateWallet } from "@/lib/api/wallet";
```

Inside `LoginPage` component, after existing `useState`/hook calls, add:

```tsx
  const createWalletMutation = useCreateWallet();
  const [walletSetting, setWalletSetting] = useState(false);
```

- [ ] **Step 2: Update handleGoogleSuccess to trigger wallet setup**

Replace the existing `handleGoogleSuccess` callback:

```tsx
  const handleGoogleSuccess = useCallback(
    async (data: GoogleAuthResponse) => {
      setError(null);

      if (data.needsRoleSelection || !data.user.role) {
        router.push("/onboarding/role");
        return;
      }

      const r = data.user.role as RoleKey;
      const dest = r === "pme" ? "/pme/dashboard" : r === "investor" ? "/investor/dashboard" : "/";

      if (!data.user.stellarWalletId) {
        setWalletSetting(true);
        try {
          const { contractId, keyId } = await registerAndDeployWallet(data.user.email);
          await createWalletMutation.mutateAsync({ contractId, keyId });
        } catch (err) {
          if (!(err instanceof PasskeyAbortedError)) {
            setError("Erro ao configurar carteira Stellar. Você pode fazer isso depois no painel.");
          }
        } finally {
          setWalletSetting(false);
        }
      }

      router.push(dest);
    },
    [router, createWalletMutation],
  );
```

- [ ] **Step 3: Show loading state while wallet is setting up**

In the JSX, find the `GoogleSignInButton` render and add a loading indicator near it. After the `<GoogleSignInButton ... />` block, add:

```tsx
          {walletSetting && (
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--fg-2)", marginTop: 8 }}>
              Configurando sua carteira Stellar…
            </p>
          )}
```

- [ ] **Step 4: Verify types**

```bash
cd apps/web
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(auth)/login/page.tsx
git commit -m "feat(web): trigger wallet creation for returning Google users on login"
```

---

## Task 11: Add WalletSetupBanner to both dashboards

**Files:**
- Modify: `apps/web/src/app/(pme)/pme/dashboard/page.tsx`
- Modify: `apps/web/src/app/(investor)/investor/dashboard/page.tsx`

- [ ] **Step 1: Add banner to PME dashboard**

In `apps/web/src/app/(pme)/pme/dashboard/page.tsx`, add the import at the top:

```tsx
import { WalletSetupBanner } from "@/components/auth/WalletSetupBanner";
```

Find the outermost return JSX. Add `<WalletSetupBanner />` as the first child inside the main content container (the element that wraps `MiniKpi`, `Timeline`, etc.):

```tsx
      <WalletSetupBanner />
      {/* ... existing content ... */}
```

The exact insertion point: search for `<MiniKpi` in the file. Place `<WalletSetupBanner />` in the enclosing `div` immediately before that element.

- [ ] **Step 2: Add banner to investor dashboard**

In `apps/web/src/app/(investor)/investor/dashboard/page.tsx`, add the import:

```tsx
import { WalletSetupBanner } from "@/components/auth/WalletSetupBanner";
```

Apply the same pattern: place `<WalletSetupBanner />` before `<MiniKpi` in the investor dashboard JSX.

- [ ] **Step 3: Verify types**

```bash
cd apps/web
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(pme)/pme/dashboard/page.tsx \
        apps/web/src/app/(investor)/investor/dashboard/page.tsx
git commit -m "feat(web): add WalletSetupBanner to PME and investor dashboards"
```

---

## Spec self-review coverage check

| Spec requirement | Task |
|---|---|
| `stellarWalletId` + `passkeyId` added to User | Task 1 |
| `StellarWalletService.createWallet()` idempotent | Task 2 + tested in Task 3 |
| `GET /wallet` endpoint | Task 2 |
| `POST /wallet/create` endpoint | Task 2 |
| `googleLogin` response includes `stellarWalletId` | Task 4 |
| `passkey-client.ts` with `registerAndDeployWallet` | Task 6 |
| `PasskeyAbortedError` for user cancel | Task 6 |
| React Query hooks for wallet | Task 7 |
| `AuthUser` updated with `stellarWalletId` | Task 7 |
| Wallet creation at end of KycFlow (new users) | Task 9 |
| Wallet creation after Google login (returning users) | Task 10 |
| Dashboard banner when wallet missing | Tasks 8 + 11 |
| Loading state during wallet setup | Tasks 9 + 10 |

---

## Manual testnet verification checklist

After all tasks are complete:

1. Get `NEXT_PUBLIC_STELLAR_WALLET_WASM_HASH` from `https://github.com/kalepail/passkey-kit` (check `.env.example` or README)
2. Get `NEXT_PUBLIC_LAUNCHTUBE_JWT` from `https://testnet.launchtube.xyz/gen`
3. Set both values in `apps/web/.env.local`
4. Start API: `cd apps/api && npm run start:dev`
5. Start web: `cd apps/web && npm run dev`
6. Open Chrome with a logged-in Google account
7. Sign in with Google → passkey prompt appears → save in Google Password Manager
8. Verify: `POST /wallet/create` logged in API console, returns `contractId` starting with `C`
9. Verify: User row in DB has `stellarWalletId` populated
10. Sign in again → no passkey prompt, goes directly to dashboard
11. Cancel passkey prompt on fresh account → dashboard banner appears with "Configurar agora"
12. Click "Configurar agora" in banner → passkey prompt re-appears → wallet created
