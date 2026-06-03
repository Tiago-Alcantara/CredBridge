# App Web Responsivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar `apps/web` utilizável em celular, tablet, desktop e telas largas, sem regredir o layout desktop atual.

**Architecture:** Abordagem A — CSS centralizado e mobile-first em `apps/web/styles/tokens.css` (BEM), inline-grids convertidos em classes nomeadas com media queries, sidebar vira drawer `<1024px` via novo componente `AppShell`. Sem novas dependências, sem utilitários Tailwind.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 (presença mínima), CSS custom properties.

**Spec de referência:** `docs/superpowers/specs/2026-06-03-web-responsive-design.md`

**Nota sobre testes:** CSS responsivo não tem teste unitário natural. O gate de cada task é `npm run lint` + `npm run build` (de `apps/web`) e, quando indicado, checagem visual nos breakpoints 375 / 768 / 1280 / 1600 via Playwright (`browser_resize` + `browser_take_screenshot`) ou DevTools. Commits frequentes.

---

## File Structure

- `apps/web/styles/tokens.css` — breakpoints, drawer, classes de grid, `.app-main`, `.tbl-scroll`, tipografia responsiva, paddings de container.
- `apps/web/src/app/layout.tsx` — export `viewport`.
- `apps/web/src/components/patterns/AppShell.tsx` — **novo**; shell + estado do drawer.
- `apps/web/src/components/patterns/Sidebar.tsx` — props `open`/`onClose`.
- `apps/web/src/components/patterns/AppTopBar.tsx` — botão hamburguer + props.
- `apps/web/src/app/(pme|investor|partner)/layout.tsx` — usar `AppShell`.
- Páginas/componentes com grids inline — trocar inline por `className`.
- `apps/web/src/components/marketing/TopNav.tsx` + seções da landing.
- Tabelas: `components/pme/InvoiceTable.tsx`, `components/audit/AuditContractsPage.tsx`.

---

## Task 1: Breakpoints, viewport e tipografia responsiva

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/styles/tokens.css`

- [ ] **Step 1: Adicionar export `viewport` no root layout**

Em `apps/web/src/app/layout.tsx`, logo após o bloco `export const metadata`, adicionar:

```ts
export const viewport = { width: "device-width", initialScale: 1 };
```

- [ ] **Step 2: Documentar breakpoints no topo de `tokens.css`**

Logo após o comentário de cabeçalho (linha ~2), adicionar:

```css
/* Breakpoints (mobile-first):
   phone   < 640px  (base, sem media query)
   tablet  >= 640px
   desktop >= 1024px  (sidebar estática; abaixo disso vira drawer)
   wide    >= 1440px
   ============================================ */
```

- [ ] **Step 3: Tornar a tipografia mobile-first**

Substituir as regras atuais de `h1`/`h2` (linhas ~167-168) e adicionar escalonamento.
Trocar:

```css
h1 { font-size: 64px; line-height: 1.02; letter-spacing: -0.035em; }
h2 { font-size: 40px; line-height: 1.1; letter-spacing: -0.025em; }
```

por (base = mobile, sobe nos breakpoints):

```css
h1 { font-size: 36px; line-height: 1.05; letter-spacing: -0.03em; }
h2 { font-size: 28px; line-height: 1.12; letter-spacing: -0.02em; }
@media (min-width: 640px) {
  h1 { font-size: 48px; }
  h2 { font-size: 34px; }
}
@media (min-width: 1024px) {
  h1 { font-size: 64px; line-height: 1.02; letter-spacing: -0.035em; }
  h2 { font-size: 40px; line-height: 1.1; letter-spacing: -0.025em; }
}
```

Logo após a regra `.kpi` (linha ~377) e `.kpi-lg` (~381), adicionar escalonamento.
Trocar o tamanho base de `.kpi` para `28px` e `.kpi-lg` para `36px`, e adicionar:

```css
@media (min-width: 1024px) {
  .kpi { font-size: 34px; }
  .kpi-lg { font-size: 56px; }
}
```

- [ ] **Step 4: Containers com padding responsivo**

Trocar `.wrap` e `.wrap-wide` (linhas ~355-356):

```css
.wrap { max-width: 1280px; margin: 0 auto; padding: 0 16px; }
.wrap-wide { max-width: 1360px; margin: 0 auto; padding: 0 16px; }
@media (min-width: 640px) {
  .wrap, .wrap-wide { padding: 0 32px; }
}
```

- [ ] **Step 5: Verificar build/lint**

Run (de `apps/web`): `npm run lint && npm run build`
Expected: PASS, sem novos erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/styles/tokens.css
git commit -m "feat(web): viewport meta + breakpoints e tipografia responsiva"
```

