# Design System Inspired by CredBridge

> Category: Fintech & Web3
> Brazilian receivables tokenization. Trustworthy fintech with restrained Web3 mood — dark cockpit by default, polished light theme, blue-violet glow accents.

## 1. Visual Theme & Atmosphere

CredBridge is the bridge between TradFi receivables and on-chain liquidity. The visual tone carries that duality: a **serious financial dashboard** that quietly nods to its blockchain settlement layer. The signature surface is a deep space background (`#0A0A1A`) overlaid with very low-opacity radial glows in violet (`#7B2FFF`) and cyan (`#00D4FF`) — never more than ~12% of the visible pixel area. Tables, lists and forms stay flat. Glows are reserved for hero moments, KPIs and CTAs.

The system ships **two first-class themes**: `dark` (default — on-chain cockpit feel) and `light` (daylight, print-friendly, client-facing). The active theme is set on `<html data-theme="dark">`. Every color is a CSS variable redeclared inside each theme block. Components must never reference a hex directly — always a token.

Numbers are the content. Every screen is ultimately about BRL values, yields, deadlines, hash IDs. Financial figures are large, bold, monospace with `"tnum"`. Labels are small uppercase eyebrows (`letter-spacing: 0.16em`). On-chain artifacts (tx hashes, account IDs, contract versions) appear in `JetBrains Mono` at small size — discreet, never theatrical.

**Mood reference.** Stripe Dashboard or Linear with a subtle violet/cyan aura — never Uniswap or OpenSea.

**Key Characteristics:**
- Two equal-weight themes (`dark` default, `light`) controlled by `data-theme` on `<html>`
- Restrained Web3: violet + cyan glow accents under 12% pixel area; never on tables
- Three sans hierarchy: `Space Grotesk` (display/headings), `Inter` (body), `JetBrains Mono` (numbers + tx hashes)
- `font-feature-settings: "tnum" 1` mandatory on every monetary or hash element
- Negative letter-spacing on display sizes (`-0.035em` at 64px, `-0.025em` at 40px)
- Card chrome with `1px` translucent border (`rgba(255,255,255,0.08)` dark / `rgba(10,10,26,0.08)` light)
- Subtle radial-gradient page glow via `body::before` — fixed, pointer-events none, z-index 0
- Optional toggleable grid overlay (`body[data-grid="on"]::after`) — 48px gridlines for layout sketches
- Density toggle via `data-density="compact"` shrinks card padding/gaps/radii proportionally
- Three-persona system (PME, Investor, Partner) — distinct shells, shared tokens

## 2. Color

### Dark theme (default — `data-theme="dark"`)

#### Surfaces
- **Bg** (`#0A0A1A`): page background — deep space navy
- **Bg-1** (`#0E0E22`): elevated section
- **Bg-2** (`#141430`): top elevation, modals
- **Surface** (`rgba(255,255,255,0.03)`): card background — translucent white over space
- **Surface-2** (`rgba(255,255,255,0.05)`): hovered/active surface
- **Code Bg** (`#06060F`): code blocks, terminal-like blocks
- **AppNav Bg** (`rgba(10,10,26,0.72)`): top nav with backdrop blur

#### Borders
- **Line** (`rgba(255,255,255,0.08)`): default card and divider border
- **Line-2** (`rgba(255,255,255,0.14)`): emphasized border, focused inputs

#### Foreground (text)
- **Fg** (`#F5F6FB`): primary text, headings
- **Fg-1** (`rgba(245,246,251,0.78)`): body text
- **Fg-2** (`rgba(245,246,251,0.55)`): captions, secondary labels
- **Fg-3** (`rgba(245,246,251,0.38)`): eyebrows, muted micro labels

#### Accents
- **Blue** (`#00D4FF`): primary CTA, info highlights, on-chain success — neon cyan
- **Violet** (`#7B2FFF`): secondary brand, tokenization motifs, blockchain glyphs — saturated violet
- **Green** (`#00FF94`): success, settled status, positive yield
- **Amber** (`#FFC857`): warning, pending validation, time-sensitive
- **Red** (`#FF5577`): error, defaulted, critical

#### Soft tints (for badge backgrounds and tinted surfaces)
- **Blue Soft** (`rgba(0,212,255,0.14)`)
- **Violet Soft** (`rgba(123,47,255,0.16)`)
- **Green Soft** (`rgba(0,255,148,0.14)`)
- **Amber Soft** (`rgba(255,200,87,0.16)`)
- **Red Soft** (`rgba(255,85,119,0.16)`)

