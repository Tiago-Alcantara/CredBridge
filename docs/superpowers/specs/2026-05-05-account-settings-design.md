# Account Settings — Design Spec

**Date:** 2026-05-05  
**Status:** Approved  
**Scope:** `/pme/configuracoes` + `/investor/configuracoes` — shared `AccountSettings` component + backend `GET/PATCH /v1/auth/me`

---

## 1. Data Layer

### Schema Migration

Add nullable fields to `User` model in `apps/api/prisma/schema.prisma`. All fields optional — no breaking change to existing seed data.

```prisma
model User {
  id               String   @id @default(uuid())
  email            String   @unique
  passwordHash     String
  role             String   @default("pme")
  // Common
  name             String?
  phone            String?
  address          String?
  // PME-specific
  companyName      String?
  cnpj             String?
  monthlyRevenue   Float?
  sector           String?
  // Investor-specific
  investorType     String?  // "pf" | "pj"
  riskProfile      String?  // "conservador" | "moderado" | "arrojado"
  operationalLimit Float?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

Run: `npm run --workspace apps/api prisma migrate dev -- --name add_user_profile_fields`

### Backend Endpoints (all protected by JwtAuthGuard)

| Method | Path | Body | Response |
|---|---|---|---|
| `GET` | `/v1/auth/me` | — | `User` without `passwordHash` |
| `PATCH` | `/v1/auth/me` | profile fields (no password) | updated `User` without `passwordHash` |
| `PATCH` | `/v1/auth/me/password` | `{ currentPassword, newPassword }` | `{ message: "ok" }` |

Password lives in a separate endpoint to prevent accidental blank-password updates during profile saves.

`AuthService.findMe(userId)` uses Prisma `select` whitelist — never returns `passwordHash`.

`AuthService.updatePassword(userId, dto)` — validates `currentPassword` with bcrypt before hashing and saving `newPassword`. Returns `UnauthorizedException` if current password is wrong.

---

## 2. Component Architecture

### Route Pages (thin wrappers)

- `apps/web/src/app/(pme)/pme/configuracoes/page.tsx`
- `apps/web/src/app/(investor)/investor/configuracoes/page.tsx`

Both render only `<AccountSettings />` — no props, no logic.

### `AccountSettings` component

**Location:** `apps/web/src/components/settings/AccountSettings.tsx`

**Responsibilities:**
- Calls `useMe()` to load current user data as form defaults
- Reads `getTokenRole()` to conditionally render role-specific sections
- Shows `Skeleton` while `useMe()` is loading
- Renders 4 card sections, each with its own `form` and Save button

### Form Sections

| Section | Fields | Visible to |
|---|---|---|
| Perfil | nome, email (read-only), telefone, endereço | All roles |
| Empresa | razão social, CNPJ (masked), faturamento mensal, setor | PME only |
| Investidor | tipo (PF/PJ select), perfil de risco (select), limite operacional | Investor only |
| Segurança | senha atual, nova senha, confirmar nova senha | All roles |

### Frontend Hooks

New file: `apps/web/src/lib/api/me.ts`

```ts
// MeResponse — User without passwordHash
useMe()           // GET /auth/me — queryKey: ["me"]
useUpdateMe()     // PATCH /auth/me — invalidates ["me"] on success
useUpdatePassword() // PATCH /auth/me/password
```

---

## 3. Error Handling & Edge Cases

**Loading state:** Form fields disabled + `Skeleton` placeholders until `useMe()` resolves.

**Email:** Read-only — changing email requires verification flow, out of scope.

**CNPJ/CPF:** Frontend format mask only. Real validation (Receita Federal) deferred to KYC module.

**Password change:**
- New password < 8 chars → inline error, no API call
- Passwords don't match → inline error, no API call
- Wrong current password → backend returns **400** (not 401) with `{ message: "Senha atual incorreta" }` — avoids triggering the global 401 handler in `apiFetch` which would clear the token and redirect to login
- Success → clear all 3 fields + toast "Senha atualizada"

**Profile save:**
- Success → toast "Perfil salvo" + invalidate `["me"]`
- API error → `extractApiErrorMessage` → red toast

**Layouts:** `pmeUser`/`investorUser` in layout files remain hardcoded for now — updating the TopBar with real user data is a separate task (requires `useMe()` in layout + server-side concerns).

---

## 4. Out of Scope

- Email change flow (requires verification)
- CNPJ/CPF real validation (deferred to KYC)
- Avatar/profile picture upload
- Updating TopBar/Sidebar with real user data from `useMe()`
- Notification preferences
- Two-factor authentication
