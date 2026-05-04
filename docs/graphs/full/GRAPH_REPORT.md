# Graph Report - /home/tiago-linux/projects/CredBridge  (2026-05-03)

## Corpus Check
- Corpus is ~41,583 words - fits in a single context window. You may not need a graph.

## Summary
- 487 nodes · 495 edges · 66 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend Pages & UI Components|Frontend Pages & UI Components]]
- [[_COMMUNITY_Web API Hooks (authreceivablessettlements)|Web API Hooks (auth/receivables/settlements)]]
- [[_COMMUNITY_API Client Core|API Client Core]]
- [[_COMMUNITY_Backend Modules & DB Migrations|Backend Modules & DB Migrations]]
- [[_COMMUNITY_Project Docs & Specs|Project Docs & Specs]]
- [[_COMMUNITY_AuthKYCPayments Concepts|Auth/KYC/Payments Concepts]]
- [[_COMMUNITY_DI Tokens & Module Interfaces|DI Tokens & Module Interfaces]]
- [[_COMMUNITY_DTOs & Payments Service|DTOs & Payments Service]]
- [[_COMMUNITY_Stellar Blockchain Flow|Stellar Blockchain Flow]]
- [[_COMMUNITY_UI Pattern Components|UI Pattern Components]]
- [[_COMMUNITY_Root Provider & Theme|Root Provider & Theme]]
- [[_COMMUNITY_Design System Docs|Design System Docs]]
- [[_COMMUNITY_AuthService (NestJS)|AuthService (NestJS)]]
- [[_COMMUNITY_AuthController (NestJS)|AuthController (NestJS)]]
- [[_COMMUNITY_Brand & Icon Identity|Brand & Icon Identity]]
- [[_COMMUNITY_SettlementsController|SettlementsController]]
- [[_COMMUNITY_SettlementsRepository|SettlementsRepository]]
- [[_COMMUNITY_SettlementsService|SettlementsService]]
- [[_COMMUNITY_ReceivablesRepository|ReceivablesRepository]]
- [[_COMMUNITY_ReceivablesController|ReceivablesController]]
- [[_COMMUNITY_ReceivablesService|ReceivablesService]]
- [[_COMMUNITY_AuditService|AuditService]]
- [[_COMMUNITY_DocumentsRepository|DocumentsRepository]]
- [[_COMMUNITY_DocumentsController|DocumentsController]]
- [[_COMMUNITY_DocumentsService|DocumentsService]]
- [[_COMMUNITY_Misc 25|Misc 25]]
- [[_COMMUNITY_Misc 26|Misc 26]]
- [[_COMMUNITY_Misc 27|Misc 27]]
- [[_COMMUNITY_Misc 28|Misc 28]]
- [[_COMMUNITY_Misc 29|Misc 29]]
- [[_COMMUNITY_Misc 30|Misc 30]]
- [[_COMMUNITY_Misc 31|Misc 31]]
- [[_COMMUNITY_Misc 32|Misc 32]]
- [[_COMMUNITY_Misc 33|Misc 33]]
- [[_COMMUNITY_Misc 34|Misc 34]]
- [[_COMMUNITY_Misc 35|Misc 35]]
- [[_COMMUNITY_Misc 37|Misc 37]]
- [[_COMMUNITY_Misc 38|Misc 38]]
- [[_COMMUNITY_Misc 39|Misc 39]]
- [[_COMMUNITY_Misc 40|Misc 40]]
- [[_COMMUNITY_Misc 41|Misc 41]]
- [[_COMMUNITY_Misc 42|Misc 42]]
- [[_COMMUNITY_Misc 43|Misc 43]]
- [[_COMMUNITY_Misc 44|Misc 44]]
- [[_COMMUNITY_Misc 45|Misc 45]]
- [[_COMMUNITY_Misc 46|Misc 46]]
- [[_COMMUNITY_Misc 47|Misc 47]]
- [[_COMMUNITY_Misc 48|Misc 48]]
- [[_COMMUNITY_Misc 49|Misc 49]]
- [[_COMMUNITY_Misc 50|Misc 50]]
- [[_COMMUNITY_Misc 51|Misc 51]]
- [[_COMMUNITY_Misc 52|Misc 52]]
- [[_COMMUNITY_Misc 53|Misc 53]]
- [[_COMMUNITY_Misc 54|Misc 54]]
- [[_COMMUNITY_Misc 55|Misc 55]]
- [[_COMMUNITY_Misc 59|Misc 59]]
- [[_COMMUNITY_Misc 60|Misc 60]]
- [[_COMMUNITY_Misc 61|Misc 61]]
- [[_COMMUNITY_Misc 62|Misc 62]]
- [[_COMMUNITY_Misc 95|Misc 95]]
- [[_COMMUNITY_Misc 96|Misc 96]]
- [[_COMMUNITY_Misc 97|Misc 97]]
- [[_COMMUNITY_Misc 98|Misc 98]]
- [[_COMMUNITY_Misc 99|Misc 99]]
- [[_COMMUNITY_Misc 100|Misc 100]]
- [[_COMMUNITY_Misc 101|Misc 101]]

