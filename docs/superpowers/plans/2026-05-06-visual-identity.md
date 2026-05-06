# CredBridge Visual Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate `docs/brand/` assets — logo SVGs (dark/light/icon-only), README banner SVG (1200×400), LinkedIn card HTML (1200×627), and wire the banner into README.md.

**Architecture:** Static SVG/HTML files. SVGs use nested `<svg>` for icon embedding (preserves viewBox scaling without manual coordinate transforms), inline hex values (not CSS vars — brand assets are static), and system font fallback `'Space Grotesk','Inter',system-ui,sans-serif` so GitHub renders them without external requests. LinkedIn card uses Google Fonts CDN since it's opened in a browser for screenshotting.

**Tech Stack:** SVG 1.1, HTML5, Google Fonts (LinkedIn card only)

---

### Task 1: Logo dark variant

**Files:**
- Create: `docs/brand/logo-dark.svg`

- [ ] **Step 1: Create brand directory**

```bash
mkdir -p /home/tiago-linux/projects/CredBridge/docs/brand
```

- [ ] **Step 2: Write logo-dark.svg**

Write to `docs/brand/logo-dark.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 276 56" width="276" height="56" fill="none">
  <defs>
    <linearGradient id="ig" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#00D4FF"/>
      <stop offset="1" stop-color="#7B2FFF"/>
    </linearGradient>
    <filter id="dg" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5"/>
    </filter>
  </defs>

  <!-- Icon 48×48 via nested SVG — handles viewBox scaling automatically -->
  <svg x="0" y="4" width="48" height="48" viewBox="0 0 28 28" fill="none">
    <rect x="0.5" y="0.5" width="27" height="27" rx="7" stroke="url(#ig)" stroke-width="1" fill="#0A0A1A"/>
    <path d="M7 10.5 L14 6 L21 10.5 L14 15 Z" stroke="url(#ig)" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
    <path d="M7 17.5 L14 22 L21 17.5" stroke="url(#ig)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="14" cy="10.5" r="1.3" fill="#00D4FF"/>
  </svg>

  <!-- Wordmark: "Cred" violet, "Bridge" white. Baseline y=40 (centered in 56px). -->
  <!-- x=60: after icon(48) + gap(12). "Bridge" x=167: approximate "Cred" width at 40px. -->
  <text x="60" y="40"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-weight="700" font-size="40" letter-spacing="-1.5"
        fill="#7B2FFF">Cred</text>
  <text x="167" y="40"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-weight="700" font-size="40" letter-spacing="-1.5"
        fill="#F5F6FB">Bridge</text>

  <!-- Dot: glow layer + solid -->
  <circle cx="268" cy="25" r="5" fill="#00FF94" filter="url(#dg)"/>
  <circle cx="268" cy="25" r="5" fill="#00FF94"/>
</svg>
```

- [ ] **Step 3: Open in browser and verify**

```bash
xdg-open /home/tiago-linux/projects/CredBridge/docs/brand/logo-dark.svg
```