---

## Task 2: `.app-main` e classes de grid responsivas

**Files:**
- Modify: `apps/web/styles/tokens.css`

- [ ] **Step 1: Adicionar `.app-main`**

No bloco "Layout utilities" de `tokens.css` (após `.wrap-wide`), adicionar:

```css
.app-main { flex: 1; min-width: 0; padding: 20px 16px 48px; }
@media (min-width: 640px)  { .app-main { padding: 24px 24px 56px; } }
@media (min-width: 1024px) { .app-main { padding: 32px 40px 64px; } }
```

- [ ] **Step 2: Adicionar classes de grid (mobile-first)**

No fim de `tokens.css`, adicionar:

```css
/* ── Grids responsivos ───────────────────── */
.grid-kpi {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 640px)  { .grid-kpi { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .grid-kpi { grid-template-columns: repeat(4, 1fr); } }

.grid-split {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 1024px) { .grid-split { grid-template-columns: 1.4fr 1fr; } }

.grid-auth-split {
  display: grid;
  grid-template-columns: 1fr;
  min-height: 100vh;
}
@media (min-width: 1024px) { .grid-auth-split { grid-template-columns: 1.1fr 1fr; } }

.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
@media (min-width: 640px) { .grid-2 { grid-template-columns: repeat(2, 1fr); } }

.grid-3 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 640px)  { .grid-3 { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .grid-3 { grid-template-columns: repeat(3, 1fr); } }

.grid-form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  align-items: center;
}
@media (min-width: 640px) { .grid-form-row { grid-template-columns: 150px minmax(0, 1fr) auto; } }

/* ── Tabela com scroll horizontal no mobile ─ */
.tbl-scroll { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
```

- [ ] **Step 3: Verificar build/lint**

Run (de `apps/web`): `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/styles/tokens.css
git commit -m "feat(web): classes de layout responsivo (app-main, grids, tbl-scroll)"
```

---

## Task 3: Sidebar como drawer + AppShell

**Files:**
- Modify: `apps/web/styles/tokens.css`
- Modify: `apps/web/src/components/patterns/Sidebar.tsx`
- Modify: `apps/web/src/components/patterns/AppTopBar.tsx`
- Create: `apps/web/src/components/patterns/AppShell.tsx`
- Modify: `apps/web/src/app/(pme)/layout.tsx`, `(investor)/layout.tsx`, `(partner)/layout.tsx`

- [ ] **Step 1: CSS do drawer**

Em `tokens.css`, substituir a regra `.sidebar` (linhas ~471-480) por uma versão
mobile-first off-canvas + restauração desktop, e adicionar overlay:

```css
.sidebar {
  position: fixed;
  top: 64px;
  left: 0;
  z-index: 40;
  width: 240px;
  height: calc(100vh - 64px);
  padding: 24px 16px;
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg);
  transform: translateX(-100%);
  transition: transform .25s ease;
  overflow-y: auto;
}
.sidebar--open { transform: translateX(0); }

.sidebar__overlay {
  position: fixed;
  inset: 64px 0 0 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.5);
  border: 0;
  cursor: pointer;
}

@media (min-width: 1024px) {
  .sidebar {
    position: static;
    top: auto;
    height: auto;
    min-height: calc(100vh - 64px);
    flex-shrink: 0;
    background: transparent;
    transform: none;
    transition: none;
  }
  .sidebar__overlay { display: none; }
}
```

- [ ] **Step 2: Sidebar aceita `open`/`onClose`**

Em `Sidebar.tsx`, estender props e aplicar classe + fechar ao clicar em link:

```tsx
interface SidebarProps {
  items: SidebarItem[];
  footer?: React.ReactNode;
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ items, footer, open = false, onClose }: SidebarProps) {
  const currentPath = usePathname();

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      {/* ...itens iguais aos atuais... */}
      {/* No <Link>, adicionar: onClick={onClose} */}
    </aside>
  );
}
```

Adicionar `onClick={onClose}` ao `<Link>` de cada `sidenav-item` (linha ~49-53).

- [ ] **Step 3: AppTopBar com hamburguer**

Em `AppTopBar.tsx`, adicionar prop `onToggleSidebar?: () => void` e um botão visível só
no mobile, logo após a abertura de `.wrap-wide` e antes do `<Logo />`:

```tsx
interface AppTopBarProps {
  user: AppTopBarUser;
  onToggleSidebar?: () => void;
}
```

```tsx
<button
  className="btn btn-ghost btn-sm js-sidebar-toggle appnav__menu"
  aria-label="Abrir menu"
  onClick={onToggleSidebar}
>
  <Icon name="menu" size={16} />
</button>
```

Em `tokens.css`, controlar visibilidade do botão:

```css
.appnav__menu { display: inline-flex; }
@media (min-width: 1024px) { .appnav__menu { display: none; } }
```

Esconder chip Stellar + nome no phone — envolver o chip Stellar (linhas ~32-36) e o
`<span>` do nome (linha ~69) com classe `appnav__hide-sm` e adicionar:

```css
.appnav__hide-sm { display: none; }
@media (min-width: 640px) { .appnav__hide-sm { display: inline-flex; } }
```

(Para o `<span>` do nome use `display: inline` no breakpoint; ajustar a regra para
`@media (min-width: 640px) { .appnav__hide-sm { display: revert; } }`.)

> Pré-requisito: confirmar que existe o ícone `menu` em `Icon`. Se não existir, usar
> um ícone já presente que represente menu (ex.: `list`) — checar
> `apps/web/src/components/primitives/Icon.tsx` antes de codar este step.

- [ ] **Step 4: Criar `AppShell`**

`apps/web/src/components/patterns/AppShell.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AppTopBar } from "@/components/patterns/AppTopBar";
import { Sidebar } from "@/components/patterns/Sidebar";
import type { SidebarItem } from "@/components/patterns/Sidebar";

interface AppShellUser {
  name: string;
  initials: string;
  roleLabel: string;
  stellarAccountId?: string;
}

interface AppShellProps {
  items: SidebarItem[];
  user: AppShellUser;
  children: React.ReactNode;
}

export function AppShell({ items, user, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppTopBar user={user} onToggleSidebar={() => setDrawerOpen((v) => !v)} />
      <div style={{ display: "flex", flex: 1 }}>
        {drawerOpen && (
          <button
            className="sidebar__overlay"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <Sidebar items={items} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Layouts usam AppShell**

Em `(pme)/layout.tsx`, `(investor)/layout.tsx`, `(partner)/layout.tsx`, manter a lógica
`useRequireAuth`/`isReady` e os arrays de `items`/`user`; trocar o bloco JSX do shell por:

```tsx
import { AppShell } from "@/components/patterns/AppShell";
// ...
return <AppShell items={pmeSidebarItems} user={pmeUser}>{children}</AppShell>;
```

(Ajustar nome da variável de items/user por layout. Remover imports não usados de
`AppTopBar`/`Sidebar`.)

- [ ] **Step 6: Verificar build/lint + visual**

Run (de `apps/web`): `npm run lint && npm run build`
Expected: PASS.
Visual: rodar `npm run dev`, abrir um dashboard, `browser_resize` para 375px →
hamburguer aparece, abre/fecha drawer (link, overlay, Esc); 1280px → sidebar estática,
sem hamburguer, sem overlay.

- [ ] **Step 7: Commit**

```bash
git add apps/web/styles/tokens.css apps/web/src/components/patterns/ apps/web/src/app/\(pme\)/layout.tsx apps/web/src/app/\(investor\)/layout.tsx apps/web/src/app/\(partner\)/layout.tsx
git commit -m "feat(web): sidebar vira drawer no mobile via AppShell"
```

---

## Task 4: Grids dos dashboards

**Files:**
- Modify: `apps/web/src/app/(pme)/pme/dashboard/page.tsx`
- Modify: `apps/web/src/app/(investor)/investor/dashboard/page.tsx`
- Modify: `apps/web/src/app/(partner)/partner/dashboard/page.tsx`

- [ ] **Step 1: PME dashboard**

- Linha 146: o `<div>` com `gridTemplateColumns: "1.4fr 1fr 1fr 1fr"` → remover as props
  inline de grid e usar `className="grid-kpi"` (manter `marginBottom` se houver via
  `style` separado).
- Linha 209: `gridTemplateColumns: "1.6fr 1fr"` → `className="grid-split"`.

- [ ] **Step 2: Investor dashboard**

- Linha 77: `"1.4fr 1fr 1fr 1fr"` → `className="grid-kpi"`.
- Linha 114: `"1.6fr 1fr"` → `className="grid-split"`.

- [ ] **Step 3: Partner dashboard**

- Linha 75: `"repeat(4, 1fr)"` → `className="grid-kpi"`.
- Linha 83: `"1.4fr 1fr"` → `className="grid-split"`.
- Linha 142: `"1.4fr 1fr"` → `className="grid-split"`.

> Em cada troca: se o `style` inline tiver outras props (ex.: `gap`, `marginBottom`),
> manter só as não-grid em `style` e mover `display/gridTemplateColumns/gap` para a
> classe. O `gap` já está nas classes (16px); remover do inline para evitar conflito.

- [ ] **Step 4: Verificar build/lint + visual**

Run: `npm run lint && npm run build` → PASS.
Visual: 375px → KPIs em 1 coluna, splits empilhados; 768px → KPIs 2 colunas;
1280px → 4 colunas + split lado a lado (igual ao atual).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(pme\)/pme/dashboard/page.tsx apps/web/src/app/\(investor\)/investor/dashboard/page.tsx apps/web/src/app/\(partner\)/partner/dashboard/page.tsx
git commit -m "feat(web): grids responsivos nos dashboards"
```

