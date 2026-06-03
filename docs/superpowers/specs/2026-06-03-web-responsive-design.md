# Design — App web responsivo (celular, tablet e desktop largo)

- **Data:** 2026-06-03
- **Status:** Aprovado (aguardando revisão final do spec)
- **Abordagem:** A — CSS centralizado em `apps/web/styles/tokens.css`, mobile-first, nomenclatura BEM
- **Skill de execução sugerida:** `superpowers:executing-plans` (após gerar o plano com `superpowers:writing-plans`)

## Objetivo

Hoje o app web (`apps/web`, Next.js 16, React 19, Tailwind v4) é **só desktop**: zero
breakpoints, zero media queries, sidebar fixa de 240px, grids de várias colunas fixas,
tabelas largas e paddings/tipografia fixos. O objetivo é torná-lo utilizável em celular
(`<640px`), tablet (`640–1024px`) e manter/ajustar desktop e telas largas (`>1440px`),
cobrindo **todas** as telas: dashboards (PME, investidor, parceiro, auditoria,
configurações), auth (login/onboarding/role) e marketing/landing.

## Restrições e convenções

- Seguir `documentacao/Preference - Coding Style.md`: código explícito e linear, nomes
  descritivos, **CSS em BEM**, JS hooks com prefixo `js-` em kebab-case, evitar
  dependências novas, evitar `any`.
- Manter a convenção atual de estilo: classes em `tokens.css` + inline styles. **Não**
  migrar para utilitários Tailwind (`sm:`/`md:`/`lg:`) — o código não usa nenhum hoje.
- Inline styles não aceitam media query: layouts que precisam responder a breakpoint
  **devem virar classes CSS nomeadas**.
- Sem redesenho visual. Sem novas dependências. Sem libs de drawer — drawer feito com
  CSS + estado React.

## Breakpoints (definir em `tokens.css`)

Mobile-first. Base = mobile; `@media (min-width: …)` adiciona estilos para telas maiores.

| Faixa    | Largura          |
|----------|------------------|
| phone    | `< 640px` (base) |
| tablet   | `>= 640px`       |
| desktop  | `>= 1024px`      |
| wide     | `>= 1440px` (ajustes opcionais de respiro) |

O recolhimento da sidebar em drawer ocorre **abaixo de 1024px**.

## Componentes e mudanças

### 1. Viewport meta (root layout)
`apps/web/src/app/layout.tsx` não exporta `viewport`. Sem `width=device-width` nada
escala no celular. Adicionar:

```ts
export const viewport = { width: "device-width", initialScale: 1 };
```

### 2. Novo componente `AppShell` (cliente)
O shell `<div flex><Sidebar/><main/></div>` está duplicado inline em
`(pme)/layout.tsx`, `(investor)/layout.tsx`, `(partner)/layout.tsx`. Extrair para
`apps/web/src/components/patterns/AppShell.tsx`.

- **Props:** `items: SidebarItem[]`, `user: AppTopBarUser`, `children`.
- **Estado:** `drawerOpen: boolean` (controla a sidebar em telas `<1024px`).
- **Render:** `AppTopBar` (recebe callback de toggle do hamburguer), `Sidebar`
  (recebe `open` + `onClose`), backdrop/overlay, `<main className="app-main">`.
- **Comportamento:** fecha o drawer ao clicar em link, clicar no backdrop ou apertar
  `Esc`. Trava o scroll do body enquanto o drawer está aberto no mobile.
- Cada `layout.tsx` afetado passa a renderizar só
  `<AppShell items={…} user={…}>{children}</AppShell>`, mantendo a verificação
  `useRequireAuth`/`isReady` existente.

### 3. Sidebar → drawer (`tokens.css` + `Sidebar.tsx`)
- `.sidebar`: base (`<1024px`) = off-canvas fixo, `position: fixed`, full-height,
  `transform: translateX(-100%)`, `transition`, `z-index` acima do conteúdo.
- `.sidebar--open`: `transform: translateX(0)`.
- `.sidebar__overlay`: backdrop semitransparente visível só quando aberto no mobile.
- `@media (min-width: 1024px)`: volta ao comportamento atual — coluna estática 240px,
  sem transform, sem overlay, sempre visível.
- `Sidebar.tsx` recebe `open`/`onClose`; aplica classe `--open`; chama `onClose` no
  clique de cada `Link`.

### 4. Topbar responsivo (`tokens.css` + `AppTopBar.tsx`)
- Adicionar botão hamburguer `js-sidebar-toggle`, visível só `<1024px`, que chama o
  toggle do `AppShell`.
- `<640px`: esconder o chip Stellar e o nome textual do usuário (manter logo,
  hamburguer, avatar, busca, sino). Reduzir gaps.
- Substituir os inline styles estruturais do topbar por classes BEM
  (`.appnav__…`) onde for necessário responder a breakpoint.

### 5. Grids inline → classes BEM com media queries
Converter os `gridTemplateColumns` inline para classes nomeadas em `tokens.css`.
Mapa de padrões → classes:

