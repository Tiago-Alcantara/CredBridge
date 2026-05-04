# Graph Report - /home/tiago-linux/projects/CredBridge/apps/web  (2026-05-03)

## Corpus Check
- 70 files · ~20,791 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 231 nodes · 237 edges · 21 communities detected
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Pages, Routes & UI Components|Pages, Routes & UI Components]]
- [[_COMMUNITY_API Hooks (authreceivablesaudit)|API Hooks (auth/receivables/audit)]]
- [[_COMMUNITY_AuthKYCPayments Concepts|Auth/KYC/Payments Concepts]]
- [[_COMMUNITY_API Client Core (fetch, errors)|API Client Core (fetch, errors)]]
- [[_COMMUNITY_Layouts & KYC Provider|Layouts & KYC Provider]]
- [[_COMMUNITY_Pattern Components (SidebarTopBar)|Pattern Components (Sidebar/TopBar)]]
- [[_COMMUNITY_Shared Types & Stellar Concepts|Shared Types & Stellar Concepts]]
- [[_COMMUNITY_Root Provider & Theme|Root Provider & Theme]]
- [[_COMMUNITY_Receivables Hooks & Validations|Receivables Hooks & Validations]]
- [[_COMMUNITY_Brand Identity|Brand Identity]]
- [[_COMMUNITY_Web Config (NextESLint)|Web Config (Next/ESLint)]]
- [[_COMMUNITY_Charts (NavTrafficYield)|Charts (Nav/Traffic/Yield)]]
- [[_COMMUNITY_Misc 16|Misc 16]]
- [[_COMMUNITY_Misc 17|Misc 17]]
- [[_COMMUNITY_Misc 18|Misc 18]]
- [[_COMMUNITY_Misc 44|Misc 44]]
- [[_COMMUNITY_Misc 45|Misc 45]]
- [[_COMMUNITY_Misc 46|Misc 46]]
- [[_COMMUNITY_Misc 47|Misc 47]]
- [[_COMMUNITY_Misc 48|Misc 48]]
- [[_COMMUNITY_Misc 49|Misc 49]]

## God Nodes (most connected - your core abstractions)
1. `Icon()` - 15 edges
2. `apiFetch` - 14 edges
3. `useTranslation()` - 13 edges
4. `apiFetch()` - 8 edges
5. `LoginPage` - 7 edges
6. `useTranslation hook` - 7 edges
7. `Icon Component (24 named SVG icons)` - 6 edges
8. `Logo()` - 5 edges
9. `extractApiErrorMessage()` - 5 edges
10. `clearAccessToken()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Settlement interface` --shares_data_with--> `Stellar SEP-10 challenge/verify (stub)`  [INFERRED]
  packages/types/src/settlement.ts → docs/STATUS.md
- `Investor interface` --shares_data_with--> `Stellar SEP-10 challenge/verify (stub)`  [INFERRED]
  packages/types/src/investor.ts → docs/STATUS.md
- `createReceivableSchema` --conceptually_related_to--> `CreateReceivableInput`  [INFERRED]
  apps/web/src/lib/validations/receivable.ts → packages/types/src/receivable.ts
- `handleLogin()` --calls--> `extractApiErrorMessage()`  [INFERRED]
  apps/web/src/app/test/page.tsx → apps/web/src/lib/api/client.ts
- `handleRegister()` --calls--> `extractApiErrorMessage()`  [INFERRED]
  apps/web/src/app/test/page.tsx → apps/web/src/lib/api/client.ts

## Communities (50 total, 9 thin omitted)

### Community 0 - "Pages, Routes & UI Components"
Cohesion: 0.07
Nodes (7): useTranslation(), NavChart(), fmtBRL(), fmtTxHash(), TrafficChart(), Icon(), Logo()