---

## Task 5: Tabelas com scroll horizontal

**Files:**
- Modify: `apps/web/src/components/pme/InvoiceTable.tsx`
- Modify: `apps/web/src/components/audit/AuditContractsPage.tsx`

- [ ] **Step 1: Envolver `.tbl` do InvoiceTable**

Localizar o `<table className="tbl">` em `InvoiceTable.tsx` e envolvê-lo:

```tsx
<div className="tbl-scroll">
  <table className="tbl" style={{ minWidth: 720 }}>
    {/* ...conteúdo igual... */}
  </table>
</div>
```

- [ ] **Step 2: Tabela de auditoria**

Em `AuditContractsPage.tsx`, o grid de tabela (linha ~470,
`minmax(0, 1.4fr) repeat(3, minmax(160px, 1fr))`): envolver o container desse grid num
`<div className="tbl-scroll">` e dar `min-width` (ex.: `style={{ minWidth: 760 }}`) ao
elemento do grid para que role no mobile em vez de espremer.

- [ ] **Step 3: Verificar build/lint + visual**

Run: `npm run lint && npm run build` → PASS.
Visual: 375px → tabela rola horizontalmente dentro do card, página não estoura.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/pme/InvoiceTable.tsx apps/web/src/components/audit/AuditContractsPage.tsx
git commit -m "feat(web): tabelas com scroll horizontal no mobile"
```

---

## Task 6: Auth + formulários

**Files:**
- Modify: `apps/web/src/app/(auth)/login/page.tsx`
- Modify: `apps/web/src/app/(auth)/onboarding/role/page.tsx`
- Modify: `apps/web/src/components/settings/AccountSettings.tsx`
- Modify: `apps/web/src/components/auth/KycFlow.tsx`
- Modify: `apps/web/src/components/pme/UploadZone.tsx`

- [ ] **Step 1: Login + role split**

- `login/page.tsx` linha 17 (`"1.1fr 1fr"`) → `className="grid-auth-split"` (remover
  `display:grid`/`gridTemplateColumns` do inline; manter outras props se houver).
- `onboarding/role/page.tsx` linha 74 (`minHeight:100vh; gridTemplateColumns:"1.1fr 1fr"`)
  → `className="grid-auth-split"` (a classe já inclui `min-height: 100vh`).

> Conferir se o painel decorativo (coluna direita) faz sentido empilhado embaixo no
> mobile; se ficar muito alto, envolvê-lo com `className="appnav__hide-sm"`-style
> próprio ou uma classe `.auth-aside` com `display:none` no phone. Decidir ao ver no
> browser; manter simples (empilhar) se aceitável.

- [ ] **Step 2: Formulários 2-col**

- `AccountSettings.tsx` linha 71 (`"1fr 1fr"`) → `className="grid-2"`.
- `AccountSettings.tsx` linha 237 (`"150px minmax(0,1fr) auto"`) → `className="grid-form-row"`.
- `KycFlow.tsx` linha 166 (`"1fr 1fr"`, `gap:12`) → `className="grid-2"`.
- `UploadZone.tsx` linha 193 (`"1fr 1fr"`, `gap:12`) → `className="grid-2"`.

- [ ] **Step 3: Verificar build/lint + visual**

Run: `npm run lint && npm run build` → PASS.
Visual: 375px → login/onboarding empilham; campos de form em 1 coluna; 1024px+ iguais
ao atual.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(auth\)/ apps/web/src/components/settings/AccountSettings.tsx apps/web/src/components/auth/KycFlow.tsx apps/web/src/components/pme/UploadZone.tsx
git commit -m "feat(web): auth e formulários responsivos"
```