#### Page glow (decorative, behind content)
- `radial-gradient(1200px 700px at 15% -10%, rgba(123,47,255,0.10), transparent 60%)`
- `radial-gradient(1000px 600px at 95% 10%, rgba(0,212,255,0.07), transparent 55%)`
- `radial-gradient(900px 600px at 50% 120%, rgba(123,47,255,0.05), transparent 60%)`

### Light theme (`data-theme="light"`)

Accent hexes are **retuned** for contrast on white surfaces — never reuse the dark-theme neon values on white.

#### Surfaces
- **Bg** (`#F7F7FB`): page
- **Bg-1** (`#FFFFFF`): card / surface
- **Surface** (`rgba(255,255,255,0.92)`): elevated card
- **Code Bg** (`#0E1524`): code stays dark for contrast

#### Foreground
- **Fg** (`#0A0A1A`)
- **Fg-1** (`rgba(10,10,26,0.80)`)
- **Fg-2** (`rgba(10,10,26,0.58)`)
- **Fg-3** (`rgba(10,10,26,0.42)`)

#### Borders
- **Line** (`rgba(10,10,26,0.08)`)
- **Line-2** (`rgba(10,10,26,0.16)`)

#### Accents (retuned, lower saturation)
- **Blue** (`#0077B6`)
- **Violet** (`#6024E0`)
- **Green** (`#008A4E`)
- **Amber** (`#B57200`)
- **Red** (`#C2334D`)

### Persona accent assignment (fixed)
- **PME**: violet primary (`--violet`) — entrepreneurial, brand identity color
- **Investor**: blue primary (`--blue`) — analytical, market color
- **Partner**: green primary (`--green`) — operational, throughput color

## 3. Typography

### Font stack
- **Display / headings**: `'Space Grotesk', 'Inter', ui-sans-serif, system-ui, sans-serif`
- **Body**: `'Inter', ui-sans-serif, system-ui, sans-serif`
- **Mono / numbers**: `'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace`
- **OpenType features**: `"tnum" 1` required on every money figure, percent, date, tx hash, KPI, table cell holding a number.

### Hierarchy

| Role | Font | Size | Weight | Line height | Letter spacing | Notes |
|---|---|---|---|---|---|---|
| Display Hero (h1) | Space Grotesk | 64px | 600 | 1.02 | -0.035em | Landing hero only |
| Section (h2) | Space Grotesk | 40px | 600 | 1.10 | -0.025em | Dashboard section header |
| Card heading (h3) | Space Grotesk | 22px | 600 | 1.25 | -0.02em | Card title |
| Sub-label (h4) | Space Grotesk | 15px | 600 | 1.30 | normal | Subsection |
| Body | Inter | 14px | 400 | 1.50 | normal | Default reading text |
| Body small | Inter | 13px | 400 | 1.45 | normal | Secondary copy |
| Eyebrow | Space Grotesk | 11px | 500 | 1.20 | 0.16em uppercase | Section eyebrow above heading |
| KPI value | JetBrains Mono | 28-40px | 600 | 1.10 | -0.01em | Big monetary numbers, `"tnum"` |
| KPI label | Space Grotesk | 11px | 500 | 1.20 | 0.16em uppercase | Above the KPI value |
| Table number | JetBrains Mono | 13px | 500 | 1.40 | -0.01em | `"tnum"` in financial tables |
| Tx hash / address | JetBrains Mono | 12px | 400 | 1.30 | normal | Truncated middle (`0xA7F2…91C`) |
| Caption | Inter | 12px | 400 | 1.40 | normal | Helper text, timestamps |

### Number truncation conventions
- Tx hashes: `prefix4…suffix3` style (`0xA7F2…91C`).
- CNPJ: render with mask (`00.000.000/0000-00`).
- BRL: `R$ 176.884,27` — pt-BR locale, `R$` prefix with non-breaking space.
- Percent: `3,05%` with comma decimal.

## 4. Layout (spacing, radii, density)

### Density tokens
- **Base unit**: `--u: 4px` (everything snaps to multiples of 4)
- **Card padding**: `24px` (default) / `16px` (compact)
- **Card gap**: `20px` (default) / `12px` (compact)

### Radius
- **Default**: `14px` (cards, modals)
- **Small**: `8px` (inputs, buttons)
- **Large**: `20px` (hero panels, full-bleed surfaces)

Compact density:
- `--radius: 10px`, `--radius-lg: 14px`

### Density toggle
The whole UI can compact via `<html data-density="compact">`. Components must never hardcode padding — always use `--card-pad`, `--card-gap`, `--radius*`.

## 5. Components