## God Nodes (most connected - your core abstractions)
1. `Icon()` - 15 edges
2. `apiFetch` - 14 edges
3. `useTranslation()` - 13 edges
4. `apiFetch()` - 8 edges
5. `AuthService` - 8 edges
6. `AuthModule` - 8 edges
7. `CredBridge README (monorepo overview)` - 8 edges
8. `AuthService` - 7 edges
9. `ReceivablesRepository` - 7 edges
10. `LoginPage` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Settlement interface` --shares_data_with--> `Stellar SEP-10 challenge/verify (stub)`  [INFERRED]
  packages/types/src/settlement.ts → docs/STATUS.md
- `Investor interface` --shares_data_with--> `Stellar SEP-10 challenge/verify (stub)`  [INFERRED]
  packages/types/src/investor.ts → docs/STATUS.md
- `AGENTS.md Next.js agent rules` --conceptually_related_to--> `CredBridge README (monorepo overview)`  [INFERRED]
  AGENTS.md → README.md
- `Estrutura de Arquivos (PT-BR legado)` --conceptually_related_to--> `Spec: Folder Structure Design`  [INFERRED]
  documentacao/estrutura.md → docs/superpowers/specs/2026-04-30-folder-structure-design.md
- `CredBridge README (monorepo overview)` --references--> `Types Barrel Index`  [EXTRACTED]
  README.md → packages/types/src/index.ts

## Communities (102 total, 50 thin omitted)

### Community 0 - "Frontend Pages & UI Components"
Cohesion: 0.07
Nodes (7): useTranslation(), NavChart(), fmtBRL(), fmtTxHash(), TrafficChart(), Icon(), Logo()

### Community 1 - "Web API Hooks (auth/receivables/settlements)"
Cohesion: 0.09
Nodes (15): logout(), clearAccessToken(), getAccessToken(), setAccessToken(), useLogin(), useRegister(), ApiError, apiFetch() (+7 more)

### Community 2 - "API Client Core"
Cohesion: 0.07
Nodes (32): QueryProvider, ApiError, apiFetch, extractApiErrorMessage, logout, setOnUnauthorized, useAuditTrail, useCreateDocument (+24 more)

### Community 3 - "Backend Modules & DB Migrations"
Cohesion: 0.12
Nodes (29): Align with shared types migration, AppController e2e test, AppModule (NestJS Root), AuditController, AuditLogInput interface, AuditModule, AuditService, AuditLog table (Prisma) (+21 more)

### Community 4 - "Project Docs & Specs"
Cohesion: 0.11
Nodes (28): CredBridge README (monorepo overview), API endpoints scaffold (v1 prefix), MVP fixed decisions (NF-e only, JWT, no Solana, no Redis), Project status snapshot 2026-05-02, Nest starter README (apps/api), AuditLog polymórfico (entityType/entityId), JWT email/password auth (bcrypt 10 rounds), Modular Monolith (NestJS) decision (+20 more)

### Community 5 - "Auth/KYC/Payments Concepts"
Cohesion: 0.1
Nodes (27): KycFlow Stepper Component, LoginBG (auth background SVG), StellarAuth Component, Freighter Wallet, Pix payment rail, SEFAZ NF-e validation, Stellar SEP-10 challenge, Soroban Smart Contract (+19 more)

### Community 6 - "DI Tokens & Module Interfaces"
Cohesion: 0.15
Nodes (20): BLOCKCHAIN_SERVICE DI Token, BlockchainService Interface, BlockchainModule (Global), KYC_SERVICE DI Token, KycService Interface, KycModule (Global), KycProviderService, AuthLayout (route group) (+12 more)

### Community 7 - "DTOs & Payments Service"
Cohesion: 0.18
Nodes (18): CreateDocumentDto, CreateNestedDocumentDto, CreateReceivableDto, CreateSettlementDto, PAYMENTS_SERVICE token, PaymentsService (interface), PaymentsModule, PixService (+10 more)

### Community 8 - "Stellar Blockchain Flow"
Cohesion: 0.12
Nodes (18): Asset Tokenizado Confirmado On-Chain, Construir + Assinar Transacao Stellar, CredBridge Backend, Descriptografar Keypair Stellar do usuario, Gravar txHash status = ACTIVE, Horizon API (Stellar), Keypair Stellar (criptografado), Ledger Fecha (~5 segundos) (+10 more)

### Community 9 - "UI Pattern Components"
Cohesion: 0.22
Nodes (11): AppTopBar, MiniKpi, SidebarNavGroup, SidebarNavLink, Sidebar, TopNav, Icon primitive, Logo primitive (+3 more)

### Community 10 - "Root Provider & Theme"
Cohesion: 0.22
Nodes (4): setOnUnauthorized(), useTheme(), ThemeToggle(), QueryProvider()

### Community 11 - "Design System Docs"
Cohesion: 0.22
Nodes (10): AGENTS.md Next.js agent rules, Claude Code project instructions, Design System Full, Design System Lite, Persona accent assignment (PME violet, Investor blue, Partner green), Dark/Light theme tokens via data-theme, Typography stack (Space Grotesk / Inter / JetBrains Mono), Estrutura de Arquivos (PT-BR legado) (+2 more)

### Community 14 - "Brand & Icon Identity"
Cohesion: 0.43
Nodes (7): Apex Node Dot, CredBridge App Icon, CredBridge Brand Identity, Dark Rounded Square Tile, Diamond-Chevron Bridge Glyph, Cyan-to-Violet Brand Gradient, Receivables Bridge Concept

### Community 32 - "Misc 32"
Cohesion: 0.5
Nodes (4): S3Service, STORAGE_SERVICE token, StorageService (interface), StorageModule

### Community 34 - "Misc 34"
Cohesion: 0.67
Nodes (3): Web ESLint Config, Next.js Config, Next.js Env Type Reference

### Community 35 - "Misc 35"
Cohesion: 0.67
Nodes (3): NavChart SVG, TrafficChart (Partner SVG bar chart), YieldSpark sparkline

## Ambiguous Edges - Review These
- `SettlementsService` → `PixService`  [AMBIGUOUS]
  apps/api/src/modules/settlements/settlements.service.ts · relation: conceptually_related_to
- `KycProviderService` → `TestPage (smoke test)`  [AMBIGUOUS]
  apps/web/src/app/test/page.tsx · relation: shares_data_with

## Knowledge Gaps
- **96 isolated node(s):** `AppModule`, `AuditModule`, `JwtAuthGuard`, `AuthModule`, `LoginDto` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `SettlementsService` and `PixService`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `KycProviderService` and `TestPage (smoke test)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
- **Are the 2 inferred relationships involving `apiFetch()` (e.g. with `getAccessToken()` and `clearAccessToken()`) actually correct?**
  _`apiFetch()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AppModule`, `AuditModule`, `JwtAuthGuard` to the rest of the system?**
  _96 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend Pages & UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Web API Hooks (auth/receivables/settlements)` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `API Client Core` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._