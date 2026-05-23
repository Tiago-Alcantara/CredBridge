# Public Landing Subdomain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `www.lane-credbridge.app` serve only the existing public landing page, without login or dashboard entry points.

**Architecture:** A Next.js 16 `proxy.ts` detects the public hostname, redirects page routes other than `/` back to `/`, and marks the root request with an internal header. The marketing page reads that header and passes an explicit `publicOnly` mode into its existing navigation, hero, and audience components so other hosts keep their current behavior.

**Tech Stack:** Next.js 16 App Router and Proxy, React 19, TypeScript, Vitest, Testing Library, Vercel deployment configuration.

**Reference Spec:** `docs/superpowers/specs/2026-05-23-public-landing-subdomain-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `apps/web/src/proxy.ts` | Restrict page navigation on the public hostname and signal public rendering for `/` |
| Create | `apps/web/src/proxy.spec.ts` | Cover root marking, redirect behavior, asset pass-through, and other hosts |
| Create | `apps/web/src/app/(marketing)/page.spec.tsx` | Cover page-to-component propagation of public-only mode |
| Create | `apps/web/src/components/marketing/PublicLandingMode.spec.tsx` | Cover removal of internal entry links in public-only components |
| Modify | `apps/web/src/app/(marketing)/page.tsx` | Read the proxy header and select the public variant |
| Modify | `apps/web/src/components/patterns/TopNav.tsx` | Hide login and authenticated-entry navigation in public mode |
| Modify | `apps/web/src/components/marketing/HeroNetwork.tsx` | Hide application CTA links in public mode |
| Modify | `apps/web/src/components/marketing/Audiences.tsx` | Present audience cards without internal CTA links in public mode |
| Modify | `vercel.json` | Remove the placeholder host redirect so Vercel serves the same deployment |

## Task 1: Define Host And Landing Behavior With Tests

**Files:**
- Create: `apps/web/src/proxy.spec.ts`
- Create: `apps/web/src/app/(marketing)/page.spec.tsx`
- Create: `apps/web/src/components/marketing/PublicLandingMode.spec.tsx`

- [x] **Step 1: Write proxy behavior tests**

```typescript
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

const PUBLIC_HOST = "www.lane-credbridge.app";

function createRequest(pathname: string, hostname = PUBLIC_HOST) {
  return new NextRequest(`https://${hostname}${pathname}`);
}