Check: icon left, "Cred" violet (#7B2FFF), "Bridge" white (#F5F6FB), dot green right. If "Bridge" overlaps "Cred" or has a visible gap, adjust its `x` value in 5px increments until they join cleanly.

- [ ] **Step 4: Commit**

```bash
cd /home/tiago-linux/projects/CredBridge
git add docs/brand/logo-dark.svg
git commit -m "brand: add logo-dark SVG"
```

---

### Task 2: Logo light variant

**Files:**
- Create: `docs/brand/logo-light.svg`

- [ ] **Step 1: Write logo-light.svg**

Write to `docs/brand/logo-light.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 276 56" width="276" height="56" fill="none">
  <defs>
    <linearGradient id="ig-lt" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0077B6"/>
      <stop offset="1" stop-color="#6024E0"/>
    </linearGradient>
    <filter id="dg-lt" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2"/>
    </filter>
  </defs>

  <!-- Icon — light: white fill, contrast-tuned gradient for AA on white bg -->
  <svg x="0" y="4" width="48" height="48" viewBox="0 0 28 28" fill="none">
    <rect x="0.5" y="0.5" width="27" height="27" rx="7" stroke="url(#ig-lt)" stroke-width="1" fill="#F7F7FB"/>
    <path d="M7 10.5 L14 6 L21 10.5 L14 15 Z" stroke="url(#ig-lt)" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
    <path d="M7 17.5 L14 22 L21 17.5" stroke="url(#ig-lt)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="14" cy="10.5" r="1.3" fill="#0077B6"/>
  </svg>

  <!-- Wordmark — re-tuned for light surfaces -->
  <text x="60" y="40"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-weight="700" font-size="40" letter-spacing="-1.5"
        fill="#6024E0">Cred</text>
  <text x="167" y="40"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-weight="700" font-size="40" letter-spacing="-1.5"
        fill="#0A0A1A">Bridge</text>

  <!-- Dot — muted green for light bg -->
  <circle cx="268" cy="25" r="5" fill="#008A4E" filter="url(#dg-lt)"/>
  <circle cx="268" cy="25" r="5" fill="#008A4E"/>
</svg>
```

- [ ] **Step 2: Open in browser on white background**

```bash
xdg-open /home/tiago-linux/projects/CredBridge/docs/brand/logo-light.svg
```

Check on white background: icon fill is #F7F7FB, "Cred" deep violet (#6024E0), "Bridge" dark (#0A0A1A), dot muted green (#008A4E). Adjust `x` of "Bridge" if needed.

- [ ] **Step 3: Commit**

```bash
cd /home/tiago-linux/projects/CredBridge
git add docs/brand/logo-light.svg
git commit -m "brand: add logo-light SVG"
```

---

### Task 3: Icon-only (favicon reference)

**Files:**
- Create: `docs/brand/logo-icon-only.svg`

- [ ] **Step 1: Write logo-icon-only.svg**

Canonical brand copy of the favicon — identical content to `apps/web/src/app/icon.svg`.

Write to `docs/brand/logo-icon-only.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 28 28" fill="none">
  <defs>
    <linearGradient id="cblg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#00D4FF"/>
      <stop offset="1" stop-color="#7B2FFF"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="27" height="27" rx="7" stroke="url(#cblg)" stroke-width="1" fill="#0A0A1A"/>
  <path d="M7 10.5 L14 6 L21 10.5 L14 15 Z" stroke="url(#cblg)" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
  <path d="M7 17.5 L14 22 L21 17.5" stroke="url(#cblg)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="14" cy="10.5" r="1.3" fill="#00D4FF"/>
</svg>
```

- [ ] **Step 2: Commit**

```bash
cd /home/tiago-linux/projects/CredBridge
git add docs/brand/logo-icon-only.svg
git commit -m "brand: add icon-only SVG for favicon reference"
```

---

### Task 4: README banner SVG (1200×400)

**Files:**
- Create: `docs/brand/readme-banner.svg`

Layout math:
- Canvas center: x=600
- Logo row: icon(56px) + gap(12) + "Cred"(~107px at 48px) + "Bridge"(~133px) + gap(8) + dot(12) ≈ 328px → icon left edge x=436, wordmark x=504, "Bridge" x=611, dot cx=752
- Tagline: `text-anchor="middle"` at x=600, y=212
- Chips: total ~310px → start x=445; "Rápido" cx=493, "Fácil" cx=597, "Auditável" cx=703

- [ ] **Step 1: Write readme-banner.svg**

Write to `docs/brand/readme-banner.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400" fill="none">
  <defs>
    <linearGradient id="ig" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#00D4FF"/>
      <stop offset="1" stop-color="#7B2FFF"/>
    </linearGradient>
    <radialGradient id="gv" cx="50%" cy="0%" r="50%" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#7B2FFF" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#7B2FFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gc" cx="90%" cy="100%" r="40%" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#00D4FF" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#00D4FF" stop-opacity="0"/>
    </radialGradient>
    <filter id="dg" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
    </filter>
  </defs>

  <!-- Background + glows -->
  <rect width="1200" height="400" fill="#0A0A1A"/>
  <rect width="1200" height="400" fill="url(#gv)"/>
  <rect width="1200" height="400" fill="url(#gc)"/>

  <!-- Icon 56×56, left edge x=436, top y=122 -->
  <svg x="436" y="122" width="56" height="56" viewBox="0 0 28 28" fill="none">
    <rect x="0.5" y="0.5" width="27" height="27" rx="7" stroke="url(#ig)" stroke-width="1" fill="#0A0A1A"/>
    <path d="M7 10.5 L14 6 L21 10.5 L14 15 Z" stroke="url(#ig)" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
    <path d="M7 17.5 L14 22 L21 17.5" stroke="url(#ig)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="14" cy="10.5" r="1.3" fill="#00D4FF"/>
  </svg>

  <!-- Wordmark: font-size 48, baseline y=170 -->
  <text x="504" y="170"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-weight="700" font-size="48" letter-spacing="-2"
        fill="#7B2FFF">Cred</text>
  <text x="611" y="170"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-weight="700" font-size="48" letter-spacing="-2"
        fill="#F5F6FB">Bridge</text>

  <!-- Dot: glow + solid, cy=150 (icon vertical center) -->
  <circle cx="752" cy="150" r="6" fill="#00FF94" filter="url(#dg)"/>
  <circle cx="752" cy="150" r="6" fill="#00FF94"/>

  <!-- Tagline -->
  <text x="600" y="212"
        text-anchor="middle"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-size="13" letter-spacing="5"
        fill="#F5F6FB" fill-opacity="0.50">SEUS RECEBÍVEIS, NO TEMPO CERTO</text>

  <!-- Chip: Rápido — width 96, height 28, center cx=493 -->
  <rect x="445" y="236" width="96" height="28" rx="14"
        fill="#00D4FF" fill-opacity="0.08"
        stroke="#00D4FF" stroke-opacity="0.30" stroke-width="1"/>
  <text x="493" y="254" text-anchor="middle"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-weight="600" font-size="11" letter-spacing="0.5"
        fill="#00D4FF">⚡ Rápido</text>

  <!-- Chip: Fácil — width 82, starts x=553 (445+96+12), center cx=594 -->
  <rect x="553" y="236" width="82" height="28" rx="14"
        fill="#7B2FFF" fill-opacity="0.10"
        stroke="#7B2FFF" stroke-opacity="0.35" stroke-width="1"/>
  <text x="594" y="254" text-anchor="middle"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-weight="600" font-size="11" letter-spacing="0.5"
        fill="#7B2FFF">✦ Fácil</text>

  <!-- Chip: Auditável — width 108, starts x=647 (553+82+12), center cx=701 -->
  <rect x="647" y="236" width="108" height="28" rx="14"
        fill="#00FF94" fill-opacity="0.08"
        stroke="#00FF94" stroke-opacity="0.30" stroke-width="1"/>
  <text x="701" y="254" text-anchor="middle"
        font-family="'Space Grotesk','Inter',system-ui,sans-serif"
        font-weight="600" font-size="11" letter-spacing="0.5"
        fill="#00FF94">✔ Auditável</text>
</svg>
```

- [ ] **Step 2: Open in browser and verify**

```bash
xdg-open /home/tiago-linux/projects/CredBridge/docs/brand/readme-banner.svg
```

Check: dark background, violet top glow, cyan bottom-right glow. Icon + "CredBridge" + dot horizontally centered. Tagline below. Three chips centered. If wordmark isn't centered, shift both `<text>` elements and the nested `<svg>` by the same delta.

- [ ] **Step 3: Commit**

```bash
cd /home/tiago-linux/projects/CredBridge
git add docs/brand/readme-banner.svg
git commit -m "brand: add README banner SVG 1200x400"
```

---

### Task 5: LinkedIn card HTML (1200×627)

**Files:**
- Create: `docs/brand/linkedin-card.html`

- [ ] **Step 1: Write linkedin-card.html**

Write to `docs/brand/linkedin-card.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=1200">
  <title>CredBridge — LinkedIn Card</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1200px; height: 627px; overflow: hidden; }
    body {
      background: #0A0A1A;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      font-family: 'Space Grotesk', 'Inter', system-ui, sans-serif;
      position: relative;
    }
    .glow-violet {
      position: absolute;
      width: 700px; height: 450px;
      top: -150px; left: 50%; transform: translateX(-50%);
      background: radial-gradient(ellipse, rgba(123,47,255,0.20) 0%, transparent 65%);
      pointer-events: none;
    }
    .glow-cyan {
      position: absolute;
      width: 450px; height: 350px;
      bottom: -80px; right: 60px;
      background: radial-gradient(ellipse, rgba(0,212,255,0.10) 0%, transparent 65%);
      pointer-events: none;
    }
    .eyebrow {
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(245,246,251,0.38);
      position: relative;
    }
    .logo-row {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      position: relative;
    }
    .wordmark {
      font-weight: 700;
      font-size: 52px;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .wordmark .cred   { color: #7B2FFF; }
    .wordmark .bridge { color: #F5F6FB; }
    .dot {
      width: 11px; height: 11px;
      border-radius: 50%;
      background: #00FF94;
      box-shadow: 0 0 14px #00FF94;
      flex-shrink: 0;
    }
    .tagline {
      font-size: 18px;
      font-weight: 500;
      color: rgba(245,246,251,0.60);
      letter-spacing: -0.01em;
      position: relative;
    }
    .chips {
      display: flex;
      gap: 12px;
      position: relative;
    }
    .chip {
      font-size: 12px;
      font-weight: 600;
      padding: 5px 18px;
      border-radius: 999px;
      border: 1px solid;
      letter-spacing: 0.02em;
    }
    .chip-cyan   { color: #00D4FF; background: rgba(0,212,255,0.08);   border-color: rgba(0,212,255,0.30); }
    .chip-violet { color: #7B2FFF; background: rgba(123,47,255,0.10);  border-color: rgba(123,47,255,0.35); }
    .chip-green  { color: #00FF94; background: rgba(0,255,148,0.08);   border-color: rgba(0,255,148,0.30); }
  </style>
</head>
<body>
  <div class="glow-violet"></div>
  <div class="glow-cyan"></div>

  <span class="eyebrow">Plataforma de Recebíveis</span>

  <div class="logo-row">
    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="ig" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#00D4FF"/>
          <stop offset="1" stop-color="#7B2FFF"/>
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="27" height="27" rx="7" stroke="url(#ig)" stroke-width="1" fill="#0A0A1A"/>
      <path d="M7 10.5 L14 6 L21 10.5 L14 15 Z" stroke="url(#ig)" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
      <path d="M7 17.5 L14 22 L21 17.5" stroke="url(#ig)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="14" cy="10.5" r="1.3" fill="#00D4FF"/>
    </svg>
    <span class="wordmark"><span class="cred">Cred</span><span class="bridge">Bridge</span></span>
    <div class="dot"></div>
  </div>

  <p class="tagline">Seus recebíveis, no tempo certo.</p>

  <div class="chips">
    <span class="chip chip-cyan">⚡ Rápido</span>
    <span class="chip chip-violet">✦ Fácil</span>
    <span class="chip chip-green">✔ Auditável</span>
  </div>
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify**

```bash
xdg-open /home/tiago-linux/projects/CredBridge/docs/brand/linkedin-card.html
```

Verify at 1200×627: dark background, violet top glow, cyan bottom-right glow. "PLATAFORMA DE RECEBÍVEIS" eyebrow, icon + "CredBridge" + dot centered, tagline, three chips.

**To screenshot at 1200×627:** Open DevTools → device toolbar → set custom size 1200×627, zoom 100%, screenshot.

- [ ] **Step 3: Commit**

```bash
cd /home/tiago-linux/projects/CredBridge
git add docs/brand/linkedin-card.html
git commit -m "brand: add LinkedIn card HTML 1200x627"
```

---

### Task 6: Wire banner into README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Prepend banner to README**

Add as the very first line of `README.md`, before the `# CredBridge` heading:

```markdown
![CredBridge](docs/brand/readme-banner.svg)

```

Result: the banner image renders at the top of the GitHub README page, followed by the existing content.

- [ ] **Step 2: Commit**

```bash
cd /home/tiago-linux/projects/CredBridge
git add README.md
git commit -m "docs: wire brand banner into README"
```

---

## Self-Review

**Spec coverage:**
- Logo dark SVG → Task 1 ✓
- Logo light SVG → Task 2 ✓
- Logo icon-only SVG → Task 3 ✓
- README banner 1200×400 SVG → Task 4 ✓
- LinkedIn card 1200×627 HTML → Task 5 ✓
- `docs/brand/` directory structure → Task 1 step 1 ✓
- README.md wiring → Task 6 ✓
- LinkedIn screenshot workflow → Task 5 step 2 ✓

**Placeholder scan:** No TBDs, no incomplete steps. All SVG/HTML content complete. Alignment notes are instructions, not deferrals.

**Type consistency:** Each SVG file uses its own locally-scoped gradient IDs (`ig`, `ig-lt`, `cblg`) — no cross-file conflicts since each SVG is a standalone document. LinkedIn card uses `ig` inside an inline SVG — isolated to its own DOM shadow.
