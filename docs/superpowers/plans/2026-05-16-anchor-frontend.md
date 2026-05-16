# Anchor Frontend — On-Ramp / Off-Ramp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Depositar BRL" (investor) and "Sacar BRL" (PME) buttons to the dashboards, backed by a shared `AnchorDrawer` that shows an amount input then loads the Etherfuse iframe via SEP-24.

**Architecture:** Two new files (`lib/api/anchor.ts`, `components/anchor/AnchorDrawer.tsx`) and two small page modifications. The drawer uses the existing `Drawer` primitive and the same step/mutation pattern as `BuyDrawer`.

**Tech Stack:** Next.js App Router, React, TanStack Query `useMutation`, `apiFetch` client, `Drawer` / `Icon` primitives.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/web/src/lib/api/anchor.ts` | `useAnchorOnrampStart` + `useAnchorOfframpStart` mutations |
| Create | `apps/web/src/components/anchor/AnchorDrawer.tsx` | Shared drawer: amount → loading → iframe (or error) |
| Modify | `apps/web/src/app/(investor)/investor/dashboard/page.tsx` | "Depositar BRL" button + `<AnchorDrawer mode="onramp">` |
| Modify | `apps/web/src/app/(pme)/pme/dashboard/page.tsx` | "Sacar BRL" button + `<AnchorDrawer mode="offramp">` |

---

## Task 1: API hooks — `lib/api/anchor.ts`

**Files:**
- Create: `apps/web/src/lib/api/anchor.ts`

- [ ] **Step 1: Create the file**

```typescript
// apps/web/src/lib/api/anchor.ts
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./client";

interface StartRampInput {
  amount: number;
  quoteId?: string;
}

export interface StartRampResponse {
  id: string;
  interactiveUrl?: string;
  status: string;
}

export function useAnchorOnrampStart() {
  return useMutation({
    mutationFn: (input: StartRampInput) =>
      apiFetch<StartRampResponse>("/anchor/onramp/start", {
        method: "POST",
        body: input,
      }),
  });
}