describe("public landing proxy", () => {
  it("marks the root request for public-only rendering", () => {
    const response = proxy(createRequest("/"));

    expect(response.headers.get("x-middleware-request-x-credbridge-public-landing")).toBe("true");
  });

  it("redirects application routes on the public host to the landing", () => {
    const response = proxy(createRequest("/login?role=investor"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://${PUBLIC_HOST}/`);
  });

  it("does not redirect static assets needed by the landing", () => {
    const response = proxy(createRequest("/_next/static/chunks/app.js"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("does not restrict other hosts", () => {
    const response = proxy(createRequest("/login", "preview.lane-credbridge.app"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-credbridge-public-landing")).toBeNull();
  });
});
```

- [x] **Step 2: Write page propagation test**

```tsx
import { render, screen } from "@testing-library/react";
import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import MarketingLandingPage from "./page";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/components/patterns/TopNav", () => ({
  TopNav: ({ publicOnly }: { publicOnly?: boolean }) => (
    <span data-testid="top-nav-mode">{String(publicOnly)}</span>
  ),
}));
vi.mock("@/components/marketing/HeroNetwork", () => ({
  HeroNetwork: ({ publicOnly }: { publicOnly?: boolean }) => (
    <span data-testid="hero-mode">{String(publicOnly)}</span>
  ),
}));
vi.mock("@/components/marketing/Audiences", () => ({
  Audiences: ({ publicOnly }: { publicOnly?: boolean }) => (
    <span data-testid="audiences-mode">{String(publicOnly)}</span>
  ),
}));
vi.mock("@/components/marketing/StatsBar", () => ({ StatsBar: () => null }));
vi.mock("@/components/marketing/HowItWorks", () => ({ HowItWorks: () => null }));
vi.mock("@/components/marketing/LandingFooter", () => ({ LandingFooter: () => null }));

describe("MarketingLandingPage", () => {
  it("renders the public-only variant when the public hostname is marked", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ "x-credbridge-public-landing": "true" }) as never,
    );

    render(await MarketingLandingPage());

    expect(screen.getByTestId("top-nav-mode")).toHaveTextContent("true");
    expect(screen.getByTestId("hero-mode")).toHaveTextContent("true");
    expect(screen.getByTestId("audiences-mode")).toHaveTextContent("true");
  });
});
```

- [x] **Step 3: Write component public-mode test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopNav } from "@/components/patterns/TopNav";
import { Audiences } from "./Audiences";
import { HeroNetwork } from "./HeroNetwork";

vi.mock("@/components/primitives/Icon", () => ({ Icon: () => null }));
vi.mock("@/components/primitives/Logo", () => ({ Logo: () => <span>CredBridge</span> }));
vi.mock("./HeroNetworkBG", () => ({ HeroNetworkBG: () => null }));
vi.mock("@/lib/i18n/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("public landing mode", () => {
  it("does not expose login or dashboard entry links", () => {
    const { container } = render(
      <>
        <TopNav publicOnly />
        <HeroNetwork publicOnly />
        <Audiences publicOnly />
      </>,
    );

    expect(container.querySelector('a[href^="/login"]')).toBeNull();
    expect(container.querySelector('a[href^="/partner/dashboard"]')).toBeNull();
  });
});
```

- [x] **Step 4: Run focused tests to verify RED**

Run:

```bash
npm test -w apps/web -- src/proxy.spec.ts 'src/app/(marketing)/page.spec.tsx' src/components/marketing/PublicLandingMode.spec.tsx
```

Expected: FAIL because `proxy.ts` and `publicOnly` behavior do not exist yet.

## Task 2: Implement Public Host Restriction And Public-Only Rendering

**Files:**
- Create: `apps/web/src/proxy.ts`
- Modify: `apps/web/src/app/(marketing)/page.tsx`
- Modify: `apps/web/src/components/patterns/TopNav.tsx`
- Modify: `apps/web/src/components/marketing/HeroNetwork.tsx`
- Modify: `apps/web/src/components/marketing/Audiences.tsx`

- [x] **Step 1: Add Next.js 16 Proxy**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_LANDING_HOSTNAME = "www.lane-credbridge.app";
const PUBLIC_LANDING_HEADER = "x-credbridge-public-landing";

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/icon.svg" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[^/]+$/.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname !== PUBLIC_LANDING_HOSTNAME) {
    return NextResponse.next();
  }

  if (isStaticAssetPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname !== "/") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PUBLIC_LANDING_HEADER, "true");

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
```

- [x] **Step 2: Read public mode in the landing page**

```tsx
import { headers } from "next/headers";
import { TopNav } from "@/components/patterns/TopNav";
import { HeroNetwork } from "@/components/marketing/HeroNetwork";
import { StatsBar } from "@/components/marketing/StatsBar";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Audiences } from "@/components/marketing/Audiences";
import { LandingFooter } from "@/components/marketing/LandingFooter";

const PUBLIC_LANDING_HEADER = "x-credbridge-public-landing";

export default async function MarketingLandingPage() {
  const requestHeaders = await headers();
  const publicOnly = requestHeaders.get(PUBLIC_LANDING_HEADER) === "true";

  return (
    <>
      <TopNav publicOnly={publicOnly} />
      <main>
        <HeroNetwork publicOnly={publicOnly} />
        <StatsBar />
        <HowItWorks />
        <Audiences publicOnly={publicOnly} />
      </main>
      <LandingFooter />
    </>
  );
}
```

- [x] **Step 3: Make existing marketing entry points conditional**

Apply these exact changes to the three existing client components:

```diff
--- a/apps/web/src/components/patterns/TopNav.tsx
+++ b/apps/web/src/components/patterns/TopNav.tsx
@@
 interface TopNavProps {
   lang?: Lang;
   activePath?: string;
+  publicOnly?: boolean;
 }

