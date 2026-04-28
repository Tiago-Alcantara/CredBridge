# CredBridge Frontend Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inicializar o projeto Next.js 14 do CredBridge com a estrutura de pastas, tokens de design, primitivos de UI e rotas para os três perfis (PME, Investor, Partner) — alinhado ao DESIGN_SYSTEM.md e às preferências de código do projeto.

**Architecture:** App Router com cinco route groups: `(marketing)`, `(auth)`, `(pme)`, `(investor)`, `(partner)`. Tokens CSS como fonte da verdade para cores/tipografia — Tailwind estendido para referenciar esses tokens. Componentes em `components/primitives/` e `components/patterns/` portados do protótipo existente. Três grupos de features em `components/pme/`, `components/investor/`, `components/partner/`.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Tailwind CSS, Space Grotesk + Inter + JetBrains Mono, React Hook Form, Zod, TanStack Query

**Coding Style:**
- Nomes explícitos e descritivos; clareza acima de brevidade
- Código linear e legível; sem helpers que só chamam outro helper
- Sem `any`; sem abstrações prematuras
- Named exports apenas — zero `export default` em componentes
- Comentários apenas quando o "porquê" não é óbvio no código

---

## File Structure

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
├── .env.local.example
├── next.config.ts
├── tailwind.config.ts                      # estende tokens do tokens.css
└── tsconfig.json
```

---

### Task 1: Inicializar projeto Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Inicializar Next.js com create-next-app**

```bash
cd /home/tiago-linux/projects/CredBridge
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

Quando perguntar sobre Turbopack: **No**

- [ ] **Step 2: Verificar instalação**

```bash
cd /home/tiago-linux/projects/CredBridge
npm run dev
```

Esperado: servidor rodando em `http://localhost:3000` sem erros de compilação.

- [ ] **Step 3: Habilitar strict mode no tsconfig**

Verificar que `tsconfig.json` tem `"strict": true`. Se não tiver:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

- [ ] **Step 4: Parar o servidor e commitar**

```bash
git add .
git commit -m "chore: initialize Next.js 14 with TypeScript strict and Tailwind"
```

---

### Task 2: Instalar dependências

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar dependências de produto**

```bash
cd /home/tiago-linux/projects/CredBridge
npm install \
  @tanstack/react-query \
  @tanstack/react-query-devtools \
  react-hook-form \
  @hookform/resolvers \
  zod \
  clsx
```

- [ ] **Step 2: Verificar ausência de conflitos**

```bash
npm ls --depth=0
```

Esperado: nenhum `UNMET PEER DEPENDENCY`.

- [ ] **Step 3: Commitar dependências**

```bash
git add package.json package-lock.json
git commit -m "chore: add TanStack Query, React Hook Form, Zod, clsx"
```

---

### Task 3: Portar tokens.css e configurar Tailwind

**Files:**
- Create: `styles/tokens.css`
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Criar pasta styles e copiar tokens**

```bash
mkdir -p /home/tiago-linux/projects/CredBridge/styles
cp "/home/tiago-linux/Obsidian Vault/01 Projects/CredBridge/Front - CredBridge/styles.css" \
   /home/tiago-linux/projects/CredBridge/styles/tokens.css
```

- [ ] **Step 2: Verificar que tokens.css foi copiado**

```bash
head -20 /home/tiago-linux/projects/CredBridge/styles/tokens.css
```

Esperado: linhas com `:root`, `--bg`, `--surface`, `--blue`, etc.

- [ ] **Step 3: Atualizar globals.css para importar tokens**

Substituir conteúdo de `src/app/globals.css`:

```css
@import "../../styles/tokens.css";

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Reset base alinhado com os tokens */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg);
  color: var(--fg);
  font-family: var(--body);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 4: Configurar Tailwind para referenciar os tokens CSS**

Substituir `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-1": "var(--bg-1)",
        "bg-2": "var(--bg-2)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        "line-2": "var(--line-2)",
        fg: "var(--fg)",
        "fg-1": "var(--fg-1)",
        "fg-2": "var(--fg-2)",
        "fg-3": "var(--fg-3)",
        blue: "var(--blue)",
        violet: "var(--violet)",
        green: "var(--green)",
        amber: "var(--amber)",
        red: "var(--red)",
      },
      fontFamily: {
        sans: ["var(--sans)"],
        body: ["var(--body)"],
        mono: ["var(--mono)"],
      },
      borderRadius: {
        card: "var(--radius)",
        "card-lg": "var(--radius-lg)",
        "card-sm": "var(--radius-sm)",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Verificar build sem erros**

```bash
npm run build
```

Esperado: `✓ Compiled successfully`.

- [ ] **Step 6: Commitar tokens e Tailwind**

```bash
git add styles/ src/app/globals.css tailwind.config.ts
git commit -m "chore: port design tokens to styles/tokens.css and extend Tailwind theme"
```

---

### Task 4: Configurar fontes e sistema de tema dark/light

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/hooks/useTheme.ts`

- [ ] **Step 1: Instalar fontes via next/font**

As fontes Space Grotesk, Inter e JetBrains Mono estão disponíveis no Google Fonts via `next/font/google`. Não é necessária instalação de pacote.

- [ ] **Step 2: Criar hook useTheme**

Criar `src/hooks/useTheme.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "cb-theme";
const DEFAULT_THEME: Theme = "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored === "light" || stored === "dark" ? stored : DEFAULT_THEME;
    applyTheme(initial);
    setTheme(initial);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return { theme, toggleTheme };
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}
```

- [ ] **Step 3: Criar root layout com fontes e tema inicial**

Substituir `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CredBridge",
  description: "Plataforma de antecipação de recebíveis com liquidação on-chain via Stellar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verificar build**