export function useAnchorOfframpStart() {
  return useMutation({
    mutationFn: (input: StartRampInput) =>
      apiFetch<StartRampResponse>("/anchor/offramp/start", {
        method: "POST",
        body: input,
      }),
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

---

## Task 2: `AnchorDrawer` component

**Files:**
- Create: `apps/web/src/components/anchor/AnchorDrawer.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p apps/web/src/components/anchor
```

```tsx
// apps/web/src/components/anchor/AnchorDrawer.tsx
"use client";

import { useState } from "react";
import { Drawer } from "@/components/primitives/Drawer";
import { Icon } from "@/components/primitives/Icon";
import { extractApiErrorMessage } from "@/lib/api/client";
import { useAnchorOnrampStart, useAnchorOfframpStart } from "@/lib/api/anchor";

type Step = "amount" | "loading" | "iframe" | "error";

interface AnchorDrawerProps {
  mode: "onramp" | "offramp";
  open: boolean;
  onClose: () => void;
}

export function AnchorDrawer({ mode, open, onClose }: AnchorDrawerProps) {
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [interactiveUrl, setInteractiveUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onrampMutation = useAnchorOnrampStart();
  const offrampMutation = useAnchorOfframpStart();

  const isOnramp = mode === "onramp";
  const title = isOnramp ? "Depositar BRL" : "Sacar BRL";

  const handleClose = () => {
    setStep("amount");
    setAmount("");
    setInteractiveUrl(null);
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    setError(null);
    setStep("loading");

    const mutation = isOnramp ? onrampMutation : offrampMutation;
    mutation.mutate(
      { amount: parsed },
      {
        onSuccess: (data) => {
          if (data.interactiveUrl) {
            setInteractiveUrl(data.interactiveUrl);
            setStep("iframe");
          } else {
            setError(
              "Etherfuse não retornou URL interativa. Suporte PIX/Brasil está em sandbox — tente novamente mais tarde.",
            );
            setStep("error");
          }
        },
        onError: (err) => {
          setError(extractApiErrorMessage(err));
          setStep("error");
        },
      },
    );
  };

  return (
    <Drawer open={open} onClose={handleClose} title={title} width={560}>
      {step === "amount" && (
        <div className="col" style={{ gap: 20 }}>
          <div className="card" style={{ padding: 14, fontSize: 13 }}>
            <span className="t-2">
              {isOnramp ? "BRL → TESOURO via PIX" : "TESOURO → BRL via PIX"}
            </span>
            <p className="t-3" style={{ marginTop: 4, lineHeight: 1.5 }}>
              {isOnramp
                ? "Deposite BRL via PIX e receba TESOURO na sua carteira Stellar para investir em recebíveis."
                : "Transfira TESOURO da sua carteira Stellar e receba BRL via PIX na sua conta bancária."}
            </p>
          </div>

          <div className="col" style={{ gap: 8 }}>
            <label className="eyebrow">Valor (BRL)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              className="input"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>

          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0}
          >
            Continuar <Icon name="arrow_right" size={14} />
          </button>
        </div>
      )}

      {step === "loading" && (
        <div
          className="col"
          style={{ gap: 18, alignItems: "center", textAlign: "center", paddingTop: 48 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "3px solid var(--line)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <h3 style={{ fontSize: 18 }}>Iniciando fluxo…</h3>
          <p className="t-2" style={{ fontSize: 13 }}>
            Conectando com Etherfuse via Stellar.
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {step === "iframe" && interactiveUrl && (
        <div className="col" style={{ gap: 12 }}>
          <p className="t-2" style={{ fontSize: 12 }}>
            Complete o fluxo abaixo. Feche o painel quando concluir.
          </p>
          <iframe
            src={interactiveUrl}
            allow="payment"
            style={{ width: "100%", height: 520, border: "none", borderRadius: 8 }}
            title="Etherfuse"
          />
        </div>
      )}

      {step === "error" && (
        <div
          className="col"
          style={{ gap: 18, alignItems: "center", textAlign: "center", paddingTop: 32 }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(255,85,119,0.1)",
              color: "var(--red)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="close" size={24} />
          </div>
          <h3 style={{ fontSize: 18 }}>Algo deu errado</h3>
          <p className="t-2" style={{ fontSize: 13 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => setStep("amount")}>
            Tentar novamente
          </button>
        </div>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

---

## Task 3: Investor dashboard — "Depositar BRL" button

**Files:**
- Modify: `apps/web/src/app/(investor)/investor/dashboard/page.tsx`

Current header buttons (lines 54–64):
```tsx
<div className="row" style={{ gap: 8 }}>
  <button className="btn btn-ghost">
    <Icon name="download" size={14} /> Relatório
  </button>
  <button
    className="btn btn-violet"
    onClick={goToPool}
  >
    <Icon name="plus" size={14} /> {t("inv_buy")}
  </button>
</div>
```

- [ ] **Step 1: Add import for `AnchorDrawer` at the top of the file**

Add after the last existing import:
```tsx
import { AnchorDrawer } from "@/components/anchor/AnchorDrawer";
```

- [ ] **Step 2: Add state for the drawer**

Add after the existing `useState` declarations (after line `const [buyTarget, setBuyTarget] = useState<Receivable | null>(null);`):
```tsx
const [onrampOpen, setOnrampOpen] = useState(false);
```

- [ ] **Step 3: Add button to header row**

Replace the header buttons block with:
```tsx
<div className="row" style={{ gap: 8 }}>
  <button className="btn btn-ghost">
    <Icon name="download" size={14} /> Relatório
  </button>
  <button className="btn btn-primary" onClick={() => setOnrampOpen(true)}>
    <Icon name="download" size={14} /> Depositar BRL
  </button>
  <button
    className="btn btn-violet"
    onClick={goToPool}
  >
    <Icon name="plus" size={14} /> {t("inv_buy")}
  </button>
</div>
```

- [ ] **Step 4: Add `AnchorDrawer` before the closing fragment `</>`**

Add just before the final `</>`:
```tsx
<AnchorDrawer mode="onramp" open={onrampOpen} onClose={() => setOnrampOpen(false)} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

---

## Task 4: PME dashboard — "Sacar BRL" button

**Files:**
- Modify: `apps/web/src/app/(pme)/pme/dashboard/page.tsx`

Current header buttons (lines 129–135):
```tsx
<div className="row" style={{ gap: 8 }}>
  <button className="btn btn-ghost">
    <Icon name="download" size={14} /> Extrato
  </button>
  <button className="btn btn-primary" onClick={scrollToUpload}>
    <Icon name="plus" size={14} /> {t("dash_upload")}
  </button>
</div>
```

- [ ] **Step 1: Add import for `AnchorDrawer`**

Add after the last existing import:
```tsx
import { AnchorDrawer } from "@/components/anchor/AnchorDrawer";
```

- [ ] **Step 2: Add state for the drawer**

Add after the existing `useState` declarations:
```tsx
const [offrampOpen, setOfframpOpen] = useState(false);
```

- [ ] **Step 3: Add button to header row**

Replace the header buttons block with:
```tsx
<div className="row" style={{ gap: 8 }}>
  <button className="btn btn-ghost">
    <Icon name="download" size={14} /> Extrato
  </button>
  <button className="btn btn-ghost" onClick={() => setOfframpOpen(true)}>
    <Icon name="upload" size={14} /> Sacar BRL
  </button>
  <button className="btn btn-primary" onClick={scrollToUpload}>
    <Icon name="plus" size={14} /> {t("dash_upload")}
  </button>
</div>
```

- [ ] **Step 4: Add `AnchorDrawer` before the closing fragment `</>`**

Add just before the final `</>`:
```tsx
<AnchorDrawer mode="offramp" open={offrampOpen} onClose={() => setOfframpOpen(false)} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: Visual verification + commit

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify investor dashboard**

Open http://localhost:3000 → log in as investor → check "Depositar BRL" button appears in header → click it → drawer opens → type `100` → click "Continuar" → spinner appears (API call goes out) → either iframe loads or error step shows.

- [ ] **Step 3: Verify PME dashboard**

Log in as PME → check "Sacar BRL" button appears in header → click it → same flow.

- [ ] **Step 4: Verify Escape key closes drawer**

Open drawer → press Escape → drawer closes, state resets.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/anchor.ts \
        apps/web/src/components/anchor/AnchorDrawer.tsx \
        apps/web/src/app/\(investor\)/investor/dashboard/page.tsx \
        apps/web/src/app/\(pme\)/pme/dashboard/page.tsx

git commit -m "feat(web): add AnchorDrawer for Etherfuse on-ramp (investor) and off-ramp (PME)"
```

---

## Self-Review

**Spec coverage:**
- [x] `lib/api/anchor.ts` — `useAnchorOnrampStart`, `useAnchorOfframpStart` — Task 1
- [x] `AnchorDrawer` with steps amount/loading/iframe/error — Task 2
- [x] mode prop: `onramp` vs `offramp` — Task 2
- [x] "Depositar BRL" in investor dashboard header — Task 3
- [x] "Sacar BRL" in PME dashboard header — Task 4
- [x] Reset on close — Task 2 `handleClose`
- [x] Error: no `interactiveUrl` (sandbox) — Task 2 `onSuccess` branch
- [x] Error: API failure — Task 2 `onError`
- [x] Amount validation (> 0) — Task 2 `disabled` prop

**Type consistency:** `StartRampResponse` defined in Task 1, used in Task 2. `AnchorDrawer` props match usage in Tasks 3 and 4. `mode` prop values `"onramp"` / `"offramp"` consistent throughout.