### Card
```css
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: var(--card-pad);
  position: relative;
}
.card.hi { /* highlighted (blue) */
  background: var(--card-hi-grad);
  border-color: var(--blue-soft);
}
.card.violet-hi { /* highlighted (violet) */
  background: var(--card-violet-hi-grad);
  border-color: var(--violet-soft);
}
```

### Status badge
Pill, `border-radius: 999px`, `padding: 4px 10px`, `font-size: 11px`, uppercase, letter-spacing `0.08em`. Background uses `*-soft` token, border uses solid accent at 0.4 alpha, text uses solid accent.

| Status | Token color |
|---|---|
| `pending` | amber |
| `validating` | blue |
| `active` | violet |
| `settled` | green |
| `defaulted` | red |

### Eyebrow
Small uppercase label that sits above headings or KPIs.
```css
.eyebrow {
  font-family: var(--sans);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--fg-3);
  font-weight: 500;
}
```

### Button
- **Primary**: solid `--blue` background, `--btn-primary-fg` text (`#041820` dark / `#FFFFFF` light), `border-radius: var(--radius-sm)`, `padding: 10px 16px`, `font-weight: 600`. No glow.
- **Secondary**: transparent background, `1px solid var(--line-2)`, `--fg` text. Hovers to `--surface-2`.
- **Ghost**: transparent, `--fg-1` text, no border. Hover to `--surface`.
- **Danger**: same shape as primary, background `--red`, text `#FFFFFF`.

### KPI block (MiniKpi)
```
┌─────────────────────────┐
│ EYEBROW (uppercase, fg-3)│
│ 1.247.580,27 ◂━ KPI value (mono, tnum, fg)
│ +R$ 18.420 (verde)       │
└─────────────────────────┘
```
Card with `--card-pad`. Eyebrow on top, monospace value 28-40px center, optional delta row in `--green` or `--red` below.

### Table
- Header row: `--fg-3`, uppercase, `font-size: 11px`, `letter-spacing: 0.16em`, `padding: 12px 16px`, no border bottom.
- Row: `padding: 14px 16px`, `border-top: 1px solid var(--line)`. Hover `background: var(--row-hover)`.
- Money/number cells: `font-family: var(--mono)`, `"tnum"`, right-aligned.
- Status cell: status badge component.
- Tx hash cell: monospace, truncated with `…`.

### Sidebar (app shell)
- Width: 240px. Background `--bg-1`. `border-right: 1px solid var(--line)`.
- Logo top, persona switcher, nav items with icon + label, footer with user.
- Active item: `background: var(--surface-2)`, left accent bar (3px) in persona color (violet/blue/green).

### TopNav
- Height 56px. Background `var(--appnav-bg)` with `backdrop-filter: blur(16px)`.
- Border-bottom `1px solid var(--line)`.

### Timeline (audit feed)
- Vertical list of items with colored dot (violet/blue/green/amber/red), timestamp `--fg-2`, label `--fg`, value monospace `--fg-1`.
- Use `kind` to choose color: `green` (success/settled), `blue` (on-chain), `violet` (smart contract / cessão), `amber` (pending), `red` (failed/defaulted).

## 6. Iconography

- **Library**: outlined, 1.5px stroke, 20px default. Match `lucide-react`-style minimalism.
- **Color**: inherit `currentColor`. Default to `--fg-2`. On hover `--fg`.
- **Brand glyphs**: only the CredBridge logo and Stellar mark may use the violet/cyan gradient. Everything else stays monochrome.
- **No emoji** in product UI. Emoji belongs in marketing copy only, sparingly.

## 7. Glow & Decorative Rules

- **Page glow (`body::before`)**: always present, never animated, never above z-index 0.
- **Hero CTAs**: may use `box-shadow: 0 0 32px var(--blue-soft)` to pull eye. Max one CTA per viewport with this treatment.
- **KPI cards**: never glow. Numbers are the content; glow steals attention.
- **Tables**: never glow, never gradient backgrounds.
- **Tx hashes**: never colored. Always `--fg-2` monospace.

## 8. Layout Patterns (app shell)

- **App shell**: 240px sidebar + flexible main, with 56px topnav. Density compact reduces topnav to 48px.
- **Dashboard grid**: 12-column on desktop, gap `var(--card-gap)`. KPIs span 3 cols each (4 in a row). Charts span 6-8 cols. Tables full-width.
- **Marketing page**: max-width 1200px, centered. Hero full-bleed with subtle network/glow background. Sections separated by 80-120px vertical rhythm.
- **Auth pages**: split layout — 50% form (left, `bg-1`), 50% decorative blockchain network background (right). On mobile, decorative collapses.

## 9. Personas (UI variants)