```bash
npm run build
```

Esperado: sem erros de tipagem ou compilação.

- [ ] **Step 5: Commitar**

```bash
git add src/app/layout.tsx src/hooks/useTheme.ts
git commit -m "feat: add Space Grotesk/Inter/JetBrains Mono fonts and dark/light theme hook"
```

---

### Task 5: Criar lib/format.ts

**Files:**
- Create: `src/lib/format.ts`

- [ ] **Step 1: Criar formatters portados do protótipo**

Criar `src/lib/format.ts`:

```ts
/**
 * Formata número como moeda BRL.
 * compact=true usa sufixos k/M/B para valores grandes.
 */
export function fmtBRL(value: number, options: { compact?: boolean } = {}): string {
  if (options.compact) {
    if (value >= 1e9) return `R$ ${(value / 1e9).toFixed(1).replace(".", ",")}B`;
    if (value >= 1e6) return `R$ ${(value / 1e6).toFixed(1).replace(".", ",")}M`;
    if (value >= 1e3) return `R$ ${(value / 1e3).toFixed(0)}k`;
  }
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formata string de 14 dígitos como CNPJ: 00.000.000/0000-00
 */
export function fmtCNPJ(digits: string): string {
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Formata string de 11 dígitos como CPF: 000.000.000-00
 */
export function fmtCPF(digits: string): string {
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/**
 * Trunca um hash ou account ID mostrando início e fim.
 * Ex: GDCH7Q4X…FQT9M4
 */
export function fmtTxHash(hash: string, prefixLength = 8): string {
  if (hash.length <= prefixLength + 4) return hash;
  return `${hash.slice(0, prefixLength)}…${hash.slice(-4)}`;
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 3: Commitar**

```bash
git add src/lib/format.ts
git commit -m "feat: add fmtBRL, fmtCNPJ, fmtCPF, fmtTxHash formatters"
```

---

### Task 6: Portar strings de i18n

**Files:**
- Create: `src/lib/i18n/pt.json`
- Create: `src/lib/i18n/en.json`
- Create: `src/lib/i18n/useTranslation.ts`

- [ ] **Step 1: Criar pt.json**

Criar `src/lib/i18n/pt.json`:

```json
{
  "nav_product": "Produto",
  "nav_howitworks": "Como funciona",
  "nav_investors": "Investidores",
  "nav_partners": "Parceiros",
  "nav_docs": "Docs",
  "nav_login": "Entrar",
  "hero_eyebrow": "Protocolo de antecipação de recebíveis · Stellar",
  "hero_title": "A ponte entre\nrecebíveis e liquidez on-chain.",
  "hero_sub": "Antecipe NF-e em minutos via Pix. Investidores recebem yield lastreado em notas fiscais reais, com liquidação verificável na blockchain Stellar.",
  "cta_antecipar": "Antecipar recebíveis",
  "cta_investir": "Investir",
  "cta_api": "Integrar via API",
  "howitworks_eyebrow": "Fluxo da operação",
  "howitworks_title": "Três atores.\nUma liquidação verificável.",
  "howitworks_sub": "Cada cessão vira uma transação Stellar assinada. Smart contracts Soroban orquestram o repasse de recursos e a liquidação do boleto.",
  "stats_title": "Números ao vivo",
  "stat_anticipated": "Antecipado",
  "stat_smes": "PMEs atendidas",
  "stat_yield": "Yield médio ao ano",
  "stat_nav": "NAV do fundo",
  "audiences_title": "Para quem\né a CredBridge.",
  "audience_pme": "PME",
  "audience_inv": "Investidor",
  "audience_partner": "Parceiro",
  "footer_rights": "© 2026 CredBridge Protocol. Todos os direitos reservados.",
  "login_title": "Entre na CredBridge",
  "login_sub": "Escolha seu perfil para continuar",
  "role_pme": "PME",
  "role_pme_desc": "Antecipe seus recebíveis",
  "role_inv": "Investidor",
  "role_inv_desc": "Invista em cotas do fundo",
  "role_partner": "Parceiro",
  "role_partner_desc": "Integre sua plataforma",
  "login_email": "E-mail corporativo",
  "login_password": "Senha",
  "login_continue": "Continuar",
  "login_stellar": "Conectar carteira Stellar",
  "login_or": "ou",
  "kyc_step_1": "Dados básicos",
  "kyc_step_2": "Empresa",
  "kyc_step_3": "Documentos",
  "kyc_step_4": "Aprovação",
  "dash_greeting": "Bom dia",
  "dash_avail": "Saldo disponível",
  "dash_pending": "Antecipações pendentes",
  "dash_released": "Liberado este mês",
  "dash_nf_count": "NF-e ativas",
  "dash_upload": "Enviar NF-e",
  "dash_upload_desc": "Arraste o XML aqui ou clique para selecionar",
  "dash_withdraw": "Sacar via Pix",
  "dash_history": "Histórico de operações",
  "dash_active": "Antecipações ativas",
  "inv_overview": "Visão do portfólio",
  "inv_invested": "Total investido",
  "inv_nav": "NAV atual",
  "inv_yield": "Yield acumulado",
  "inv_shares": "Cotas",
  "inv_senior": "Cota Sênior",
  "inv_angel": "Cota Anjo",
  "inv_buy": "Comprar cotas",
  "inv_sell": "Vender cotas",
  "inv_receivables": "Recebíveis ativos",
  "inv_nav_chart": "Evolução do NAV",
  "inv_senior_desc": "Baixo risco · liquidação prioritária",
  "inv_angel_desc": "Alto rendimento · subordinação",
  "api_keys": "Chaves de API",
  "api_new_key": "Nova chave",
  "api_webhooks": "Webhooks",
  "api_monitor": "Monitor em tempo real",
  "api_docs": "Documentação",
  "api_quick": "Guia rápido",
  "status_pending": "Pendente",
  "status_active": "Ativa",
  "status_completed": "Liquidada",
  "status_defaulted": "Inadimplente",
  "search": "Buscar",
  "view_all": "Ver todas",
  "verify_chain": "Verificar on-chain"
}
```

- [ ] **Step 2: Criar en.json**

Criar `src/lib/i18n/en.json`:

```json
{
  "nav_product": "Product",
  "nav_howitworks": "How it works",
  "nav_investors": "Investors",
  "nav_partners": "Partners",
  "nav_docs": "Docs",
  "nav_login": "Sign in",
  "hero_eyebrow": "Receivables anticipation protocol · Stellar",
  "hero_title": "The bridge between\nreceivables and on-chain liquidity.",
  "hero_sub": "Anticipate invoices (NF-e) in minutes via Pix. Investors earn yield backed by real receivables, with verifiable settlement on the Stellar blockchain.",
  "cta_antecipar": "Anticipate receivables",
  "cta_investir": "Invest",
  "cta_api": "Integrate via API",
  "howitworks_eyebrow": "Operation flow",
  "howitworks_title": "Three actors.\nOne verifiable settlement.",
  "howitworks_sub": "Each assignment becomes a signed Stellar transaction. Soroban smart contracts orchestrate fund transfer and invoice settlement.",
  "stats_title": "Live numbers",
  "stat_anticipated": "Anticipated",
  "stat_smes": "SMEs served",
  "stat_yield": "Avg yield p.a.",
  "stat_nav": "Fund NAV",
  "audiences_title": "Who CredBridge\nis for.",
  "audience_pme": "SME",
  "audience_inv": "Investor",
  "audience_partner": "Partner",
  "footer_rights": "© 2026 CredBridge Protocol. All rights reserved.",
  "login_title": "Sign in to CredBridge",
  "login_sub": "Pick your profile to continue",
  "role_pme": "SME",
  "role_pme_desc": "Anticipate your receivables",
  "role_inv": "Investor",
  "role_inv_desc": "Invest in fund shares",
  "role_partner": "Partner",
  "role_partner_desc": "Integrate your platform",
  "login_email": "Corporate email",
  "login_password": "Password",
  "login_continue": "Continue",
  "login_stellar": "Connect Stellar wallet",
  "login_or": "or",
  "kyc_step_1": "Basic info",
  "kyc_step_2": "Company",
  "kyc_step_3": "Documents",
  "kyc_step_4": "Approval",
  "dash_greeting": "Good morning",
  "dash_avail": "Available balance",
  "dash_pending": "Pending anticipations",
  "dash_released": "Released this month",
  "dash_nf_count": "Active invoices",
  "dash_upload": "Upload invoice",
  "dash_upload_desc": "Drag XML here or click to select",
  "dash_withdraw": "Withdraw via Pix",
  "dash_history": "Operation history",
  "dash_active": "Active anticipations",
  "inv_overview": "Portfolio overview",
  "inv_invested": "Total invested",
  "inv_nav": "Current NAV",
  "inv_yield": "Accrued yield",
  "inv_shares": "Shares",
  "inv_senior": "Senior share",
  "inv_angel": "Angel share",
  "inv_buy": "Buy shares",
  "inv_sell": "Sell shares",
  "inv_receivables": "Active receivables",
  "inv_nav_chart": "NAV over time",
  "inv_senior_desc": "Low risk · priority settlement",
  "inv_angel_desc": "High yield · subordinated",
  "api_keys": "API keys",
  "api_new_key": "New key",
  "api_webhooks": "Webhooks",
  "api_monitor": "Real-time monitor",
  "api_docs": "Documentation",
  "api_quick": "Quick start",
  "status_pending": "Pending",
  "status_active": "Active",
  "status_completed": "Settled",
  "status_defaulted": "Defaulted",
  "search": "Search",
  "view_all": "View all",
  "verify_chain": "Verify on-chain"
}
```

- [ ] **Step 3: Criar hook useTranslation**

Criar `src/lib/i18n/useTranslation.ts`:

```ts
"use client";

