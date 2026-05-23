# Privy Authentication And Stellar Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the user-facing CredBridge login with Privy authentication and provision a Privy-owned Stellar embedded wallet before exchanging the authenticated Privy session for the existing NestJS internal JWT.

**Architecture:** The Next.js client renders `PrivyProvider`, launches Privy's login UI, manually creates a Stellar embedded wallet after authentication, and sends Privy access and identity tokens to a new NestJS session-exchange endpoint. NestJS verifies both signed Privy tokens, links or creates the local `User` by verified Privy DID/email, stores the verified Privy Stellar address separately from the existing Soroban passkey smart-account fields, and issues the existing internal JWT for application APIs.

**Tech Stack:** Next.js 16 App Router, React 19, `@privy-io/react-auth`, NestJS 11, `@privy-io/node`, Prisma 7, Jest, TanStack Query.

**Reference Specs:** `docs/superpowers/specs/2026-05-14-google-oauth-login-design.md`, `docs/superpowers/specs/2026-05-20-smart-account-financial-auth-design.md`

---

## Scope And Safety Boundary

Target flow:

```text
Privy Login
    -> Privy authenticates the user
    -> Frontend creates a Privy Stellar embedded wallet when absent
    -> Frontend obtains Privy access token + identity token
    -> Frontend calls POST /v1/auth/privy/session
    -> NestJS verifies both Privy tokens
    -> NestJS creates or updates local User
    -> NestJS returns CredBridge internal JWT
```

This plan intentionally does **not** replace financial-action authorization yet:

- The implemented financial flow currently verifies WebAuthn assertions from the Soroban smart account stored in `stellarWalletId`, `passkeyId`, `passkeyPublicKey`, `walletType`, and `walletStatus`.
- Privy's Stellar support provides embedded wallet abstractions and raw signing, but it is not the existing `passkey-kit` Soroban smart-account contract.
- This delivery stores Privy's wallet in new `privyStellarWalletAddress` fields and leaves legacy smart-account fields untouched. A later plan must decide whether financial actions continue using the Soroban smart account or migrate to Privy Stellar raw-sign transaction verification.
- Privy owns embedded-wallet key management in this flow. CredBridge persists only verified identifiers and wallet addresses; it does not receive or store a Privy private key.

Privy implementation references to consult during execution:

- `https://docs.privy.io/basics/react/setup`
- `https://docs.privy.io/authentication/user-authentication/access-tokens`
- `https://docs.privy.io/user-management/users/identity-tokens`
- `https://docs.privy.io/wallets/wallets/create/create-a-wallet`
- `https://docs.privy.io/wallets/overview/chains`
- `https://docs.privy.io/recipes/react/whitelabel`

Next.js 16 local references already present in this repository:

- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`

## File Structure

Backend authentication owns Privy token verification and local session exchange:

```text
apps/api/src/modules/auth/
  auth.controller.ts                         # add POST /auth/privy/session
  auth.module.ts                             # register Privy providers
  auth.service.ts                            # upsert local user and issue JWT
  auth.service.spec.ts                       # session-exchange unit tests
  privy-auth.service.ts                      # verify Privy access/identity tokens
  privy-auth.service.spec.ts                 # provider boundary unit tests
  privy-client.provider.ts                   # construct @privy-io/node client
```

Persist Privy identity and wallet separately from current smart-account authorization:

```text
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/20260523120000_add_privy_identity_wallet/migration.sql
```

Frontend authentication is a client-provider plus a narrow bootstrap hook:

```text
apps/web/src/providers/PrivyAuthProvider.tsx          # Privy SDK boundary
apps/web/src/lib/api/privy-session.ts                 # session exchange call
apps/web/src/hooks/usePrivySessionBootstrap.ts        # create wallet then exchange session
apps/web/src/hooks/usePrivySessionBootstrap.spec.ts    # wallet/session orchestration tests
apps/web/src/components/auth/PrivyLoginPanel.tsx      # login/status/error UI
apps/web/src/components/auth/PrivyLoginPanel.spec.tsx # login and redirect tests
apps/web/src/app/layout.tsx                           # mount provider
apps/web/src/app/(auth)/login/page.tsx                # use Privy panel
apps/web/src/components/auth/KycFlow.tsx              # stop auto passkey creation after signup
apps/web/src/components/auth/WalletSetupBanner.tsx    # clarify remaining smart-account setup
apps/web/src/test/setup.ts                            # DOM assertions
apps/web/vitest.config.ts                             # frontend test runner
```

Configuration and documentation:

```text
.env.example
apps/web/.env.local.example
documentacao/fluxo-login-atual.md
documentacao/smart-wallet-fluxo-regras.md
```

Legacy files retained in the first rollout but no longer reachable from the login UI:

```text
apps/web/src/providers/GoogleAuthProvider.tsx
apps/web/src/components/auth/GoogleSignInButton.tsx
apps/web/src/lib/api/auth.ts                           # email/Google hooks retained temporarily
apps/api/src/modules/auth/dto/google-login.dto.ts
apps/api/src/modules/auth/dto/login.dto.ts
apps/api/src/modules/auth/dto/register.dto.ts
```

---

### Task 1: Add Privy Configuration And Separate Persistence Fields

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/test/setup.ts`
- Modify: `.env.example`
- Modify: `apps/web/.env.local.example`
- Modify: `apps/api/prisma/schema.prisma:55`
- Create: `apps/api/prisma/migrations/20260523120000_add_privy_identity_wallet/migration.sql`

- [ ] **Step 1: Add SDK dependencies**

Run:

```bash
npm install -w apps/api @privy-io/node
npm install -w apps/web @privy-io/react-auth
npm install -D -w apps/web vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `package-lock.json`, `apps/api/package.json`, and `apps/web/package.json` include the Privy SDK packages and the frontend test dependencies without removing the existing Google/passkey dependencies during the migration rollout.

- [ ] **Step 2: Add the web test script and configuration**

Add this script to `apps/web/package.json`:

```json
"test": "vitest run"
```

Create `apps/web/vitest.config.ts`:

```ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