-export function TopNav({ lang = "pt", activePath }: TopNavProps) {
+export function TopNav({ lang = "pt", activePath, publicOnly = false }: TopNavProps) {
@@
-    { href: "/login?role=investor",    label: t("nav_investors") },
+    ...(!publicOnly ? [{ href: "/login?role=investor", label: t("nav_investors") }] : []),
@@
-        <Link className="appnav-link" href="/login">
-          {t("nav_login")}
-        </Link>
-        <Link className="btn btn-primary btn-sm" href="/login">
-          {t("cta_antecipar")} <Icon name="arrow_right" size={14} />
-        </Link>
+        {!publicOnly && (
+          <>
+            <Link className="appnav-link" href="/login">
+              {t("nav_login")}
+            </Link>
+            <Link className="btn btn-primary btn-sm" href="/login">
+              {t("cta_antecipar")} <Icon name="arrow_right" size={14} />
+            </Link>
+          </>
+        )}
```

```diff
--- a/apps/web/src/components/marketing/HeroNetwork.tsx
+++ b/apps/web/src/components/marketing/HeroNetwork.tsx
@@
-export function HeroNetwork() {
+interface HeroNetworkProps {
+  publicOnly?: boolean;
+}
+
+export function HeroNetwork({ publicOnly = false }: HeroNetworkProps) {
@@
-        <div
+        {!publicOnly && <div
           className="row"
           style={{ marginTop: 40, gap: 12, flexWrap: "wrap" }}
         >
@@
-        </div>
+        </div>}
```

```diff
--- a/apps/web/src/components/marketing/Audiences.tsx
+++ b/apps/web/src/components/marketing/Audiences.tsx
@@
-export function Audiences() {
+interface AudiencesProps {
+  publicOnly?: boolean;
+}
+
+export function Audiences({ publicOnly = false }: AudiencesProps) {
@@
-              <Link
+              {!publicOnly && <Link
                 className="btn btn-ghost"
                 href={c.href}
@@
-              </Link>
+              </Link>}
```

- [x] **Step 4: Run focused tests to verify GREEN**

Run:

```bash
npm test -w apps/web -- src/proxy.spec.ts 'src/app/(marketing)/page.spec.tsx' src/components/marketing/PublicLandingMode.spec.tsx
```

Expected: PASS.

## Task 3: Remove Placeholder Redirect And Verify Delivery

**Files:**
- Modify: `vercel.json`
- Modify: `docs/superpowers/plans/2026-05-23-public-landing-subdomain.md`

- [x] **Step 1: Remove the conflicting placeholder redirect**

Keep the deployment configuration serving the web build directly:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": "apps/web/.next"
}
```

- [x] **Step 2: Run full web verification**

Run:

```bash
npm test -w apps/web
npm run lint -w apps/web
npm run build:web
```

Expected: tests pass, ESLint exits without errors, and the Next.js production
build completes successfully.

Verification result on 2026-05-23: web tests and the production build pass.
Full web lint remains blocked by existing `react-hooks/set-state-in-effect`
errors in `AccountSettings.tsx`, `useRequireAuth.ts`, and `useTheme.ts`;
ESLint passes when scoped to the landing-host files changed by this plan.

- [x] **Step 3: Review changed code against project preferences**

Check that the implementation uses explicit `publicOnly` naming, adds no new
dependency or `any`, and leaves unrelated local edits intact.

- [x] **Step 4: Commit implementation files only**

```bash
git add docs/superpowers/plans/2026-05-23-public-landing-subdomain.md \
  apps/web/src/proxy.ts \
  apps/web/src/proxy.spec.ts \
  'apps/web/src/app/(marketing)/page.tsx' \
  'apps/web/src/app/(marketing)/page.spec.tsx' \
  apps/web/src/components/patterns/TopNav.tsx \
  apps/web/src/components/marketing/HeroNetwork.tsx \
  apps/web/src/components/marketing/Audiences.tsx \
  apps/web/src/components/marketing/PublicLandingMode.spec.tsx \
  vercel.json
git commit -m "feat(web): restrict public landing host"
```

Expected: the commit contains only landing-host work; unrelated worktree
changes remain unstaged.