import { useCallback } from "react";
import ptStrings from "./pt.json";
import enStrings from "./en.json";

type Lang = "pt" | "en";
type StringKey = keyof typeof ptStrings;

const strings: Record<Lang, Record<string, string>> = {
  pt: ptStrings,
  en: enStrings,
};

export function useTranslation(lang: Lang = "pt") {
  const t = useCallback(
    (key: StringKey): string => {
      return strings[lang]?.[key] ?? strings.pt[key] ?? key;
    },
    [lang]
  );

  return { t };
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Commitar i18n**

```bash
git add src/lib/i18n/
git commit -m "feat: add pt/en string catalogs and useTranslation hook"
```

---

### Task 7: Portar primitivos de UI

**Files:**
- Create: `src/components/primitives/Icon.tsx`
- Create: `src/components/primitives/Logo.tsx`
- Create: `src/components/primitives/StatusBadge.tsx`

- [ ] **Step 1: Criar Icon.tsx**

Criar `src/components/primitives/Icon.tsx`:

```tsx
type IconName =
  | "home" | "box" | "zap" | "chart" | "wallet" | "code"
  | "settings" | "plus" | "arrow_right" | "arrow_up_right"
  | "upload" | "download" | "check" | "chain" | "shield"
  | "bell" | "search" | "key" | "webhook" | "doc" | "bolt"
  | "user" | "logout" | "copy" | "eye" | "menu";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

const iconPaths: Record<IconName, React.ReactNode> = {
  home:           <><path d="M3 11L12 4l9 7"/><path d="M5 10v10h14V10"/></>,
  box:            <><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></>,
  zap:            <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
  chart:          <><path d="M3 20h18"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-4"/></>,
  wallet:         <><path d="M3 6h15a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M3 9h18"/><circle cx="17" cy="15" r="1.2" fill="currentColor" stroke="none"/></>,
  code:           <><path d="M8 6l-5 6 5 6"/><path d="M16 6l5 6-5 6"/><path d="M14 4l-4 16"/></>,
  settings:       <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  plus:           <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  arrow_right:    <><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></>,
  arrow_up_right: <><path d="M7 17L17 7"/><path d="M8 7h9v9"/></>,
  upload:         <><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/></>,
  download:       <><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/></>,
  check:          <path d="M5 12l5 5L20 6"/>,
  chain:          <><path d="M9.5 14.5a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6L11 7.4"/><path d="M14.5 9.5a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6L13 16.6"/></>,
  shield:         <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>,
  bell:           <><path d="M6 10a6 6 0 1 1 12 0c0 4 2 6 2 6H4s2-2 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  search:         <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
  key:            <><circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M18 12v4"/><path d="M21 12v3"/></>,
  webhook:        <><circle cx="6" cy="7" r="3"/><circle cx="18" cy="17" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 5L14 14"/><path d="M15 17H9"/></>,
  doc:            <><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 13h7"/><path d="M10 17h7"/></>,
  bolt:           <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
  user:           <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></>,
  logout:         <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></>,
  copy:           <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
  eye:            <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  menu:           <><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>,
};

export function Icon({ name, size = 18, className }: IconProps) {
  const paths = iconPaths[name];
  if (!paths) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}
```

- [ ] **Step 2: Criar Logo.tsx**

Criar `src/components/primitives/Logo.tsx`:

```tsx
import Link from "next/link";

interface LogoMarkProps {
  size?: number;
}

export function LogoMark({ size = 28 }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="cblg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00D4FF" />
          <stop offset="1" stopColor="#7B2FFF" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="27" height="27" rx="7" stroke="url(#cblg)" strokeWidth="1" />
      <path
        d="M7 10.5 L14 6 L21 10.5 L14 15 Z"
        stroke="url(#cblg)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7 17.5 L14 22 L21 17.5"
        stroke="url(#cblg)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="10.5" r="1.3" fill="#00D4FF" />
    </svg>
  );
}

interface LogoProps {
  size?: number;
}

export function Logo({ size = 28 }: LogoProps) {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark">
        <LogoMark size={size} />
      </span>
      <span>CredBridge</span>
    </Link>
  );
}
```

- [ ] **Step 3: Criar StatusBadge.tsx**

Criar `src/components/primitives/StatusBadge.tsx`:

```tsx
import { useTranslation } from "@/lib/i18n/useTranslation";

type ReceivableStatus = "pending" | "active" | "completed" | "defaulted";
type Lang = "pt" | "en";

interface StatusBadgeProps {
  status: ReceivableStatus;
  lang?: Lang;
}

const statusConfig: Record<ReceivableStatus, { badgeClass: string; stringKey: string }> = {
  pending:   { badgeClass: "badge pending",   stringKey: "status_pending" },
  active:    { badgeClass: "badge active",     stringKey: "status_active" },
  completed: { badgeClass: "badge completed",  stringKey: "status_completed" },
  defaulted: { badgeClass: "badge defaulted",  stringKey: "status_defaulted" },
};

export function StatusBadge({ status, lang = "pt" }: StatusBadgeProps) {
  const { t } = useTranslation(lang);
  const { badgeClass, stringKey } = statusConfig[status];

  return (
    <span className={badgeClass}>
      {t(stringKey as Parameters<typeof t>[0])}
    </span>
  );
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Commitar primitivos**

```bash
git add src/components/primitives/
git commit -m "feat: port Icon, Logo, LogoMark, StatusBadge primitives from prototype"
```

---

### Task 8: Portar componentes de padrão (AppTopBar, TopNav, Sidebar)

**Files:**
- Create: `src/components/patterns/AppTopBar.tsx`
- Create: `src/components/patterns/TopNav.tsx`
- Create: `src/components/patterns/Sidebar.tsx`

- [ ] **Step 1: Criar AppTopBar.tsx**

Criar `src/components/patterns/AppTopBar.tsx`:

```tsx
"use client";

import { Icon } from "@/components/primitives/Icon";
import { Logo } from "@/components/primitives/Logo";
import { fmtTxHash } from "@/lib/format";

interface AppTopBarUser {
  name: string;
  initials: string;
  roleLabel: string;
  stellarAccountId?: string;
}

interface AppTopBarProps {
  user: AppTopBarUser;
}

export function AppTopBar({ user }: AppTopBarProps) {
  const stellarDisplay = user.stellarAccountId
    ? fmtTxHash(user.stellarAccountId, 6)
    : "GA…X7Q";

  return (
    <nav className="appnav">
      <div className="wrap-wide">
        <Logo />
        <span className="badge neutral no-dot" style={{ marginLeft: 4 }}>
          {user.roleLabel}
        </span>
        <div style={{ flex: 1 }} />
        <div className="row" style={{ gap: 8 }}>
          <div className="chip">
            <span className="dot-live" />
            <span>Stellar</span>
            <span className="mono t-2" style={{ fontSize: 11 }}>{stellarDisplay}</span>
          </div>
          <button className="btn btn-ghost btn-sm" aria-label="Buscar">
            <Icon name="search" size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" aria-label="Notificações">
            <Icon name="bell" size={14} />
          </button>
          <div
            className="row"
            style={{
              gap: 10,
              padding: "4px 10px 4px 4px",
              borderRadius: 999,
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--blue), var(--violet))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 12,
                color: "#04101A",
              }}
            >
              {user.initials}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Criar TopNav.tsx**

Criar `src/components/patterns/TopNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Icon } from "@/components/primitives/Icon";
import { Logo } from "@/components/primitives/Logo";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Lang = "pt" | "en";

interface TopNavProps {
  lang?: Lang;
  activePath?: string;
}

export function TopNav({ lang = "pt", activePath }: TopNavProps) {
  const { t } = useTranslation(lang);

  const navLinks = [
    { href: "/",          label: t("nav_product") },
    { href: "/#how",      label: t("nav_howitworks") },
    { href: "/login?role=investor", label: t("nav_investors") },
    { href: "/#api",      label: t("nav_partners") },
    { href: "/#docs",     label: t("nav_docs") },
  ];

  return (
    <nav className="appnav">
      <div className="wrap-wide">
        <Logo />
        <div className="appnav-links" style={{ marginLeft: 24 }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`appnav-link ${activePath === link.href ? "active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Link className="appnav-link" href="/login">
          {t("nav_login")}
        </Link>
        <Link className="btn btn-primary btn-sm" href="/login">
          {t("cta_antecipar")} <Icon name="arrow_right" size={14} />
        </Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Criar Sidebar.tsx**

Criar `src/components/patterns/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/primitives/Icon";
import type { IconName } from "@/components/primitives/Icon";

// Re-export IconName so callers can type sidebar items without importing from Icon
export type { IconName };

export interface SidebarNavLink {
  href: string;
  icon: IconName;
  label: string;
  badge?: string;
}

export interface SidebarNavGroup {
  group: string;
}

export type SidebarItem = SidebarNavLink | SidebarNavGroup;

interface SidebarProps {
  items: SidebarItem[];
  footer?: React.ReactNode;
}

function isNavGroup(item: SidebarItem): item is SidebarNavGroup {
  return "group" in item;
}

export function Sidebar({ items, footer }: SidebarProps) {
  const currentPath = usePathname();

  return (
    <aside className="sidebar">
      {items.map((item, index) => {
        if (isNavGroup(item)) {
          return (
            <div key={index} className="sidenav-group">
              {item.group}
            </div>
          );
        }

        const isActive = currentPath === item.href;

        return (
          <Link
            key={index}
            href={item.href}
            className={`sidenav-item ${isActive ? "active" : ""}`}
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
            {item.badge && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  color: "var(--blue)",
                  fontFamily: "var(--sans)",
                  fontWeight: 600,
                }}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
      {footer && <div style={{ marginTop: "auto" }}>{footer}</div>}
    </aside>
  );
}
```

- [ ] **Step 4: Exportar IconName de Icon.tsx**

Verificar que `Icon.tsx` exporta `IconName`. Adicionar `export type` antes do type se necessário:

```tsx
export type IconName = ...
```

- [ ] **Step 5: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 6: Commitar padrões**

```bash
git add src/components/patterns/
git commit -m "feat: port AppTopBar, TopNav, Sidebar patterns from prototype"
```

---

### Task 9: Criar QueryProvider e atualizar root layout

**Files:**
- Create: `src/providers/QueryProvider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Criar QueryProvider**

Criar `src/providers/QueryProvider.tsx`:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Adicionar QueryProvider ao root layout**

Modificar `src/app/layout.tsx` para envolver o `body` com `QueryProvider`:

```tsx
import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CredBridge",
  description: "Plataforma de antecipação de recebíveis com liquidação on-chain via Stellar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Esperado: sem erros.

- [ ] **Step 4: Commitar**

```bash
git add src/providers/ src/app/layout.tsx
git commit -m "feat: add QueryProvider and wire into root layout"
```

---

### Task 10: Criar route groups e páginas placeholder

**Files:**
- Create: `src/app/(marketing)/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/onboarding/page.tsx`
- Create: `src/app/(pme)/layout.tsx`
- Create: `src/app/(pme)/pme/dashboard/page.tsx`
- Create: `src/app/(investor)/layout.tsx`
- Create: `src/app/(investor)/investor/dashboard/page.tsx`
- Create: `src/app/(partner)/layout.tsx`
- Create: `src/app/(partner)/partner/dashboard/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Criar landing page placeholder (marketing)**

Criar `src/app/(marketing)/page.tsx`:

```tsx
import { TopNav } from "@/components/patterns/TopNav";

export default function MarketingLandingPage() {
  return (
    <>
      <TopNav />
      <main className="wrap-wide" style={{ paddingTop: 120 }}>
        <h1>Landing — em construção</h1>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Criar layout de auth**

Criar `src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Criar página de login placeholder**

Criar `src/app/(auth)/login/page.tsx`:

```tsx
export default function LoginPage() {
  return (
    <div className="card" style={{ width: "100%", maxWidth: 440, padding: 40 }}>
      <div style={{ marginBottom: 32 }}>
        <p className="eyebrow">Acesso</p>
        <h2 style={{ marginTop: 8 }}>Entre na CredBridge</h2>
        <p style={{ marginTop: 8, color: "var(--fg-2)" }}>
          Escolha seu perfil para continuar
        </p>
      </div>
      <p style={{ color: "var(--fg-3)" }}>Login form — em construção</p>
    </div>
  );
}
```

- [ ] **Step 4: Criar página de onboarding placeholder**

Criar `src/app/(auth)/onboarding/page.tsx`:

```tsx
export default function OnboardingPage() {
  return (
    <div className="card" style={{ width: "100%", maxWidth: 560, padding: 40 }}>
      <p className="eyebrow">Cadastro</p>
      <h2 style={{ marginTop: 8 }}>Crie sua conta</h2>
      <p style={{ marginTop: 24, color: "var(--fg-3)" }}>Onboarding / KYC — em construção</p>
    </div>
  );
}
```

- [ ] **Step 5: Criar layout PME com AppShell**

Criar `src/app/(pme)/layout.tsx`:

```tsx
import { AppTopBar } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";

const pmeSidebarItems: SidebarItem[] = [
  { href: "/pme/dashboard",    icon: "home",     label: "Dashboard" },
  { href: "/pme/recebiveis",   icon: "box",      label: "Recebíveis" },
  { href: "/pme/documentos",   icon: "doc",      label: "Documentos" },
  { href: "/pme/liquidacao",   icon: "wallet",   label: "Liquidação" },
  { href: "/pme/auditoria",    icon: "shield",   label: "Auditoria" },
  { group: "CONTA" },
  { href: "/pme/configuracoes", icon: "settings", label: "Configurações" },
];

const pmeUser = {
  name: "PME User",
  initials: "PM",
  roleLabel: "PME",
};

export default function PmeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={pmeUser} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar items={pmeSidebarItems} />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 64px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Criar dashboard PME placeholder**

Criar `src/app/(pme)/pme/dashboard/page.tsx`:

```tsx
export default function PmeDashboardPage() {
  return (
    <div>
      <p className="eyebrow">PME</p>
      <h2 style={{ marginTop: 8 }}>Dashboard</h2>
      <p style={{ marginTop: 24, color: "var(--fg-3)" }}>
        KPIs e recebíveis — em construção
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Criar layout Investor**

Criar `src/app/(investor)/layout.tsx`:

```tsx
import { AppTopBar } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";

const investorSidebarItems: SidebarItem[] = [
  { href: "/investor/dashboard",   icon: "chart",    label: "Portfólio" },
  { href: "/investor/recebiveis",  icon: "box",      label: "Recebíveis" },
  { href: "/investor/cotas",       icon: "wallet",   label: "Cotas" },
  { href: "/investor/auditoria",   icon: "shield",   label: "Auditoria" },
  { group: "CONTA" },
  { href: "/investor/configuracoes", icon: "settings", label: "Configurações" },
];

const investorUser = {
  name: "Investor User",
  initials: "IN",
  roleLabel: "Investidor",
};

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={investorUser} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar items={investorSidebarItems} />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 64px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Criar dashboard Investor placeholder**

Criar `src/app/(investor)/investor/dashboard/page.tsx`:

```tsx
export default function InvestorDashboardPage() {
  return (
    <div>
      <p className="eyebrow">INVESTIDOR</p>
      <h2 style={{ marginTop: 8 }}>Portfólio</h2>
      <p style={{ marginTop: 24, color: "var(--fg-3)" }}>
        NAV, cotas e recebíveis — em construção
      </p>
    </div>
  );
}
```

- [ ] **Step 9: Criar layout Partner**

Criar `src/app/(partner)/layout.tsx`:

```tsx
import { AppTopBar } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";

const partnerSidebarItems: SidebarItem[] = [
  { href: "/partner/dashboard",  icon: "home",     label: "Dashboard" },
  { href: "/partner/api-keys",   icon: "key",      label: "Chaves de API" },
  { href: "/partner/webhooks",   icon: "webhook",  label: "Webhooks" },
  { href: "/partner/monitor",    icon: "zap",      label: "Monitor" },
  { href: "/partner/docs",       icon: "doc",      label: "Documentação" },
  { group: "CONTA" },
  { href: "/partner/configuracoes", icon: "settings", label: "Configurações" },
];

const partnerUser = {
  name: "Partner User",
  initials: "PA",
  roleLabel: "Parceiro",
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={partnerUser} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar items={partnerSidebarItems} />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 64px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Criar dashboard Partner placeholder**

Criar `src/app/(partner)/partner/dashboard/page.tsx`:

```tsx
export default function PartnerDashboardPage() {
  return (
    <div>
      <p className="eyebrow">PARCEIRO</p>
      <h2 style={{ marginTop: 8 }}>Dashboard</h2>
      <p style={{ marginTop: 24, color: "var(--fg-3)" }}>
        API keys, webhooks e monitor — em construção
      </p>
    </div>
  );
}
```

- [ ] **Step 11: Redirecionar raiz para /login**

Substituir `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/login");
}
```

- [ ] **Step 12: Verificar build com todas as rotas**

```bash
npm run build
```

Esperado: todas as rotas listadas em `Route (app)` sem erros.

- [ ] **Step 13: Commitar rotas**

```bash
git add src/app/
git commit -m "feat: add route groups for marketing, auth, pme, investor, partner with placeholder pages"
```

---

### Task 11: Criar tipos globais e estrutura de features

**Files:**
- Create: `src/types/index.ts`
- Create: `src/components/pme/.gitkeep`
- Create: `src/components/investor/.gitkeep`
- Create: `src/components/partner/.gitkeep`
- Create: `.env.local.example`

- [ ] **Step 1: Criar tipos globais**

Criar `src/types/index.ts`:

```ts
export type ReceivableStatus = "pending" | "active" | "completed" | "defaulted";

export type DocumentType = "nota_fiscal" | "duplicata" | "contrato" | "outro";

export type PaymentMethod = "pix" | "ted" | "stellar";

export type UserRole = "pme" | "investor" | "partner";

export type Lang = "pt" | "en";

export interface Receivable {
  id: string;
  amount: number;
  dueDate: string;
  debtorName: string;
  debtorDocument: string;
  status: ReceivableStatus;
  createdAt: string;
  onChainTxHash?: string;
}

export interface Document {
  id: string;
  receivableId: string;
  type: DocumentType;
  url: string;
  hash: string;
  createdAt: string;
}

export interface Settlement {
  id: string;
  receivableId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: "pending" | "completed" | "failed";
  onChainTxHash?: string;
  settledAt?: string;
}

export interface AuditEvent {
  id: string;
  entityId: string;
  action: string;
  actor: string;
  metadata: Record<string, unknown>;
  onChainTxHash?: string;
  createdAt: string;
}
```

- [ ] **Step 2: Criar pastas de features com gitkeep**

```bash
touch /home/tiago-linux/projects/CredBridge/src/components/pme/.gitkeep
touch /home/tiago-linux/projects/CredBridge/src/components/investor/.gitkeep
touch /home/tiago-linux/projects/CredBridge/src/components/partner/.gitkeep
touch /home/tiago-linux/projects/CredBridge/src/hooks/.gitkeep
```

- [ ] **Step 3: Criar .env.local.example**

Criar `.env.local.example`:

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001

# Auth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros.

- [ ] **Step 5: Commitar**

```bash
git add src/types/ src/components/pme/ src/components/investor/ src/components/partner/ src/hooks/ .env.local.example
git commit -m "feat: add global types, feature folder skeletons, and env example"
```

---

### Task 12: Criar query hooks e schemas Zod

**Files:**
- Create: `src/lib/api/receivables.ts`
- Create: `src/lib/api/documents.ts`
- Create: `src/lib/api/settlements.ts`
- Create: `src/lib/api/audit.ts`
- Create: `src/lib/validations/receivable.ts`
- Create: `src/lib/validations/document.ts`
- Create: `src/lib/validations/settlement.ts`

- [ ] **Step 1: Criar hooks de recebíveis**

Criar `src/lib/api/receivables.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Receivable } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const receivableQueryKeys = {
  all: ["receivables"] as const,
  detail: (id: string) => ["receivables", id] as const,
};

export function useReceivables() {
  return useQuery<Receivable[]>({
    queryKey: receivableQueryKeys.all,
    queryFn: async () => {
      const response = await fetch(`${API_URL}/v1/receivables`);
      if (!response.ok) throw new Error("Erro ao buscar recebíveis");
      return response.json() as Promise<Receivable[]>;
    },
  });
}

export function useReceivable(id: string) {
  return useQuery<Receivable>({
    queryKey: receivableQueryKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/v1/receivables/${id}`);
      if (!response.ok) throw new Error("Recebível não encontrado");
      return response.json() as Promise<Receivable>;
    },
    enabled: !!id,
  });
}
```

- [ ] **Step 2: Criar hooks de documentos**

Criar `src/lib/api/documents.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import type { Document } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const documentQueryKeys = {
  byReceivable: (receivableId: string) => ["documents", "receivable", receivableId] as const,
};

export function useDocumentsByReceivable(receivableId: string) {
  return useQuery<Document[]>({
    queryKey: documentQueryKeys.byReceivable(receivableId),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/v1/receivables/${receivableId}/documents`);
      if (!response.ok) throw new Error("Erro ao buscar documentos");
      return response.json() as Promise<Document[]>;
    },
    enabled: !!receivableId,
  });
}
```

- [ ] **Step 3: Criar hooks de liquidações**

Criar `src/lib/api/settlements.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import type { Settlement } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const settlementQueryKeys = {
  all: ["settlements"] as const,
  detail: (id: string) => ["settlements", id] as const,
};

