# Google OAuth Login — Design

**Date:** 2026-05-14
**Status:** Approved (pending Google Cloud setup)

## Goal

Allow users to authenticate with Google in addition to the existing email/password flow. Both login and registration entry points support "Continue with Google". Existing email users can link Google to their account by signing in with the same email.

## Non-goals

- Other social providers (Apple, Microsoft, GitHub).
- Cookie-based sessions (the project uses Bearer JWT in localStorage; this design preserves that).
- Account merging UI for conflicts (handled implicitly by matching emails).

## Flow

**Client-side ID token flow** (Google Identity Services via `@react-oauth/google`):

1. User clicks "Continue with Google" button on `/login` or `/register`.
2. Google prompt opens, user consents, frontend receives an ID token (JWT signed by Google).
3. Frontend POSTs `{ idToken }` to `POST /auth/google` on the NestJS API.
4. Backend verifies the ID token signature and `aud` using `google-auth-library`.
5. Backend upserts the user (logic below) and returns `{ accessToken, user, needsRoleSelection }`.
6. Frontend stores `accessToken` in localStorage and redirects:
   - `needsRoleSelection === true` → `/register/role-selection`
   - Otherwise → `/{role}/dashboard`

Chosen over server-side redirect flow because it preserves the existing localStorage/Bearer-token convention and avoids cross-origin redirect / cookie domain handling between API and web apps.

## Backend changes

### Schema (`apps/api/prisma/schema.prisma`)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String?  // was required — now nullable for OAuth-only users
  googleId      String?  @unique
  provider      String   @default("email") // "email" | "google"
  role          Role?    // was required — now nullable until user picks role
  // ... existing fields unchanged
}
```

Migration name: `add_google_oauth_fields`.

### Endpoint: `POST /auth/google`

Request: `{ idToken: string }`

Response:
```ts
{
  accessToken: string;
  user: { id, email, name, role: Role | null, provider };
  needsRoleSelection: boolean;
}
```

Logic in `AuthService.googleLogin(idToken)`:

1. Verify the ID token with `OAuth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })`. Reject on failure.
2. Extract `sub` (Google user id), `email`, `email_verified`, `name`. Reject if `!email_verified`.
3. Lookup user:
   - **By `googleId`** → existing Google user, log them in.
   - **Else by `email`** → existing email user. Link by setting `googleId` and leaving `provider` as `"email"` (provider records the *original* signup channel). Log in.
   - **Else** → create user with `{ email, googleId, provider: "google", role: null, name }`.
4. Issue JWT (existing `JwtService.sign` with `{ sub, email, role }`; `role` may be `null`).
5. `needsRoleSelection = user.role === null`.

### Endpoint: `PATCH /auth/me/role`

Request: `{ role: "pme" | "investor" }` (Bearer token required).

Behavior:
- Reject (409) if user already has a role.
- Update `user.role`. Issue a *new* JWT carrying the updated role and return it so the client can replace the stored token.
- Response: `{ accessToken, user }`.

### JWT guard

The existing `JwtAuthGuard` accepts tokens regardless of whether `role` is null. Role-specific guards (e.g. for PME-only routes) must reject `role === null` so an incomplete Google user can't access protected role-scoped routes.

### Env vars

- `GOOGLE_CLIENT_ID` — added to `.env` and `.env.example`. Backend uses it as the `audience` claim during verification.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — same value, exposed to the Next.js client.

No client secret is needed because the client-side ID token flow doesn't perform a server-side code exchange.

### Package additions (`apps/api`)

- `google-auth-library`

## Frontend changes

### Package additions (`apps/web`)

- `@react-oauth/google`

### Provider wrap

Add `GoogleOAuthProvider` at the root layout (`apps/web/src/app/layout.tsx` or the existing client provider tree) so the Google script loads once.

### Login page (`apps/web/src/app/(auth)/login/page.tsx`)

- Render `<GoogleLoginButton />` above the email/password form, separated by an "or" divider.
- Component uses `useGoogleLogin({ flow: "implicit" })` or `<GoogleLogin>` to obtain the ID token, then calls the new `useGoogleLogin` hook (frontend) which POSTs to `/auth/google`.
- On success: save token via existing `auth-storage` setter, then route per `needsRoleSelection`.

### Register page

- Same `<GoogleLoginButton />` shown above the email/password form. Google flow bypasses the existing role-first-then-credentials wizard — the user picks role *after* authenticating via the new `/register/role-selection` page.

### New page: `/register/role-selection`

- Reuses the role-selection step component from the existing registration wizard.
- On submit, calls `PATCH /auth/me/role`, replaces the stored token with the returned one, then routes:
  - `pme` → existing KYC step (`/register/kyc` or equivalent)
  - `investor` → `/investor/dashboard`
- Protected: requires Bearer token. If user already has a role, redirect to dashboard.

### API client hook (`apps/web/src/lib/api/auth.ts`)

- New `useGoogleSignIn()` mutation hook wrapping `POST /auth/google`.
- New `useSetRole()` mutation hook wrapping `PATCH /auth/me/role`.

## Error handling

| Case | Behavior |
|---|---|
| Invalid / expired Google ID token | API returns 401; UI shows "Falha ao autenticar com Google. Tente novamente." |
| `email_verified === false` | API returns 403; UI shows "Verifique seu e-mail no Google antes de continuar." |
| Network error on `/auth/google` | UI shows retry toast. |
| Role already set on `PATCH /auth/me/role` | API returns 409; UI redirects to dashboard. |
| Google script blocked | `@react-oauth/google` button doesn't render; user falls back to email/password. |

## Testing

- Backend unit: mock `OAuth2Client.verifyIdToken`; cover new-user, existing-google-user, link-by-email, unverified-email, invalid-token branches.
- Backend integration: `POST /auth/google` happy path returns JWT; `PATCH /auth/me/role` enforces idempotency (409 on second call).
- Frontend: button renders, mock the Google response, assert correct redirect for both `needsRoleSelection` branches.

## Out of scope / future

- Unlinking Google from an account.
- Multiple OAuth providers on the same user record (current schema is single `googleId` + `provider`; multi-provider would need a join table).
- Refresh tokens (current JWT lifetime is 7d, unchanged).