Create `apps/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add environment examples**

Append to `.env.example`:

```env
# Privy authentication and embedded Stellar wallet
PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_JWT_VERIFICATION_KEY=
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_PRIVY_CLIENT_ID=
```

Append to `apps/web/.env.local.example`:

```env
# Privy authentication and embedded Stellar wallet
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_PRIVY_CLIENT_ID=
```

Expected: only `NEXT_PUBLIC_*` Privy values are exposed to the browser; `PRIVY_APP_SECRET` and `PRIVY_JWT_VERIFICATION_KEY` remain backend-only.

- [ ] **Step 4: Extend the Prisma user model without overwriting smart-account fields**

Add these fields to `User` immediately after `provider` in `apps/api/prisma/schema.prisma`:

```prisma
  privyUserId               String?  @unique
  privyStellarWalletAddress String?  @unique
  privyWalletStatus         String?
```

The existing fields remain unchanged because they still serve financial WebAuthn authorization:

```prisma
  stellarWalletId       String?
  passkeyId             String?
  passkeyPublicKey      String?
  walletType            String?
  walletStatus          String?
```

- [ ] **Step 5: Add the SQL migration**

Create `apps/api/prisma/migrations/20260523120000_add_privy_identity_wallet/migration.sql`:

```sql
ALTER TABLE "User"
ADD COLUMN "privyUserId" TEXT,
ADD COLUMN "privyStellarWalletAddress" TEXT,
ADD COLUMN "privyWalletStatus" TEXT;

CREATE UNIQUE INDEX "User_privyUserId_key" ON "User"("privyUserId");
CREATE UNIQUE INDEX "User_privyStellarWalletAddress_key" ON "User"("privyStellarWalletAddress");
```

- [ ] **Step 6: Generate Prisma types**

Run:

```bash
npm run build -w apps/api
```

Expected: Prisma generation succeeds; if TypeScript reports only not-yet-added Privy imports referenced after subsequent edits, complete Tasks 2 and 3 before re-running the full build.

- [ ] **Step 7: Commit configuration and schema**

```bash
git add package-lock.json apps/api/package.json apps/web/package.json apps/web/vitest.config.ts apps/web/src/test/setup.ts .env.example apps/web/.env.local.example apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260523120000_add_privy_identity_wallet/migration.sql
git commit -m "feat(auth): add Privy identity persistence"
```

---

### Task 2: Verify Privy Tokens Behind A Focused NestJS Service

**Files:**
- Create: `apps/api/src/modules/auth/privy-client.provider.ts`
- Create: `apps/api/src/modules/auth/privy-auth.service.ts`
- Create: `apps/api/src/modules/auth/privy-auth.service.spec.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts:1`

- [ ] **Step 1: Write the failing unit tests for token verification and identity extraction**

Create `apps/api/src/modules/auth/privy-auth.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PRIVY_CLIENT, PrivyClientPort } from './privy-client.provider';
import { PrivyAuthService } from './privy-auth.service';