---

## Task 7: Marketing / landing

**Files:**
- Modify: `apps/web/src/components/marketing/TopNav.tsx`
- Modify: `apps/web/src/components/marketing/StatsBar.tsx`
- Modify: `apps/web/src/components/marketing/LandingFooter.tsx`
- Modify: `apps/web/src/components/marketing/Audiences.tsx`
- Modify: `apps/web/src/components/marketing/HowItWorks.tsx`
- Modify: `apps/web/styles/tokens.css` (estilos do menu mobile do TopNav)

- [ ] **Step 1: Grids da landing**

- `StatsBar.tsx` linha 27 (`repeat(4,1fr)`) → `className="grid-kpi"`.
- `LandingFooter.tsx` linha 30 (`"1.4fr 1fr 1fr 1fr"`) → `className="grid-kpi"`.
- `Audiences.tsx` linha 48 (`repeat(2,1fr)`) → `className="grid-2"`.
- `HowItWorks.tsx` linha 275 (`"1fr 1fr 1fr"`) → `className="grid-3"`.

(Remover do inline as props de grid movidas para a classe; manter as demais.)

- [ ] **Step 2: TopNav com menu mobile**

Ler `TopNav.tsx` primeiro para ver a estrutura dos links. Tornar o componente client (se
ainda não for), adicionar `useState` de `menuOpen` e um botão hamburguer
`js-nav-toggle` visível só `<768px`. Os links viram um painel dropdown quando aberto.
Em `tokens.css` adicionar:

```css
.topnav__menu-btn { display: inline-flex; }
.topnav__links { display: none; }
@media (min-width: 768px) {
  .topnav__menu-btn { display: none; }
  .topnav__links { display: flex; }
}
.topnav__links--open {
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 64px;
  left: 0;
  right: 0;
  background: var(--appnav-bg);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
  padding: 16px;
  gap: 8px;
}
```

Aplicar `topnav__links` ao container de links e alternar `topnav__links--open` com o
estado. Adicionar o botão com ícone `menu` (mesmo do Step 3 da Task 3).

> Adaptar os nomes/estrutura ao que o `TopNav.tsx` real tiver. Manter explícito e linear.

- [ ] **Step 3: Verificar build/lint + visual**

Run: `npm run lint && npm run build` → PASS.
Visual: landing em 375px → seções empilham, nav vira hamburguer com dropdown; 1280px →
igual ao atual.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/marketing/ apps/web/styles/tokens.css
git commit -m "feat(web): landing e navegação marketing responsivas"
```

---

## Task 8: Verificação final cross-breakpoint

**Files:** nenhuma alteração esperada (só correções pontuais se algo falhar).

- [ ] **Step 1: Varredura visual**

Com `npm run dev` rodando, para cada tela principal (landing, login, onboarding/role,
dashboards PME/investidor/parceiro, auditoria, configurações) verificar em 375 / 768 /
1280 / 1600px:
- sem scroll horizontal no `body`;
- sidebar = drawer `<1024px`, estática `>=1024px`;
- KPIs/splits/forms empilham corretamente;
- tabelas rolam dentro do container;
- topbar e topnav não quebram;
- desktop sem regressão.

- [ ] **Step 2: Corrigir o que falhar** (inline, commit por correção).

- [ ] **Step 3: Lint/build final**

Run: `npm run lint && npm run build` → PASS.

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** viewport (T1), breakpoints/type (T1), app-main/containers
  (T1/T2), grids (T2/T4/T6/T7), drawer+AppShell+topbar (T3), tabelas (T5), auth (T6),
  marketing (T7), verificação (T8). Todos os itens 1–9 do spec mapeados.
- **Placeholders:** nenhum "TBD"; pontos de adaptação (Icon `menu`, estrutura do TopNav,
  painel decorativo do auth) trazem instrução explícita de "ler/conferir antes".
- **Consistência de tipos:** classes (`grid-kpi`, `grid-split`, `grid-auth-split`,
  `grid-2`, `grid-3`, `grid-form-row`, `tbl-scroll`, `app-main`, `sidebar--open`,
  `sidebar__overlay`) definidas na T1/T2/T3 e referenciadas com os mesmos nomes depois.
  Props `open`/`onClose` (Sidebar) e `onToggleSidebar` (AppTopBar) consistentes com
  `AppShell`.