### PME (small business)
- Sidebar accent: **violet**
- Default route group: `(pme)/pme/dashboard`
- Hero KPIs: total receivables, advance available, average yield
- Primary action: "Enviar nova NF-e"
- Empty states: encouraging copy ("Comece enviando sua primeira NF-e")

### Investor
- Sidebar accent: **blue**
- Default route group: `(investor)/investor/dashboard`
- Hero KPIs: AUM, yield 30d, available proposals
- Primary action: "Analisar nova proposta"
- Empty states: market-oriented copy ("Nenhuma proposta corresponde aos seus filtros")

### Partner
- Sidebar accent: **green**
- Default route group: `(partner)/partner/dashboard`
- Hero KPIs: throughput 24h, partner revenue share, active integrations
- Primary action: "Configurar integração"

## 10. Anti-patterns (DO NOT)

- ❌ Inline hex colors in components — always token.
- ❌ Glow on tables, KPI numbers, modal backdrops.
- ❌ Gradient text on body/labels — gradient is reserved for the wordmark.
- ❌ Drop shadows in dark theme — use border + tinted background instead.
- ❌ Pill-shaped buttons (use `--radius-sm` 8px corners).
- ❌ Sans-serif for monetary numbers — always `--mono` with `"tnum"`.
- ❌ Designing only for dark and patching light afterwards. Both must look first-class.
- ❌ Emoji in product UI.
- ❌ Crypto-jargon visuals (matrix rain, Solana-style neon overload, hexagon meshes).
- ❌ Animated glows or pulsating shadows. Motion is restrained: ease-out 200ms max for hover/focus.

## 11. Brand Voice (PT-BR primary)

- Direto, técnico, sem entusiasmo de crypto. Nunca usa "moonshot", "🚀", "to the moon".
- "Liquidez", "cessão", "antecipação", "trilha auditável" — vocabulário financeiro real.
- Sempre BRL com locale pt-BR (`R$ 1.234,56`).
- "On-chain" e "off-chain" mantêm-se em inglês — termos técnicos consagrados.
- "Stellar", "SEP-10", "tx hash" mantêm-se em inglês com tipografia mono.

## 12. Tokens snapshot (for codegen)

```css
:root, [data-theme="dark"] {
  --bg: #0A0A1A; --bg-1: #0E0E22; --bg-2: #141430;
  --surface: rgba(255,255,255,0.03); --surface-2: rgba(255,255,255,0.05);
  --line: rgba(255,255,255,0.08); --line-2: rgba(255,255,255,0.14);
  --fg: #F5F6FB; --fg-1: rgba(245,246,251,0.78); --fg-2: rgba(245,246,251,0.55); --fg-3: rgba(245,246,251,0.38);
  --blue: #00D4FF; --violet: #7B2FFF; --green: #00FF94; --amber: #FFC857; --red: #FF5577;
  --blue-soft: rgba(0,212,255,0.14); --violet-soft: rgba(123,47,255,0.16);
  --green-soft: rgba(0,255,148,0.14); --amber-soft: rgba(255,200,87,0.16); --red-soft: rgba(255,85,119,0.16);
  --btn-primary-fg: #041820;
}

[data-theme="light"] {
  --bg: #F7F7FB; --bg-1: #FFFFFF; --bg-2: #FFFFFF;
  --surface: rgba(255,255,255,0.92); --surface-2: rgba(10,10,26,0.035);
  --line: rgba(10,10,26,0.08); --line-2: rgba(10,10,26,0.16);
  --fg: #0A0A1A; --fg-1: rgba(10,10,26,0.80); --fg-2: rgba(10,10,26,0.58); --fg-3: rgba(10,10,26,0.42);
  --blue: #0077B6; --violet: #6024E0; --green: #008A4E; --amber: #B57200; --red: #C2334D;
  --btn-primary-fg: #FFFFFF;
}

:root {
  --u: 4px; --card-pad: 24px; --card-gap: 20px;
  --radius: 14px; --radius-sm: 8px; --radius-lg: 20px;
  --sans: 'Space Grotesk', 'Inter', ui-sans-serif, system-ui, sans-serif;
  --body: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace;
}

[data-density="compact"] {
  --card-pad: 16px; --card-gap: 12px; --radius: 10px; --radius-lg: 14px;
}
```

## 13. Reference

Source of truth in the real repository:
- `apps/web/styles/tokens.css` — canonical CSS variables
- `Front - CredBridge/DESIGN_SYSTEM.md` — brand principles, theme rules, do/don't (legacy prototype)
- `apps/web/src/components/primitives/` and `apps/web/src/components/patterns/` — implemented components