export function useSettlements() {
  return useQuery<Settlement[]>({
    queryKey: settlementQueryKeys.all,
    queryFn: async () => {
      const response = await fetch(`${API_URL}/v1/settlements`);
      if (!response.ok) throw new Error("Erro ao buscar liquidações");
      return response.json() as Promise<Settlement[]>;
    },
  });
}
```

- [ ] **Step 4: Criar hooks de auditoria**

Criar `src/lib/api/audit.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import type { AuditEvent } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const auditQueryKeys = {
  byEntity: (entityId: string) => ["audit", entityId] as const,
};

export function useAuditTrail(entityId: string) {
  return useQuery<AuditEvent[]>({
    queryKey: auditQueryKeys.byEntity(entityId),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/v1/audit?entityId=${entityId}`);
      if (!response.ok) throw new Error("Erro ao buscar trilha de auditoria");
      return response.json() as Promise<AuditEvent[]>;
    },
    enabled: !!entityId,
  });
}
```

- [ ] **Step 5: Criar schema Zod de recebível**

Criar `src/lib/validations/receivable.ts`:

```ts
import { z } from "zod";

export const createReceivableSchema = z.object({
  amount: z
    .number({ required_error: "Valor obrigatório" })
    .positive("Valor deve ser maior que zero"),
  dueDate: z
    .string({ required_error: "Data de vencimento obrigatória" })
    .min(1, "Data de vencimento obrigatória"),
  debtorName: z
    .string({ required_error: "Nome do devedor obrigatório" })
    .min(2, "Nome deve ter ao menos 2 caracteres"),
  debtorDocument: z
    .string({ required_error: "CPF/CNPJ obrigatório" })
    .min(11, "CPF/CNPJ inválido")
    .max(14, "CPF/CNPJ inválido"),
  description: z.string().optional(),
});

export type CreateReceivableFormValues = z.infer<typeof createReceivableSchema>;
```

- [ ] **Step 6: Criar schema Zod de documento**

Criar `src/lib/validations/document.ts`:

```ts
import { z } from "zod";

export const uploadDocumentSchema = z.object({
  receivableId: z.string({ required_error: "ID do recebível obrigatório" }).min(1),
  type: z.enum(["nota_fiscal", "duplicata", "contrato", "outro"], {
    errorMap: () => ({ message: "Tipo de documento inválido" }),
  }),
  file: z.instanceof(File, { message: "Arquivo obrigatório" }),
});

export type UploadDocumentFormValues = z.infer<typeof uploadDocumentSchema>;
```

- [ ] **Step 7: Criar schema Zod de liquidação**

Criar `src/lib/validations/settlement.ts`:

```ts
import { z } from "zod";

export const settleReceivableSchema = z.object({
  receivableId: z.string({ required_error: "ID do recebível obrigatório" }).min(1),
  amount: z
    .number({ required_error: "Valor obrigatório" })
    .positive("Valor deve ser maior que zero"),
  paymentMethod: z.enum(["pix", "ted", "stellar"], {
    errorMap: () => ({ message: "Método de pagamento inválido" }),
  }),
});

export type SettleReceivableFormValues = z.infer<typeof settleReceivableSchema>;
```

- [ ] **Step 8: Verificar build final**

```bash
npm run build
```

Esperado: `✓ Compiled successfully`, zero erros de tipo.

- [ ] **Step 9: Commitar**

```bash
git add src/lib/api/ src/lib/validations/
git commit -m "feat: add TanStack Query hooks and Zod validation schemas for all modules"
```

---

## Self-Review

**Cobertura do spec (DESIGN_SYSTEM.md Part B):**
- ✅ Next.js 14 App Router
- ✅ TypeScript strict — sem `any`
- ✅ Tailwind estendido com tokens CSS
- ✅ `styles/tokens.css` portado como fonte da verdade
- ✅ Fontes: Space Grotesk (`--sans`), Inter (`--body`), JetBrains Mono (`--mono`)
- ✅ Tema dark/light via `data-theme` + `useTheme` hook
- ✅ Cinco route groups: `(marketing)`, `(auth)`, `(pme)`, `(investor)`, `(partner)`
- ✅ `components/primitives/`: Icon, Logo, LogoMark, StatusBadge
- ✅ `components/patterns/`: AppTopBar, TopNav, Sidebar
- ✅ `components/pme/`, `components/investor/`, `components/partner/`
- ✅ `lib/format.ts`: fmtBRL, fmtCNPJ, fmtCPF, fmtTxHash
- ✅ `lib/i18n/`: pt.json, en.json, useTranslation
- ✅ Named exports em todos os componentes
- ✅ Sem Lucide — Icon custom
- ✅ TanStack Query hooks por módulo
- ✅ Zod schemas por módulo
- ✅ Global types alinhados com os módulos de negócio

**Preferências de código:**
- ✅ Nomes explícitos (`receivableQueryKeys`, `CreateReceivableFormValues`, `isNavGroup`)
- ✅ Linear — sem helpers desnecessários
- ✅ Sem `any`
- ✅ Named exports apenas

**Placeholders:** Nenhum — todos os steps têm código concreto.

**Consistência de tipos:** `Receivable`, `Document`, `Settlement`, `AuditEvent` definidos em `src/types/index.ts` e referenciados nos hooks e schemas.
