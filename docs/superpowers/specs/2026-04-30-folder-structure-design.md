# Folder Structure Design — CredBridge

**Date:** 2026-04-30
**Status:** Approved
**Scope:** Full project structure — monorepo, frontend, backend, shared packages

---

## Context

CredBridge is a receivables tokenization platform connecting SMEs with investors. Three user profiles: PME, Investor, Partner. Blockchain (Stellar) used for proof registration and settlement. Frontend already scaffolded as Next.js 16 App Router. Backend not yet created.

---

## Decisions

### 1. Monorepo with npm workspaces

Single repository with three workspaces: `apps/web`, `apps/api`, `packages/types`. No Turborepo — npm workspaces are sufficient for the MVP. Turborepo to be added only if CI build time becomes a problem.

**Reason:** TypeScript types like `Receivable`, `Settlement`, and `Investor` are shared between frontend and backend. Separate repos would require manual duplication with silent divergence risk.

### 2. Backend: Modular Monolith (NestJS)

Modules organized by business domain. Each module owns its controller, service, repository, DTOs, and entities. No formal Hexagonal architecture — too much boilerplate for the current team size and MVP stage.

**Reason:** Small team, product still in validation. Modular Monolith can evolve to Hexagonal or microservices later — the modules are already cohesive units.

### 3. External integrations isolated in `shared/`

Stellar, S3, KYC, and payment services live in `shared/` behind TypeScript interfaces. No business module imports an external SDK directly.

**Reason:** 4+ external integrations that may change providers. One interface per integration means swapping is a single file change, not a surgery across multiple services.

### 4. Frontend: existing structure preserved

Next.js App Router with route groups per user profile. No changes to existing structure — it moves into `apps/web/` inside the monorepo.

### 5. Stellar as sole blockchain

Single chain for MVP. Interface in `shared/blockchain/` allows adding a second chain without touching business modules.

---

## Full Folder Structure

```
credbridge/
├── apps/
│   │
│   ├── web/                                  ← Next.js (moved from current repo root)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (marketing)/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── login/page.tsx
│   │   │   │   │   └── onboarding/page.tsx
│   │   │   │   ├── (pme)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── pme/dashboard/page.tsx
│   │   │   │   ├── (investor)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── investor/dashboard/page.tsx
│   │   │   │   └── (partner)/
│   │   │   │       ├── layout.tsx
│   │   │   │       └── partner/dashboard/page.tsx
│   │   │   ├── components/
│   │   │   │   ├── primitives/               ← Icon, Logo, StatusBadge
│   │   │   │   ├── patterns/                 ← Sidebar, AppTopBar, TopNav
│   │   │   │   ├── pme/
│   │   │   │   ├── investor/
│   │   │   │   └── partner/
│   │   │   ├── lib/
│   │   │   │   ├── api/                      ← TanStack Query hooks
│   │   │   │   ├── i18n/                     ← pt.json, en.json
│   │   │   │   └── validations/              ← Zod schemas
│   │   │   ├── hooks/
│   │   │   ├── providers/
│   │   │   └── types/
│   │   ├── styles/
│   │   │   └── tokens.css
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── api/                                  ← NestJS
│       ├── src/
│       │   ├── modules/
│       │   │   ├── receivables/
│       │   │   │   ├── receivables.module.ts
│       │   │   │   ├── receivables.controller.ts
│       │   │   │   ├── receivables.service.ts
│       │   │   │   ├── receivables.repository.ts
│       │   │   │   ├── dto/
│       │   │   │   │   ├── create-receivable.dto.ts
│       │   │   │   │   └── receivable-response.dto.ts
│       │   │   │   └── entities/
│       │   │   │       └── receivable.entity.ts
│       │   │   ├── documents/
│       │   │   │   ├── documents.module.ts
│       │   │   │   ├── documents.controller.ts
│       │   │   │   ├── documents.service.ts
│       │   │   │   ├── dto/
│       │   │   │   └── entities/
│       │   │   ├── settlements/
│       │   │   │   ├── settlements.module.ts
│       │   │   │   ├── settlements.controller.ts
│       │   │   │   ├── settlements.service.ts
│       │   │   │   ├── dto/
│       │   │   │   └── entities/
│       │   │   ├── audit/
│       │   │   │   ├── audit.module.ts
│       │   │   │   ├── audit.service.ts
│       │   │   │   └── entities/
│       │   │   │       └── audit-log.entity.ts
│       │   │   └── auth/
│       │   │       ├── auth.module.ts
│       │   │       ├── auth.controller.ts
│       │   │       └── auth.service.ts
│       │   ├── shared/
│       │   │   ├── blockchain/
│       │   │   │   ├── blockchain.interface.ts
│       │   │   │   └── stellar.service.ts
│       │   │   ├── storage/
│       │   │   │   ├── storage.interface.ts
│       │   │   │   └── s3.service.ts
│       │   │   ├── kyc/
│       │   │   │   ├── kyc.interface.ts
│       │   │   │   └── kyc.service.ts
│       │   │   ├── payments/
│       │   │   │   ├── payments.interface.ts
│       │   │   │   └── pix.service.ts
│       │   │   └── prisma/
│       │   │       └── prisma.service.ts
│       │   ├── config/
│       │   │   └── configuration.ts
│       │   └── app.module.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       ├── test/
│       └── package.json
│
├── packages/
│   └── types/                                ← shared TypeScript types
│       ├── src/
│       │   ├── receivable.ts
│       │   ├── settlement.ts
│       │   ├── investor.ts
│       │   ├── document.ts
│       │   └── index.ts
│       └── package.json
│
├── package.json                              ← npm workspaces root
├── .env                                      ← shared env vars
└── .gitignore
```

---

## Module Rules

| Rule | Reason |
|---|---|
| Controller never calls Repository directly | All logic goes through Service |
| Service never imports external SDKs | External calls go through `shared/` |
| Module A never imports Service from Module B | Use NestJS events or extract to `shared/` |
| Repository only does Prisma, nothing else | No business logic in data layer |

---

## Call Flow — POST /receivables

```
HTTP Request
     ↓
ReceivablesController     ← validates DTO
     ↓
ReceivablesService        ← business rules, orchestration
     ↓           ↓              ↓
ReceivablesRepo  BlockchainSvc  AuditService
     ↓                ↓
   Prisma         StellarSdk (isolated in stellar.service.ts)
```

---

## Root package.json

```json
{
  "name": "credbridge",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w apps/web\" \"npm run dev -w apps/api\"",
    "dev:web": "npm run dev -w apps/web",
    "dev:api": "npm run dev -w apps/api",
    "build": "npm run build -w packages/types && npm run build -w apps/web && npm run build -w apps/api"
  }
}
```

---

## Migration Steps (existing frontend)

1. Create monorepo root with `package.json` workspaces config
2. Move current `CredBridge/` content into `apps/web/`
3. Scaffold NestJS at `apps/api/` with `nest new`
4. Create `packages/types/` with shared type definitions
5. Update `apps/web` imports to use `@credbridge/types` where applicable

---

## Out of Scope

- Turborepo / Nx pipeline (add later if build time demands it)
- CQRS or Event Sourcing (audit module only, future iteration)
- Formal Hexagonal architecture (revisit if team grows or integrations multiply)
- Second blockchain (interface is ready, implementation deferred)
