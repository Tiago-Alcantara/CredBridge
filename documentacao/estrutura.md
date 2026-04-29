# Estrutura de Arquivos — CredBridge

```
/home/tiago-linux/projects/CredBridge/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   └── page.tsx                    # landing page placeholder
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── onboarding/
│   │   │       └── page.tsx
│   │   ├── (pme)/
│   │   │   ├── layout.tsx                  # shell com Sidebar PME
│   │   │   └── pme/
│   │   │       └── dashboard/
│   │   │           └── page.tsx
│   │   ├── (investor)/
│   │   │   ├── layout.tsx                  # shell com Sidebar Investor
│   │   │   └── investor/
│   │   │       └── dashboard/
│   │   │           └── page.tsx
│   │   ├── (partner)/
│   │   │   ├── layout.tsx                  # shell com Sidebar Partner
│   │   │   └── partner/
│   │   │       └── dashboard/
│   │   │           └── page.tsx
│   │   ├── globals.css                     # imports tokens.css + resets
│   │   ├── layout.tsx                      # root layout com providers e fonts
│   │   └── page.tsx                        # redirect para /login
│   ├── components/
│   │   ├── primitives/
│   │   │   ├── Icon.tsx                    # portado de primitives.jsx
│   │   │   ├── Logo.tsx                    # portado de primitives.jsx
│   │   │   └── StatusBadge.tsx             # portado de primitives.jsx
│   │   ├── patterns/
│   │   │   ├── AppTopBar.tsx               # portado de primitives.jsx
│   │   │   ├── TopNav.tsx                  # portado de primitives.jsx
│   │   │   └── Sidebar.tsx                 # portado de primitives.jsx
│   │   ├── pme/
│   │   ├── investor/
│   │   └── partner/
│   ├── hooks/
│   │   └── useTheme.ts                     # dark/light theme via data-theme
│   ├── lib/
│   │   ├── format.ts                       # fmtBRL, fmtCNPJ, fmtTxHash
│   │   ├── i18n/
│   │   │   ├── pt.json                     # portado de STRINGS.pt
│   │   │   └── en.json                     # portado de STRINGS.en
│   │   ├── api/
│   │   │   ├── receivables.ts              # TanStack Query hooks
│   │   │   ├── documents.ts
│   │   │   ├── settlements.ts
│   │   │   └── audit.ts
│   │   └── validations/
│   │       ├── receivable.ts               # Zod schema
│   │       ├── document.ts
│   │       └── settlement.ts
│   ├── providers/
│   │   └── QueryProvider.tsx
│   └── types/
│       └── index.ts
├── styles/
│   └── tokens.css                          # portado de styles.css — fonte da verdade
├── public/
├── documentacao/
│   └── estrutura.md                        # este arquivo
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts                      # estende tokens do tokens.css
└── tsconfig.json
```
