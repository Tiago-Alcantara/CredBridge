# CredBridge — Visual Identity Design Spec

**Date:** 2026-05-06  
**Scope:** Logo SVG (dark/light) + README banner SVG + LinkedIn card HTML  
**Status:** Approved — ready for implementation

---

## 1. Logo

### Composição
Ícone + wordmark + dot vivo. Três elementos sempre juntos, exceto em contextos de favicon onde só o ícone é usado.

**Ícone:** `apps/web/src/app/icon.svg` (existente — losango + arco, gradiente cyan→violet, fundo dark rounded rect).

**Wordmark:** "CredBridge" em Space Grotesk 700.
- "Cred" → `--violet` (`#7B2FFF` dark / `#6024E0` light)
- "Bridge" → `--fg` (`#F5F6FB` dark / `#0A0A1A` light)

**Dot vivo:** círculo pequeno após o wordmark.
- Dark: `#00FF94`, `box-shadow: 0 0 8–12px #00FF94`
- Light: `#008A4E`, sombra rebaixada

### Tamanhos e escalonamento

| Contexto | Ícone | Fonte | Dot |
|---|---|---|---|
| Navbar | 28×28 | 17px | 6×6px |
| Display / hero | 48×48 | 40px | 9×9px |
| Favicon (solo) | 32×32 | — | — |

### Variante Light
O ícone SVG troca `fill="#0A0A1A"` por `fill="#F7F7FB"` e os stops do gradiente para `#0077B6` → `#6024E0` (contraste AA em fundo branco).

### Arquivos de saída
- `docs/brand/logo-dark.svg` — ícone 48px + wordmark 40px + dot, fundo transparente
- `docs/brand/logo-light.svg` — mesma composição, variante light
- `docs/brand/logo-icon-only.svg` — ícone solo 32×32 (favicon base)

---

## 2. README Banner

### Especificação
- **Dimensões:** 1200×400px
- **Formato de saída:** SVG (commitado em `docs/brand/readme-banner.svg`)
- **Uso no README:** `![CredBridge](docs/brand/readme-banner.svg)`

### Layout — centralizado
```
[glow violet top-center]          [glow cyan bottom-right]

          [ícone 42px] CredBridge ●

     SEUS RECEBÍVEIS, NO TEMPO CERTO
    (uppercase, letter-spacing 0.08em)

    ⚡ Rápido  ✦ Fácil  ✔ Auditável
```

### Tokens usados
| Elemento | Token / Valor |
|---|---|
| Background | `#0A0A1A` |
| Glow violet | `rgba(123,47,255,0.18)` radial |
| Glow cyan | `rgba(0,212,255,0.10)` radial |
| "Cred" | `#7B2FFF` |
| "Bridge" + tagline | `#F5F6FB` / `rgba(245,246,251,0.50)` |
| Chip Rápido | border `rgba(0,212,255,0.30)` · text `#00D4FF` |
| Chip Fácil | border `rgba(123,47,255,0.35)` · text `#7B2FFF` |
| Chip Auditável | border `rgba(0,255,148,0.30)` · text `#00FF94` |

---

## 3. LinkedIn Card

### Especificação
- **Dimensões:** 1200×627px (Open Graph padrão)
- **Formato de saída:** HTML standalone em `docs/brand/linkedin-card.html`
- **Uso:** abrir no browser, fazer screenshot em 1200×627, salvar como PNG

### Layout — centralizado
```
[eyebrow: PLATAFORMA DE RECEBÍVEIS]

[ícone 52px]  CredBridge (48px)  ●

    Seus recebíveis, no tempo certo.
         (18px, weight 500, 65% opacity)

  ⚡ Rápido    ✦ Fácil    ✔ Auditável
```

Glows: violet radial top-center + cyan radial bottom-right (mesmos do banner, maiores).

### Tokens usados
Idênticos ao README banner, exceto tamanhos de fonte e ícone maiores.

---

## 4. Organização de arquivos

```
docs/brand/
├── logo-dark.svg          # ícone + wordmark, dark, fundo transparente
├── logo-light.svg         # ícone + wordmark, light, fundo transparente
├── logo-icon-only.svg     # ícone solo 32×32
├── readme-banner.svg      # 1200×400, dark
└── linkedin-card.html     # 1200×627, standalone, screenshot para PNG
```

---

## 5. Restrições

- Nunca usar hex direto em componentes do app — sempre via `tokens.css`. Os SVGs de brand usam hex explícito pois são arquivos estáticos.
- Light mode do ícone: trocar stop-colors do gradiente, não só o fill, para manter contraste AA.
- Favicon já existe em `apps/web/src/app/icon.svg` — não duplicar, apenas referenciar.
- LinkedIn card: screenshot manual necessário; não há pipeline de imagem automática no MVP.