### Community 1 - "API Hooks (auth/receivables/audit)"
Cohesion: 0.11
Nodes (15): logout(), clearAccessToken(), getAccessToken(), setAccessToken(), useLogin(), useRegister(), ApiError, apiFetch() (+7 more)

### Community 2 - "Auth/KYC/Payments Concepts"
Cohesion: 0.1
Nodes (27): KycFlow Stepper Component, LoginBG (auth background SVG), StellarAuth Component, Freighter Wallet, Pix payment rail, SEFAZ NF-e validation, Stellar SEP-10 challenge, Soroban Smart Contract (+19 more)

### Community 3 - "API Client Core (fetch, errors)"
Cohesion: 0.1
Nodes (22): QueryProvider, ApiError, apiFetch, extractApiErrorMessage, logout, setOnUnauthorized, useAuditTrail, useCreateDocument (+14 more)

### Community 4 - "Layouts & KYC Provider"
Cohesion: 0.21
Nodes (14): KycProviderService, AuthLayout (route group), InvestorLayout, PartnerLayout, PmeLayout, RootLayout (Web), InvestorDashboardPage, LoginPage (+6 more)

### Community 5 - "Pattern Components (Sidebar/TopBar)"
Cohesion: 0.22
Nodes (11): AppTopBar, MiniKpi, SidebarNavGroup, SidebarNavLink, Sidebar, TopNav, Icon primitive, Logo primitive (+3 more)

### Community 6 - "Shared Types & Stellar Concepts"
Cohesion: 0.2
Nodes (11): Stellar SEP-10 challenge/verify (stub), Document interface, DocumentType (invoice|contract|duplicate|kyc), RegisterDocumentInput, UploadDocumentInput, Types Barrel Index, Investor interface, CreateSettlementInput (+3 more)

### Community 7 - "Root Provider & Theme"
Cohesion: 0.22
Nodes (4): setOnUnauthorized(), useTheme(), ThemeToggle(), QueryProvider()

### Community 8 - "Receivables Hooks & Validations"
Cohesion: 0.2
Nodes (10): useCreateReceivable, useReceivables, zod, CreateReceivableInput, Receivable, ReceivableStatus, ReceivableType, createReceivableSchema (+2 more)

### Community 9 - "Brand Identity"
Cohesion: 0.43
Nodes (7): Apex Node Dot, CredBridge App Icon, CredBridge Brand Identity, Dark Rounded Square Tile, Diamond-Chevron Bridge Glyph, Cyan-to-Violet Brand Gradient, Receivables Bridge Concept

### Community 11 - "Web Config (Next/ESLint)"
Cohesion: 0.67
Nodes (3): Web ESLint Config, Next.js Config, Next.js Env Type Reference

### Community 12 - "Charts (Nav/Traffic/Yield)"
Cohesion: 0.67
Nodes (3): NavChart SVG, TrafficChart (Partner SVG bar chart), YieldSpark sparkline

## Ambiguous Edges - Review These
- `KycProviderService` → `TestPage (smoke test)`  [AMBIGUOUS]
  apps/web/src/app/test/page.tsx · relation: shares_data_with

## Knowledge Gaps
- **52 isolated node(s):** `Next.js Env Type Reference`, `Web ESLint Config`, `PostCSS Tailwind Config`, `OnboardingPage stub`, `MarketingLandingPage` (+47 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `KycProviderService` and `TestPage (smoke test)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Why does `apiFetch` connect `API Client Core (fetch, errors)` to `Receivables Hooks & Validations`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `apiFetch()` (e.g. with `getAccessToken()` and `clearAccessToken()`) actually correct?**
  _`apiFetch()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `LoginPage` (e.g. with `AuthLayout (route group)` and `TestPage (smoke test)`) actually correct?**
  _`LoginPage` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Next.js Env Type Reference`, `Web ESLint Config`, `PostCSS Tailwind Config` to the rest of the system?**
  _52 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Pages, Routes & UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `API Hooks (auth/receivables/audit)` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._