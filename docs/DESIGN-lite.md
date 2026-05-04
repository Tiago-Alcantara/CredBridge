# Design System — CredBridge (lite)

> Category: Fintech & Web3
> Compact reference for fast iteration. Use full `credbridge` system for final designs.
> Brazilian receivables tokenization. Trustworthy fintech, restrained Web3 mood.

## 1. Theme

Two themes via `<html data-theme="dark|light">`. `dark` is default. Both are first-class — never patch light afterwards.

Mood: Stripe Dashboard / Linear with subtle violet/cyan aura. Never crypto-meme.

## 2. Color

### Dark (default)
- `--bg: #0A0A1A` (page) · `--bg-1: #0E0E22` · `--bg-2: #141430`
- `--surface: rgba(255,255,255,0.03)` (card) · `--surface-2: rgba(255,255,255,0.05)` (hover)
- `--line: rgba(255,255,255,0.08)` (border) · `--line-2: rgba(255,255,255,0.14)` (focus)
- `--fg: #F5F6FB` · `--fg-1: rgba(245,246,251,0.78)` · `--fg-2: rgba(245,246,251,0.55)` · `--fg-3: rgba(245,246,251,0.38)`
- `--blue: #00D4FF` · `--violet: #7B2FFF` · `--green: #00FF94` · `--amber: #FFC857` · `--red: #FF5577`

### Light
- `--bg: #F7F7FB` · `--bg-1: #FFFFFF`
- `--fg: #0A0A1A` · `--fg-1: rgba(10,10,26,0.80)` · `--fg-2: rgba(10,10,26,0.58)` · `--fg-3: rgba(10,10,26,0.42)`
- `--line: rgba(10,10,26,0.08)` · `--line-2: rgba(10,10,26,0.16)`
- `--blue: #0077B6` · `--violet: #6024E0` · `--green: #008A4E` · `--amber: #B57200` · `--red: #C2334D`

### Persona accents (fixed)
- PME → violet · Investor → blue · Partner → green

### Status mapping
- pending=amber · validating=blue · active=violet · settled=green · defaulted=red

## 3. Typography

- **Display/headings**: `Space Grotesk`, weight 600, negative letter-spacing on 32px+
- **Body**: `Inter`, 14px, weight 400, line-height 1.5
- **Numbers/hashes**: `JetBrains Mono` with `font-feature-settings: "tnum" 1` — mandatory on every BRL value, percent, date, tx hash
- **Eyebrow**: 11px Space Grotesk 500, letter-spacing 0.16em, uppercase, color `--fg-3`

Sizes: h1 64px / h2 40px / h3 22px / h4 15px / body 14px / caption 12px.

BRL format: `R$ 1.234,56` (pt-BR locale). Tx hash: `0xA7F2…91C` (truncate middle).

## 4. Layout

- Base unit: `--u: 4px` (snap to 4)
- Card padding: 24px (compact: 16px) · gap: 20px (compact: 12px)
- Radius: default `14px`, small `8px`, large `20px`
- App shell: 240px sidebar + 56px topnav + flexible main
- Dashboard grid: 12 col, KPI=3 cols (4-up row), chart=6-8 cols, table=full
- Marketing: max-width 1200px, hero full-bleed

## 5. Components

### Card
```css
background: var(--surface);
border: 1px solid var(--line);
border-radius: var(--radius);
padding: var(--card-pad);
```
Variants: `.card.hi` (blue-tinted gradient), `.card.violet-hi` (violet-tinted).

### Status badge
Pill (radius 999px), padding 4px 10px, 11px uppercase letter-spacing 0.08em. Bg `*-soft`, text solid accent.

### Button
- Primary: solid `--blue`, text `--btn-primary-fg`, radius 8px, weight 600. No glow.
- Secondary: transparent, `1px solid --line-2`, text `--fg`. Hover → `--surface-2`.
- Ghost: transparent, no border. Hover → `--surface`.
- Danger: solid `--red`, white text.

### KPI
Eyebrow (uppercase, fg-3) + monospace value 28-40px (`tnum`) + optional delta row in green/red.

### Table
- Header: 11px uppercase fg-3, padding 12px 16px, no bottom border.
- Row: padding 14px 16px, border-top `--line`, hover `--row-hover`.
- Number cells: mono, tnum, right-align.
- Tx hash: mono truncated.

### Sidebar
240px, `--bg-1`, right-border `--line`. Active item: `--surface-2` bg + 3px left bar in persona color.

### Timeline
Colored dot (violet/blue/green/amber/red) + timestamp `--fg-2` + label `--fg` + value mono `--fg-1`.

## 6. Anti-patterns

- ❌ Inline hex (always token)
- ❌ Glow on tables, KPI numbers, modals
- ❌ Drop shadows in dark theme — use border + tint
- ❌ Pill buttons (radius-sm 8px only)
- ❌ Sans-serif for money/hash — always mono + tnum
- ❌ Emoji, crypto-jargon visuals (matrix rain, hex meshes)
- ❌ Animated glows — motion ease-out 200ms max

## 7. Voice (PT-BR)

Direto, técnico. Vocabulário: "liquidez", "cessão", "antecipação", "trilha auditável". Inglês mantido em "on-chain", "off-chain", "Stellar", "SEP-10", "tx hash".