describe('PrivyAuthService', () => {
  let service: PrivyAuthService;
  const clientMock: PrivyClientPort = {
    utils: () => ({
      auth: () => ({
        verifyAuthToken: jest.fn().mockResolvedValue({ userId: 'did:privy:user-1' }),
      }),
    }),
    users: () => ({
      get: jest.fn().mockResolvedValue({
        id: 'did:privy:user-1',
        linkedAccounts: [
          { type: 'email', address: 'owner@empresa.com' },
          { type: 'wallet', chainType: 'stellar', address: 'GPRIVYWALLET' },
        ],
      }),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivyAuthService,
        { provide: PRIVY_CLIENT, useValue: clientMock },
      ],
    }).compile();

    service = module.get(PrivyAuthService);
  });

  it('returns verified email and Stellar wallet from matching Privy tokens', async () => {
    await expect(service.verifySession('access-token', 'identity-token')).resolves.toEqual({
      privyUserId: 'did:privy:user-1',
      email: 'owner@empresa.com',
      stellarWalletAddress: 'GPRIVYWALLET',
    });
  });

  it('rejects identity tokens that do not belong to the authenticated session', async () => {
    const mismatchedClient: PrivyClientPort = {
      ...clientMock,
      users: () => ({
        get: jest.fn().mockResolvedValue({
          id: 'did:privy:other-user',
          linkedAccounts: [{ type: 'email', address: 'other@empresa.com' }],
        }),
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        PrivyAuthService,
        { provide: PRIVY_CLIENT, useValue: mismatchedClient },
      ],
    }).compile();

    await expect(
      module.get(PrivyAuthService).verifySession('access-token', 'identity-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects sessions without a verified email login method', async () => {
    const walletOnlyClient: PrivyClientPort = {
      ...clientMock,
      users: () => ({
        get: jest.fn().mockResolvedValue({
          id: 'did:privy:user-1',
          linkedAccounts: [{ type: 'wallet', chainType: 'stellar', address: 'GPRIVYWALLET' }],
        }),
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        PrivyAuthService,
        { provide: PRIVY_CLIENT, useValue: walletOnlyClient },
      ],
    }).compile();

    await expect(
      module.get(PrivyAuthService).verifySession('access-token', 'identity-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects sessions until a Stellar embedded wallet is linked', async () => {
    const noWalletClient: PrivyClientPort = {
      ...clientMock,
      users: () => ({
        get: jest.fn().mockResolvedValue({
          id: 'did:privy:user-1',
          linkedAccounts: [{ type: 'email', address: 'owner@empresa.com' }],
        }),
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        PrivyAuthService,
        { provide: PRIVY_CLIENT, useValue: noWalletClient },
      ],
    }).compile();

    await expect(
      module.get(PrivyAuthService).verifySession('access-token', 'identity-token'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts the verified email exposed by a Google OAuth login account', async () => {
    const googleClient: PrivyClientPort = {
      ...clientMock,
      users: () => ({
        get: jest.fn().mockResolvedValue({
          id: 'did:privy:user-1',
          linkedAccounts: [
            { type: 'google_oauth', email: 'google@empresa.com' },
            { type: 'wallet', chainType: 'stellar', address: 'GPRIVYWALLET' },
          ],
        }),
      }),
    };
    const module = await Test.createTestingModule({
      providers: [
        PrivyAuthService,
        { provide: PRIVY_CLIENT, useValue: googleClient },
      ],
    }).compile();

    await expect(
      module.get(PrivyAuthService).verifySession('access-token', 'identity-token'),
    ).resolves.toMatchObject({ email: 'google@empresa.com' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -w apps/api -- privy-auth.service.spec.ts --runInBand
```

Expected: FAIL because `privy-client.provider.ts` and `PrivyAuthService` do not exist.

- [ ] **Step 3: Create an injectable Privy client port and provider**

Create `apps/api/src/modules/auth/privy-client.provider.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { PrivyClient } from '@privy-io/node';

export const PRIVY_CLIENT = Symbol('PRIVY_CLIENT');

interface VerifiedPrivyClaims {
  userId: string;
}

export interface PrivyLinkedAccount {
  type?: string;
  address?: string;
  email?: string;
  chainType?: string;
  chain_type?: string;
}

export interface PrivyUserRecord {
  id: string;
  linkedAccounts?: PrivyLinkedAccount[];
}

export interface PrivyClientPort {
  utils(): {
    auth(): {
      verifyAuthToken(authToken: string): Promise<VerifiedPrivyClaims>;
    };
  };
  users(): {
    get(input: { id_token: string }): Promise<PrivyUserRecord>;
  };
}

export const privyClientProvider = {
  provide: PRIVY_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): PrivyClientPort => {
    const appId = config.get<string>('PRIVY_APP_ID');
    const appSecret = config.get<string>('PRIVY_APP_SECRET');

    if (!appId || !appSecret) {
      throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET must be configured');
    }

    return new PrivyClient({
      appId,
      appSecret,
      jwtVerificationKey: config.get<string>('PRIVY_JWT_VERIFICATION_KEY') || undefined,
    }) as unknown as PrivyClientPort;
  },
};
```

- [ ] **Step 4: Implement the verification boundary**

Create `apps/api/src/modules/auth/privy-auth.service.ts`:

```ts
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PRIVY_CLIENT, PrivyClientPort, PrivyLinkedAccount } from './privy-client.provider';

export interface VerifiedPrivySession {
  privyUserId: string;
  email: string;
  stellarWalletAddress: string;
}

@Injectable()
export class PrivyAuthService {
  constructor(@Inject(PRIVY_CLIENT) private readonly privyClient: PrivyClientPort) {}

  async verifySession(accessToken: string, identityToken: string): Promise<VerifiedPrivySession> {
    try {
      const claims = await this.privyClient.utils().auth().verifyAuthToken(accessToken);
      const identity = await this.privyClient.users().get({ id_token: identityToken });

      if (claims.userId !== identity.id) {
        throw new UnauthorizedException('Privy tokens belong to different users');
      }

      const linkedAccounts = identity.linkedAccounts ?? [];
      const email = this.findEmailAddress(linkedAccounts);
      if (!email) {
        throw new UnauthorizedException('Privy account must have a verified email address');
      }
      const stellarWalletAddress = this.findStellarWalletAddress(linkedAccounts);
      if (!stellarWalletAddress) {
        throw new UnauthorizedException('Privy Stellar wallet must be created before session exchange');
      }

      return {
        privyUserId: claims.userId,
        email,
        stellarWalletAddress,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Privy session');
    }
  }

  private findEmailAddress(accounts: PrivyLinkedAccount[]): string | null {
    const emailAccount = accounts.find(
      (account) => account.type === 'email' && typeof account.address === 'string',
    );
    if (emailAccount?.address) {
      return emailAccount.address.toLowerCase();
    }

    const googleAccount = accounts.find(
      (account) => account.type === 'google_oauth' && typeof account.email === 'string',
    );
    return googleAccount?.email?.toLowerCase() ?? null;
  }

  private findStellarWalletAddress(accounts: PrivyLinkedAccount[]): string | null {
    const walletAccount = accounts.find(
      (account) =>
        account.type === 'wallet' &&
        (account.chainType === 'stellar' || account.chain_type === 'stellar') &&
        typeof account.address === 'string',
    );
    return walletAccount?.address ?? null;
  }
}
```

- [ ] **Step 5: Register the new providers**

In `apps/api/src/modules/auth/auth.module.ts`, add imports:

```ts
import { PrivyAuthService } from './privy-auth.service';
import { privyClientProvider } from './privy-client.provider';
```

Replace the providers and exports arrays with:

```ts
  providers: [AuthService, JwtStrategy, JwtAuthGuard, PrivyAuthService, privyClientProvider],
  exports: [AuthService, JwtAuthGuard, JwtStrategy, PassportModule],
```

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
npm test -w apps/api -- privy-auth.service.spec.ts --runInBand
```

Expected: PASS for valid matching tokens, mismatched identities, and email-less accounts.

- [ ] **Step 7: Commit the token verification boundary**

```bash
git add apps/api/src/modules/auth/privy-client.provider.ts apps/api/src/modules/auth/privy-auth.service.ts apps/api/src/modules/auth/privy-auth.service.spec.ts apps/api/src/modules/auth/auth.module.ts
git commit -m "feat(api): verify Privy sessions"
```

---

### Task 3: Exchange Verified Privy Sessions For Internal JWTs

**Files:**
- Modify: `apps/api/src/modules/auth/auth.controller.ts:1`
- Modify: `apps/api/src/modules/auth/auth.service.ts:1`
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts:1`

- [ ] **Step 1: Add failing AuthService tests for local user linking and creation**

Add imports to `apps/api/src/modules/auth/auth.service.spec.ts`:

```ts
import { PrivyAuthService } from './privy-auth.service';
```

Add the mock beside `prismaMock`:

```ts
const privyAuthMock = {
  verifySession: jest.fn(),
};
```

Add this provider to the testing module:

```ts
{ provide: PrivyAuthService, useValue: privyAuthMock },
```

Add this test block:

```ts
  describe('privySession', () => {
    beforeEach(() => {
      privyAuthMock.verifySession.mockResolvedValue({
        privyUserId: 'did:privy:user-1',
        email: 'test@example.com',
        stellarWalletAddress: 'GPRIVYWALLET',
      });
    });

    it('creates a new local user from a verified Privy identity', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValue({
        ...mockUser,
        provider: 'privy',
        privyUserId: 'did:privy:user-1',
        privyStellarWalletAddress: 'GPRIVYWALLET',
        privyWalletStatus: 'ready',
        role: null,
      });

      const result = await service.privySession('access-token', 'identity-token');

      expect(privyAuthMock.verifySession).toHaveBeenCalledWith('access-token', 'identity-token');
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          provider: 'privy',
          privyUserId: 'did:privy:user-1',
          privyStellarWalletAddress: 'GPRIVYWALLET',
          privyWalletStatus: 'ready',
          role: null,
        },
      });
      expect(result.needsRoleSelection).toBe(true);
    });

    it('links an existing email user after Privy verifies the same email', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockUser, privyUserId: null });
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        provider: 'privy',
        privyUserId: 'did:privy:user-1',
        privyStellarWalletAddress: 'GPRIVYWALLET',
        privyWalletStatus: 'ready',
      });

      await service.privySession('access-token', 'identity-token');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          provider: 'privy',
          privyUserId: 'did:privy:user-1',
          privyStellarWalletAddress: 'GPRIVYWALLET',
          privyWalletStatus: 'ready',
        },
      });
    });
  });
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run:

