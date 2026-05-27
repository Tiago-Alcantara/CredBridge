# Estrutura de Arquivos — CredBridge

Este documento descreve a estrutura atual do repositório em `/home/tiago-linux/projects/CredBridge`.

```text
CredBridge/
├── apps/
│   ├── web/
│   │   ├── package.json                  # @credbridge/web
│   │   ├── next.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── vitest.config.ts
│   │   ├── styles/
│   │   │   └── tokens.css                # fonte da verdade visual
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx            # providers globais, fontes e tema
│   │       │   ├── globals.css           # Tailwind v4 + tokens
│   │       │   ├── (marketing)/page.tsx
│   │       │   ├── (auth)/
│   │       │   │   ├── layout.tsx
│   │       │   │   ├── login/page.tsx
│   │       │   │   └── onboarding/
│   │       │   │       ├── page.tsx      # redirect para /login
│   │       │   │       └── role/page.tsx # escolha PME/investor + KYC PME
│   │       │   ├── (pme)/
│   │       │   │   ├── layout.tsx
│   │       │   │   └── pme/
│   │       │   │       ├── dashboard/page.tsx
│   │       │   │       └── configuracoes/page.tsx
│   │       │   ├── (investor)/
│   │       │   │   ├── layout.tsx
│   │       │   │   └── investor/
│   │       │   │       ├── dashboard/page.tsx
│   │       │   │       └── configuracoes/page.tsx
│   │       │   ├── (partner)/
│   │       │   │   ├── layout.tsx
│   │       │   │   └── partner/dashboard/page.tsx
│   │       │   └── auditoria/page.tsx    # página pública de auditoria
│   │       ├── components/
│   │       │   ├── anchor/               # drawers/modais Etherfuse
│   │       │   ├── audit/
│   │       │   ├── auth/                 # Privy, KYC, wallet setup
│   │       │   ├── investor/
│   │       │   ├── marketing/
│   │       │   ├── partner/
│   │       │   ├── patterns/             # Sidebar, TopNav, MiniKpi, Timeline
│   │       │   ├── pme/
│   │       │   ├── primitives/           # Icon, Logo, Drawer, Skeleton, StatusBadge
│   │       │   └── settings/
│   │       ├── hooks/
│   │       ├── lib/
│   │       │   ├── api/                  # clientes HTTP por domínio
│   │       │   ├── financial-actions/    # autorização financeira via Privy
│   │       │   ├── i18n/
│   │       │   ├── validations/
│   │       │   └── format.ts
│   │       ├── providers/
│   │       ├── test/
│   │       └── types/
│   │
│   └── api/
│       ├── package.json                  # @credbridge/api
│       ├── prisma.config.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── seed.ts
│       │   └── migrations/
│       └── src/
│           ├── main.ts                   # bootstrap, /v1, CORS, Helmet, ValidationPipe
│           ├── app.module.ts             # módulos de domínio + shared
│           ├── common/
│           ├── modules/
│           │   ├── anchor/
│           │   ├── audit/
│           │   ├── auth/
│           │   ├── documents/
│           │   ├── financial-authorizations/
│           │   ├── health/
│           │   ├── investments/
│           │   ├── receivables/
│           │   ├── settlements/
│           │   └── stellar-wallet/
│           └── shared/
│               ├── blockchain/
│               ├── kyc/
│               ├── payments/
│               ├── prisma/
│               └── storage/
│
├── packages/
│   ├── types/
│   │   └── src/                          # receivable, settlement, investor, document, audit, investment
│   └── anchor-client/
│       └── src/                          # Etherfuse + SEP helpers
│
├── contracts/
│   ├── Cargo.toml
│   └── src/                              # contrato Soroban de NF-e
│
├── docs/
│   ├── DESIGN.md
│   ├── DESIGN-lite.md
│   ├── STATUS.md
│   ├── brand/
│   ├── flows/
│   └── superpowers/
│
├── documentacao/
│   ├── estrutura.md
│   ├── fluxo-login-atual.md
│   ├── smart-wallet-fluxo-regras.md
│   ├── anchor-etherfuse-integration.md
│   └── Preference - Coding Style.md
│
├── .env.example
├── docker-compose.yml
├── package.json
├── package-lock.json
├── README.md
├── AGENTS.md
└── CLAUDE.md
```

## Fontes de verdade

- Estrutura npm: `package.json` raiz e `package.json` dos workspaces.
- Rotas web: arquivos em `apps/web/src/app`.
- Rotas API: controllers em `apps/api/src/modules/**`.
- Banco: `apps/api/prisma/schema.prisma` e migrations.
- Design tokens: `apps/web/styles/tokens.css`.
- Fluxo de login: `documentacao/fluxo-login-atual.md`.
- Wallet Privy e autorização financeira: `documentacao/smart-wallet-fluxo-regras.md`.
