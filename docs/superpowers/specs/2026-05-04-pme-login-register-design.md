# PME Login / Register Flow — Design Spec

**Date:** 2026-05-04  
**Scope:** PME persona only. Investor and Partner keep mock until PME is 100%.  
**Branch decision:** Single page at `/login` handles both login and register. No separate `/onboarding` page.

---

## 1. State Machine

```
Step "role"        → role selector (PME pre-selected)
Step "credentials" → email + password + mode toggle (login | register)
Step "kyc"         → KycFlow (only when mode=register AND role=pme)
Step "done"        → redirect to /pme/dashboard
```

Stellar Auth step is **removed** from the machine entirely (STATUS.md: "manter JWT email/senha como auth principal por enquanto").

---

## 2. Credentials Step — Logic

### Login mode
- Calls `useLogin({ email, password })`
- On success → `setAccessToken(data.accessToken)` → `router.push("/pme/dashboard")`
- On error → inline error message below form (var(--red), 13px)

### Register mode
- Calls `useRegister({ email, password, role })`
- On success (PME) → `setAccessToken(data.accessToken)` → advance to step "kyc"
- On success (Investor / Partner) → `setAccessToken(data.accessToken)` → `router.push("/<role>/dashboard")`
- On error → inline error message below form

### Mode toggle
- Small link below the submit button: "Criar conta" ↔ "Já tenho conta"
- Switching mode clears any existing error state
- Password field kept in both modes (no confirm-password field — MVP)

### Loading state
- Button disabled + shows spinner icon while `mutation.isPending`
- Inputs disabled while pending

---

## 3. Visual Design

Preserves the existing split-panel layout in `login/page.tsx`:
- **Left panel:** marketing copy + `LoginBG` + `Logo` — unchanged
- **Right panel:** step content — same card/input/button tokens

Steps use the same step rendering pattern already in place (`step === "role"`, `step === "credentials"`, etc.). KycFlow and its stepper are unchanged.

No new color tokens or layout patterns introduced.

---

## 4. Route Guard

New hook `apps/web/src/hooks/useRequireAuth.ts`:
- Reads `getAccessToken()` from `auth-storage`
- If null → `router.replace("/login")`
- Returns `{ isReady: boolean }` — true once the check runs

`apps/web/src/app/(pme)/layout.tsx`:
- Calls `useRequireAuth()`
- Renders `null` while `!isReady` (prevents flash of authenticated dashboard)
- Renders `children` once ready

No global auth context. No Next.js middleware (incompatible with localStorage token strategy for now).

---

## 5. Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/(auth)/login/page.tsx` | Refactor state machine, wire useLogin/useRegister, remove Stellar step |
| `apps/web/src/app/(auth)/onboarding/page.tsx` | Redirect to `/login` (page no longer used) |
| `apps/web/src/app/(pme)/layout.tsx` | Add useRequireAuth() call |
| `apps/web/src/hooks/useRequireAuth.ts` | New hook |

---

## 6. Out of Scope

- Stellar SEP-10 authentication
- httpOnly cookie migration
- Investor / Partner real auth (keep mock)
- Refresh token / JWT rotation
- "Forgot password" flow
- Email confirmation on register