```bash
npm test -w apps/api -- auth.service.spec.ts --runInBand
```

Expected: FAIL because `AuthService` does not inject `PrivyAuthService` or expose `privySession`.

- [ ] **Step 3: Inject Privy verification and add the session exchange method**

Add the import in `apps/api/src/modules/auth/auth.service.ts`:

```ts
import { PrivyAuthService } from './privy-auth.service';
```

Add `privyAuth` to the constructor:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly privyAuth: PrivyAuthService,
  ) {
```

Add this method before `setRole`:

```ts
  async privySession(accessToken: string, identityToken: string) {
    const identity = await this.privyAuth.verifySession(accessToken, identityToken);
    const walletData = {
      privyStellarWalletAddress: identity.stellarWalletAddress,
      privyWalletStatus: 'ready',
    };

    let user = await this.prisma.user.findUnique({
      where: { privyUserId: identity.privyUserId },
    });

    if (!user) {
      const existingEmailUser = await this.prisma.user.findUnique({
        where: { email: identity.email },
      });

      if (existingEmailUser) {
        user = await this.prisma.user.update({
          where: { id: existingEmailUser.id },
          data: {
            provider: 'privy',
            privyUserId: identity.privyUserId,
            ...walletData,
          },
        });
      } else {
        user = await this.prisma.user.create({
          data: {
            email: identity.email,
            provider: 'privy',
            privyUserId: identity.privyUserId,
            ...walletData,
            role: null,
          },
        });
      }
    } else if (
      user.privyStellarWalletAddress !== walletData.privyStellarWalletAddress ||
      user.privyWalletStatus !== walletData.privyWalletStatus
    ) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: walletData,
      });
    }

    const tokenResult = await this.issueToken(user.id, user.email, user.role);
    return {
      ...tokenResult,
      user: {
        ...tokenResult.user,
        privyStellarWalletAddress: user.privyStellarWalletAddress ?? null,
      },
      needsRoleSelection: user.role === null,
    };
  }
```

Add the new fields to `userSelect`:

```ts
    privyUserId: true,
    privyStellarWalletAddress: true,
    privyWalletStatus: true,