- **KPI 4 colunas** (`1.4fr 1fr 1fr 1fr` / `repeat(4,1fr)`): `.grid-kpi` →
  phone 1col, tablet 2col, desktop 4col.
  Arquivos: `(pme)/pme/dashboard`, `(investor)/investor/dashboard`,
  `(partner)/partner/dashboard`, `components/marketing/StatsBar`,
  `components/marketing/LandingFooter`.
- **Split principal + lateral** (`1.4fr 1fr`, `1.6fr 1fr`): `.grid-split` →
  phone empilha (1col), desktop 2col.
  Arquivos: `(partner)/partner/dashboard` (linhas 83, 142),
  `(investor)/investor/dashboard` (114), `(pme)/pme/dashboard` (209).
- **Split de auth** (`1.1fr 1fr`): `.grid-auth-split` → phone empilha (e some/encurta
  o painel decorativo), desktop 2col.
  Arquivos: `(auth)/login`, `(auth)/onboarding/role`.
- **Pares de campos** (`1fr 1fr`): `.grid-2` → phone 1col, tablet+ 2col.
  Arquivos: `components/settings/AccountSettings` (71), `components/auth/KycFlow` (166),
  `components/pme/UploadZone` (193).
- **Trios marketing** (`1fr 1fr 1fr`, `repeat(2,1fr)`): `.grid-3` / `.grid-2` →
  phone 1col, tablet 2col, desktop 3col.
  Arquivos: `components/marketing/HowItWorks` (275),
  `components/marketing/Audiences` (48).
- **Auditoria** (`AuditContractsPage` 358 já usa `auto-fit minmax` — ok; linha 470
  grid de tabela `minmax(0,1.4fr) repeat(3,…)`): envolver em `.tbl-scroll`
  (ver item 6) ou empilhar; tratar como tabela.
- `AccountSettings` 237 (`150px minmax(0,1fr) auto`): `.grid-form-row` →
  phone empilha, desktop linha.

Cada classe vive em `tokens.css`; o `gridTemplateColumns` inline é removido do `.tsx`
e trocado por `className`.

### 6. Tabelas (`tokens.css`)
- Nova classe `.tbl-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }`.
- Envolver cada `.tbl` (ex.: `components/pme/InvoiceTable`, tabelas de auditoria) num
  `<div className="tbl-scroll">`, com `min-width` na `.tbl` para preservar as colunas
  no mobile via scroll horizontal.
- Card-stacking de linhas fica **fora de escopo**.

### 7. Padding, containers e tipografia (`tokens.css`)
- Nova classe `.app-main`: phone `padding: 20px 16px 48px`; `>=1024px`
  `padding: 32px 40px 64px` (valor atual). Substitui o inline do `<main>`.
- `.wrap` / `.wrap-wide`: `padding: 0 16px` no phone, `0 32px` a partir de tablet.
- Tipografia via media query (base mobile menor, `min-width` sobe):
  `h1` 36→64, `h2` 28→40, `.kpi` 28→34, `.kpi-lg` 36→56.

### 8. Marketing / landing + auth
- `TopNav` (marketing): links viram menu hamburguer no phone (mesmo padrão de toggle).
- Hero/seções da landing: aplicar `.grid-*` do item 5 para empilhar no mobile;
  reduzir paddings via `.wrap`.
- Auth (`login`, `onboarding`, `onboarding/role`): aplicar `.grid-auth-split`.

## Estratégia de verificação

- Conferir manualmente nos breakpoints 375px (phone), 768px (tablet), 1280px e 1600px
  (desktop/wide) — via DevTools/responsive ou Playwright `browser_resize`.
- Checar: sidebar abre/fecha como drawer `<1024px` e fica estática `>=1024px`; nenhum
  overflow horizontal no `body`; KPIs/splits empilham; tabelas rolam dentro do
  container sem estourar a página; topbar não quebra; auth e landing empilham.
- Sem regressão visual no desktop (layout atual preservado `>=1024px`).

## Fora de escopo

- Card-stacking de linhas de tabela.
- Redesenho visual ou novos fluxos.
- Migração para utilitários Tailwind.
- Novas dependências.
- Componentes novos além de `AppShell` + drawer.

## Arquivos provavelmente afetados

- `apps/web/styles/tokens.css` (breakpoints, drawer, grids, `.app-main`, tabelas, type)
- `apps/web/src/app/layout.tsx` (viewport)
- `apps/web/src/components/patterns/AppShell.tsx` (novo)
- `apps/web/src/components/patterns/Sidebar.tsx`, `AppTopBar.tsx`
- `apps/web/src/app/(pme|investor|partner)/layout.tsx`
- Páginas/componentes com grids inline listados no item 5
- `apps/web/src/components/marketing/TopNav.tsx` + seções da landing
- Tabelas: `components/pme/InvoiceTable.tsx`, `components/audit/AuditContractsPage.tsx`