```

- [ ] **Step 4: Expose the controller endpoint with both tokens required**

Add `Headers` to the import in `apps/api/src/modules/auth/auth.controller.ts`:

```ts
import { Controller, Post, Get, Patch, Body, Headers, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
```

Add this method after `googleLogin`:

```ts
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('privy/session')
  privySession(
    @Headers('authorization') authorization: string | undefined,
    @Headers('privy-id-token') identityToken: string | undefined,
  ) {
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : null;

    if (!accessToken || !identityToken) {
      throw new UnauthorizedException('Privy session tokens are required');
    }

    return this.authService.privySession(accessToken, identityToken);
  }
```

- [ ] **Step 5: Run the AuthService tests**

Run:

```bash
npm test -w apps/api -- auth.service.spec.ts privy-auth.service.spec.ts --runInBand
```

Expected: PASS; new users are created with `role: null`, verified existing emails are linked, and no Privy wallet value is placed in the passkey smart-account fields.

- [ ] **Step 6: Commit backend session exchange**

```bash
git add apps/api/src/modules/auth/auth.controller.ts apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.service.spec.ts
git commit -m "feat(api): exchange Privy sessions for JWT"
```

---

### Task 4: Mount Privy In The Next.js Client Provider Tree

**Files:**
- Create: `apps/web/src/providers/PrivyAuthProvider.tsx`
- Modify: `apps/web/src/app/layout.tsx:4`

- [ ] **Step 1: Create the client-only Privy provider**

Create `apps/web/src/providers/PrivyAuthProvider.tsx`:

```tsx
"use client";

import { PrivyProvider } from "@privy-io/react-auth";

interface PrivyAuthProviderProps {
  children: React.ReactNode;
}

export function PrivyAuthProvider({ children }: PrivyAuthProviderProps) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID must be configured");
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        loginMethods: ["email", "google"],
        embeddedWallets: {
          showWalletUIs: false,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

Implementation note: do not configure `createOnLogin` here. Privy's documented automatic React wallet creation covers Ethereum/Solana, while CredBridge needs a Stellar wallet and creates it explicitly in Task 5.

- [ ] **Step 2: Replace the Google-only provider in the root layout**

In `apps/web/src/app/layout.tsx`, replace:

```tsx
import { GoogleAuthProvider } from "@/providers/GoogleAuthProvider";
```

with:

```tsx
import { PrivyAuthProvider } from "@/providers/PrivyAuthProvider";
```

Replace the provider JSX:

```tsx
            <GoogleAuthProvider>{children}</GoogleAuthProvider>
```

with:

```tsx
            <PrivyAuthProvider>{children}</PrivyAuthProvider>
```

- [ ] **Step 3: Validate the Next.js provider boundary**

Run:

```bash
npm run build -w apps/web
```

Expected: Next.js builds with `app/layout.tsx` remaining a Server Component and the Privy SDK isolated behind the `"use client"` provider component. Running the web app without `NEXT_PUBLIC_PRIVY_APP_ID` fails immediately with an actionable configuration error instead of rendering login outside a Privy context.

- [ ] **Step 4: Commit the provider**

```bash
git add apps/web/src/providers/PrivyAuthProvider.tsx apps/web/src/app/layout.tsx
git commit -m "feat(web): mount Privy authentication provider"
```

---

### Task 5: Create The Privy Stellar Wallet Then Exchange The Session

**Files:**
- Create: `apps/web/src/lib/api/privy-session.ts`
- Create: `apps/web/src/hooks/usePrivySessionBootstrap.ts`
- Create: `apps/web/src/hooks/usePrivySessionBootstrap.spec.ts`

- [ ] **Step 1: Write failing tests for wallet provisioning and session exchange**

Create `apps/web/src/hooks/usePrivySessionBootstrap.spec.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIdentityToken, usePrivy, useUser } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import { exchangePrivySession } from "@/lib/api/privy-session";
import { usePrivySessionBootstrap } from "./usePrivySessionBootstrap";

vi.mock("@privy-io/react-auth", () => ({
  getIdentityToken: vi.fn(),
  usePrivy: vi.fn(),
  useUser: vi.fn(),
}));
vi.mock("@privy-io/react-auth/extended-chains", () => ({
  useCreateWallet: vi.fn(),
}));
vi.mock("@/lib/api/privy-session", () => ({
  exchangePrivySession: vi.fn(),
}));

describe("usePrivySessionBootstrap", () => {
  const getAccessToken = vi.fn();
  const refreshUser = vi.fn();
  const createWallet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePrivy).mockReturnValue({ getAccessToken } as ReturnType<typeof usePrivy>);
    vi.mocked(useUser).mockReturnValue({
      user: { linkedAccounts: [] },
      refreshUser,
    } as unknown as ReturnType<typeof useUser>);
    vi.mocked(useCreateWallet).mockReturnValue({ createWallet } as ReturnType<typeof useCreateWallet>);
    getAccessToken.mockResolvedValue("privy-access-token");
    vi.mocked(getIdentityToken).mockResolvedValue("privy-identity-token");
    vi.mocked(exchangePrivySession).mockResolvedValue({
      accessToken: "internal-jwt",
      needsRoleSelection: true,
      user: {
        id: "user-1",
        email: "owner@empresa.com",
        role: null,
        privyStellarWalletAddress: "GPRIVYWALLET",
      },
    });
  });

  it("creates a Stellar wallet before exchanging a session when none exists", async () => {
    const { result } = renderHook(() => usePrivySessionBootstrap());

    await act(async () => {
      await result.current.bootstrapSession();
    });

    expect(createWallet).toHaveBeenCalledWith({ chainType: "stellar" });
    expect(refreshUser).toHaveBeenCalled();
    expect(exchangePrivySession).toHaveBeenCalledWith(
      "privy-access-token",
      "privy-identity-token",
    );
    expect(createWallet.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(exchangePrivySession).mock.invocationCallOrder[0],
    );
  });

  it("does not create another Stellar wallet for an already provisioned user", async () => {
    vi.mocked(useUser).mockReturnValue({
      user: {
        linkedAccounts: [{ type: "wallet", chainType: "stellar", address: "GEXISTING" }],
      },
      refreshUser,
    } as unknown as ReturnType<typeof useUser>);
    const { result } = renderHook(() => usePrivySessionBootstrap());

    await act(async () => {
      await result.current.bootstrapSession();
    });

    expect(createWallet).not.toHaveBeenCalled();
    expect(exchangePrivySession).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -w apps/web -- src/hooks/usePrivySessionBootstrap.spec.ts
```

Expected: FAIL because `usePrivySessionBootstrap.ts` and `privy-session.ts` do not exist.

- [ ] **Step 3: Add the typed session-exchange client**

Create `apps/web/src/lib/api/privy-session.ts`:

```ts
import { apiFetch } from "./client";
import { setAccessToken } from "./auth-storage";

export interface PrivySessionUser {
  id: string;
  email: string;
  role: "pme" | "investor" | null;
  privyStellarWalletAddress: string | null;
}

export interface PrivySessionResponse {
  accessToken: string;
  user: PrivySessionUser;
  needsRoleSelection: boolean;
}

export async function exchangePrivySession(
  accessToken: string,
  identityToken: string,
): Promise<PrivySessionResponse> {
  const session = await apiFetch<PrivySessionResponse>("/auth/privy/session", {
    method: "POST",
    skipAuth: true,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "privy-id-token": identityToken,
    },
  });

  setAccessToken(session.accessToken);
  return session;
}
```

- [ ] **Step 4: Implement the login bootstrap hook**

Create `apps/web/src/hooks/usePrivySessionBootstrap.ts`:

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import { getIdentityToken, usePrivy, useUser } from "@privy-io/react-auth";
import { useCreateWallet } from "@privy-io/react-auth/extended-chains";
import { exchangePrivySession, type PrivySessionResponse } from "@/lib/api/privy-session";

interface LinkedAccount {
  type?: string;
  address?: string;
  chainType?: string;
  chain_type?: string;
}

function hasStellarWallet(linkedAccounts: LinkedAccount[] | undefined): boolean {
  return (
    linkedAccounts?.some(
      (account) =>
        account.type === "wallet" &&
        (account.chainType === "stellar" || account.chain_type === "stellar") &&
        typeof account.address === "string",
    ) ?? false
  );
}

export function usePrivySessionBootstrap() {
  const { getAccessToken } = usePrivy();
  const { user, refreshUser } = useUser();
  const { createWallet } = useCreateWallet();
  const isRunningRef = useRef(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bootstrapSession = useCallback(async (): Promise<PrivySessionResponse> => {
    if (isRunningRef.current) {
      throw new Error("Privy session bootstrap is already running");
    }

    isRunningRef.current = true;
    setIsBootstrapping(true);
    setError(null);

    try {
      if (!hasStellarWallet(user?.linkedAccounts as LinkedAccount[] | undefined)) {
        await createWallet({ chainType: "stellar" });
        await refreshUser();
      }

      const [accessToken, identityToken] = await Promise.all([
        getAccessToken(),
        getIdentityToken(),
      ]);

      if (!accessToken || !identityToken) {
        throw new Error("Privy did not provide the required session tokens");
      }

      return await exchangePrivySession(accessToken, identityToken);
    } catch (bootstrapError) {
      const message =
        bootstrapError instanceof Error
          ? bootstrapError.message
          : "Não foi possível iniciar sua sessão.";
      setError(message);
      throw bootstrapError;
    } finally {
      isRunningRef.current = false;
      setIsBootstrapping(false);
    }
  }, [createWallet, getAccessToken, refreshUser, user?.linkedAccounts]);

  return { bootstrapSession, isBootstrapping, error };
}
```

- [ ] **Step 5: Run the wallet bootstrap tests and type-check the SDK integration**

Run:

```bash
npm test -w apps/web -- src/hooks/usePrivySessionBootstrap.spec.ts
npm run build -w apps/web
```

Expected: PASS; tests prove wallet creation happens before exchange only when needed, and the build resolves `createWallet({ chainType: "stellar" })`, `getAccessToken()`, `getIdentityToken()`, and `refreshUser()` from the installed Privy SDK.

- [ ] **Step 6: Commit session bootstrap**

```bash
git add apps/web/src/lib/api/privy-session.ts apps/web/src/hooks/usePrivySessionBootstrap.ts apps/web/src/hooks/usePrivySessionBootstrap.spec.ts
git commit -m "feat(web): bootstrap Privy Stellar session"
```

---

### Task 6: Replace User-Facing Login Controls With Privy

**Files:**
- Create: `apps/web/src/components/auth/PrivyLoginPanel.tsx`
- Create: `apps/web/src/components/auth/PrivyLoginPanel.spec.tsx`
- Modify: `apps/web/src/app/(auth)/login/page.tsx:3`
- Modify: `apps/web/src/lib/api/auth-storage.ts:1`

- [ ] **Step 1: Write failing tests for login launch and automatic continuation**

Create `apps/web/src/components/auth/PrivyLoginPanel.spec.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { usePrivySessionBootstrap } from "@/hooks/usePrivySessionBootstrap";
import { PrivyLoginPanel } from "./PrivyLoginPanel";

vi.mock("@privy-io/react-auth", () => ({
  useLogin: vi.fn(),
  usePrivy: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));
vi.mock("@/hooks/usePrivySessionBootstrap", () => ({
  usePrivySessionBootstrap: vi.fn(),
}));

describe("PrivyLoginPanel", () => {
  const login = vi.fn();
  const logout = vi.fn();
  const push = vi.fn();
  const bootstrapSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useLogin).mockReturnValue({ login } as unknown as ReturnType<typeof useLogin>);
    vi.mocked(usePrivySessionBootstrap).mockReturnValue({
      bootstrapSession,
      isBootstrapping: false,
      error: null,
    });
    bootstrapSession.mockResolvedValue({
      accessToken: "internal-jwt",
      needsRoleSelection: false,
      user: {
        id: "user-1",
        email: "owner@empresa.com",
        role: "pme",
        privyStellarWalletAddress: "GPRIVYWALLET",
      },
    });
  });

  it("opens Privy login when the visitor is not authenticated", async () => {
    vi.mocked(usePrivy).mockReturnValue({
      ready: true,
      authenticated: false,
      logout,
    } as unknown as ReturnType<typeof usePrivy>);
    render(<PrivyLoginPanel />);

    await userEvent.click(screen.getByRole("button", { name: /entrar com privy/i }));

    expect(login).toHaveBeenCalled();
    expect(bootstrapSession).not.toHaveBeenCalled();
  });

  it("automatically exchanges the session and routes after Privy authenticates", async () => {
    vi.mocked(usePrivy).mockReturnValue({
      ready: true,
      authenticated: true,
      logout,
    } as unknown as ReturnType<typeof usePrivy>);
    render(<PrivyLoginPanel />);

    await waitFor(() => expect(bootstrapSession).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/pme/dashboard");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -w apps/web -- src/components/auth/PrivyLoginPanel.spec.tsx
```

Expected: FAIL because `PrivyLoginPanel.tsx` does not exist.

- [ ] **Step 3: Add a focused Privy login panel**

Create `apps/web/src/components/auth/PrivyLoginPanel.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { Icon } from "@/components/primitives/Icon";
import { usePrivySessionBootstrap } from "@/hooks/usePrivySessionBootstrap";

export function PrivyLoginPanel() {
  const router = useRouter();
  const { ready, authenticated, logout } = usePrivy();
  const { login } = useLogin();
  const { bootstrapSession, isBootstrapping, error } = usePrivySessionBootstrap();
  const didBootstrapRef = useRef(false);

  const continueWithPrivy = useCallback(async () => {
    if (!authenticated) {
      login();
      return;
    }

    try {
      const session = await bootstrapSession();
      if (session.needsRoleSelection || !session.user.role) {
        router.push("/onboarding/role");
        return;
      }
      router.push(session.user.role === "pme" ? "/pme/dashboard" : "/investor/dashboard");
    } catch {
      return;
    }
  }, [authenticated, bootstrapSession, login, router]);

  useEffect(() => {
    if (!ready || !authenticated || didBootstrapRef.current) {
      return;
    }

    didBootstrapRef.current = true;
    void continueWithPrivy();
  }, [authenticated, continueWithPrivy, ready]);

  const restartLogin = useCallback(async () => {
    await logout();
    window.localStorage.removeItem("credbridge.accessToken");
  }, [logout]);

  return (
    <div style={{ margin: "auto 0", width: "100%", maxWidth: 440 }}>
      <h2 style={{ fontSize: 32, marginBottom: 8 }}>Entrar na CredBridge</h2>
      <p className="t-2" style={{ marginBottom: 32, fontSize: 14 }}>
        Entre com Privy para criar sua sessão e sua carteira Stellar com segurança.
      </p>

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>
          {error}
        </p>
      )}

      <button
        className="btn btn-primary btn-lg"
        style={{ width: "100%" }}
        onClick={continueWithPrivy}
        disabled={!ready || isBootstrapping}
      >
        {isBootstrapping
          ? "Preparando carteira e sessão..."
          : authenticated
            ? "Continuar"
            : "Entrar com Privy"}
        {!isBootstrapping && <Icon name="arrow_right" size={16} />}
      </button>

      {authenticated && (
        <button
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 12 }}
          onClick={restartLogin}
        >
          Usar outra conta
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Simplify the existing login page around the new panel**

In `apps/web/src/app/(auth)/login/page.tsx`, keep the marketing-side markup and imports for `Logo`, `LoginBG`, and `useRouter`. Remove imports and state used only by email/password, registration, Google login, and KYC:

```tsx
import { PrivyLoginPanel } from "@/components/auth/PrivyLoginPanel";
```

Replace the right-hand authentication content currently beginning at the element containing `"Novo na CredBridge?"` with:

```tsx
        <div className="row between">
          <span className="t-3" style={{ fontSize: 13 }}>
            Login e carteira protegidos pela Privy
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push("/")}>
            Voltar
          </button>
        </div>
        <PrivyLoginPanel />
```

Expected removal from this page: `useLogin`, `useRegister`, `GoogleSignInButton`, `KycFlow`, credential inputs, password submission, and Google-specific success handlers.

- [ ] **Step 5: Add a named helper for logout cleanup**

Add to `apps/web/src/lib/api/auth-storage.ts`:

```ts
export function clearInternalSession(): void {
  clearAccessToken();
}
```

Then replace `window.localStorage.removeItem("credbridge.accessToken")` in `PrivyLoginPanel.tsx` with:

```tsx
import { clearInternalSession } from "@/lib/api/auth-storage";
```

and:

```ts
    clearInternalSession();
```

- [ ] **Step 6: Run login tests and build the login UI**

Run:

```bash
npm test -w apps/web -- src/components/auth/PrivyLoginPanel.spec.tsx
npm run build -w apps/web
```

Expected: PASS; the test proves the Privy modal starts unauthenticated login and that a completed Privy authentication automatically provisions/exchanges and redirects without a second click. `/login` renders one Privy login action and no longer imports the direct Google or email/password mutations.

- [ ] **Step 7: Commit the login replacement**

```bash
git add apps/web/src/components/auth/PrivyLoginPanel.tsx apps/web/src/components/auth/PrivyLoginPanel.spec.tsx 'apps/web/src/app/(auth)/login/page.tsx' apps/web/src/lib/api/auth-storage.ts
git commit -m "feat(web): replace login form with Privy"
```

---

### Task 7: Remove Login-Time Legacy Wallet Creation And Make Compatibility Explicit

**Files:**
- Modify: `apps/web/src/components/auth/KycFlow.tsx:6`
- Modify: `apps/web/src/components/auth/WalletSetupBanner.tsx:44`
- Modify: `documentacao/fluxo-login-atual.md`
- Modify: `documentacao/smart-wallet-fluxo-regras.md`

- [ ] **Step 1: Stop KYC from deploying a second wallet after Privy login**

In `apps/web/src/components/auth/KycFlow.tsx`, remove:

```tsx
import { registerAndDeployWallet, PasskeyAbortedError } from "@/lib/wallet/passkey-client";
import { useCreateWallet } from "@/lib/api/wallet";
import { useMe } from "@/lib/api/me";
```

Remove:

```tsx
  const createWallet = useCreateWallet();
  const { data: me } = useMe();
```

Replace `handleFinish` with:

```tsx
  const handleFinish = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await updateProfile.mutateAsync({
        name: name || undefined,
        phone: phone || undefined,
        companyName: companyName || undefined,
        cnpj: cnpj || undefined,
        monthlyRevenue: MONTHLY_REVENUE_MAP[revenueKey],
        sector,
      });
      onDone();
    } catch {
      setError("Erro ao salvar perfil. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };
```

Expected: KYC updates profile only; the Privy wallet was already provisioned before the internal JWT exchange.

- [ ] **Step 2: Rename the remaining smart-account banner meaning**

In `apps/web/src/components/auth/WalletSetupBanner.tsx`, replace the default message:

```tsx
        {error ?? "Carteira Stellar não configurada."}
```

with:

```tsx
        {error ?? "Assinatura avançada para operações financeiras ainda não configurada."}
```

Replace the button label:

```tsx
        {setting ? "Configurando…" : "Configurar agora"}
```

with:

```tsx
        {setting ? "Configurando…" : "Configurar assinatura"}
```

Expected: users are not told they lack a wallet after Privy already provisioned an embedded wallet; the banner accurately refers to the legacy smart-account authorization still needed by financial flows.

- [ ] **Step 3: Update login documentation**

Replace the overview and authentication flow sections in `documentacao/fluxo-login-atual.md` with this documented behavior:

```markdown
## Visao geral

O login da CredBridge usa Privy no frontend para autenticar o usuario, manter a
sessao Privy e provisionar uma embedded wallet Stellar vinculada ao usuario.
Depois que a wallet existe, o frontend envia o access token e o identity token
assinados pela Privy para `POST /v1/auth/privy/session`.

O NestJS nao confia em e-mail ou endereco de wallet enviados livremente pelo
navegador: ele valida os tokens Privy, obtem o DID, o e-mail verificado e a
wallet Stellar vinculada, cria ou atualiza o `User` local e emite o JWT interno
usado nas APIs CredBridge.

## Fluxo Privy

1. O usuario abre `/login` e escolhe entrar com Privy.
2. Privy autentica com os metodos habilitados (`email` ou `google`).
3. O frontend cria uma embedded wallet `stellar` caso o usuario ainda nao tenha
   uma wallet Stellar vinculada na Privy.
4. O frontend renova os dados do usuario e obtem access token e identity token.
5. O frontend chama `POST /v1/auth/privy/session`.
6. A API verifica os dois tokens com `@privy-io/node` e exige o mesmo Privy DID.
7. A API vincula um usuario existente pelo e-mail verificado ou cria um novo
   usuario com `role: null`.
8. A API persiste `privyUserId`, `privyStellarWalletAddress` e
   `privyWalletStatus`.
9. A API retorna o JWT interno CredBridge.
10. Usuarios sem perfil escolhem `pme` ou `investor` em `/onboarding/role`;
    usuarios com perfil seguem para o dashboard correspondente.
```

- [ ] **Step 4: Document the two-wallet compatibility boundary**

Add this section near the beginning of `documentacao/smart-wallet-fluxo-regras.md`:

```markdown
## Compatibilidade com a wallet embedded Privy

A wallet embedded Stellar criada no login Privy e a smart account Soroban
baseada em passkey nao sao tratadas como a mesma credencial nesta fase.

- `privyStellarWalletAddress` identifica a wallet embedded vinculada a sessao
  Privy e comprova provisionamento de wallet durante onboarding.
- `stellarWalletId`, `passkeyId`, `passkeyPublicKey`, `walletType` e
  `walletStatus` continuam identificando a smart account/passkey exigida pela
  autorizacao financeira existente.
- O KYC nao cria mais smart account automaticamente.
- Quando uma operacao financeira ainda exigir WebAuthn, o banner e o fluxo de
  autorizacao explicam que a configuracao e para assinatura avancada da
  operacao, nao para login.

A substituicao das assinaturas WebAuthn por assinaturas Privy Stellar exige uma
decisao separada sobre transacoes Stellar Tier 2, verificacao de assinatura,
replay protection e compatibilidade com os contratos Soroban existentes.
```

- [ ] **Step 5: Build the frontend after removing the legacy onboarding side effect**

Run:

```bash
npm run build -w apps/web
```

Expected: PASS with no unused `KycFlow` imports and with the financial-action smart-account setup still available outside login.

- [ ] **Step 6: Commit compatibility changes**

```bash
git add apps/web/src/components/auth/KycFlow.tsx apps/web/src/components/auth/WalletSetupBanner.tsx documentacao/fluxo-login-atual.md documentacao/smart-wallet-fluxo-regras.md
git commit -m "refactor(auth): separate Privy login wallet from smart account"
```

---

### Task 8: Verify The Complete Privy Login Migration

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Add a regression assertion that Privy never fills smart-account passkey fields**

In the `privySession` create-user test from Task 3, add:

```ts
      expect(prismaMock.user.create).not.toHaveBeenCalledWith({
        data: expect.objectContaining({
          stellarWalletId: expect.any(String),
          passkeyId: expect.any(String),
          passkeyPublicKey: expect.any(String),
        }),
      });
```

- [ ] **Step 2: Run backend unit tests**

Run:

```bash
npm test -w apps/api -- auth.service.spec.ts privy-auth.service.spec.ts stellar-wallet.service.spec.ts financial-authorizations.service.spec.ts --runInBand
```

Expected: PASS; the new authentication path does not regress the separately tested smart-account financial authorization path.

- [ ] **Step 3: Run repository validation**

Run:

```bash
npm run build:types
npm test -w apps/web
npm run build -w apps/api
npm run build -w apps/web
npm run lint
```

Expected: all commands exit successfully.

- [ ] **Step 4: Document local setup and manual verification**

Add to `README.md` under authentication setup:

````markdown
### Privy login and Stellar wallet

Configure a Privy application with `email` and `google` login enabled and enable
identity tokens in the Privy Dashboard. Set these values before starting the
applications:

```env
# API
PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_JWT_VERIFICATION_KEY=

# Web
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_PRIVY_CLIENT_ID=
```

Manual verification:

1. Start `npm run dev`.
2. Open `/login` and authenticate through Privy.
3. Confirm that the first login creates a Stellar embedded wallet and routes a
   new user to `/onboarding/role`.
4. Complete role selection and confirm the dashboard loads using the internal
   CredBridge JWT.
5. Log out and log in again; confirm no additional Stellar wallet is created.
6. Confirm the financial-signature banner refers to advanced authorization
   rather than claiming the user has no wallet.
````

- [ ] **Step 5: Commit verification documentation**

```bash
git add apps/api/src/modules/auth/auth.service.spec.ts README.md
git commit -m "docs(auth): describe Privy login rollout"
```

---

## Deferred Follow-Up Plan

Create a separate implementation plan before changing financial transaction authorization:

```text
docs/superpowers/plans/2026-05-23-privy-stellar-financial-signatures.md
```

It must choose and test one of these product/security directions:

1. Keep the current Soroban passkey smart account for financial authorization and treat Privy only as identity plus onboarding wallet.
2. Migrate `FinancialAuthorizationsService` from WebAuthn assertions to Privy Stellar raw signatures and update on-chain execution/policy boundaries accordingly.

Do not write Privy Stellar addresses into the existing `stellarWalletId` smart-account field until that follow-up decision is implemented and its authorization tests pass.
