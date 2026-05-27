# Anchor Frontend — On-Ramp / Off-Ramp Design

**Date:** 2026-05-16
**Status:** aprovado

---

## Goal

Adicionar fluxo de on-ramp BRL→TESOURO (investor) e off-ramp TESOURO→BRL (PME) no frontend, expondo os endpoints `/v1/anchor/onramp/start` e `/v1/anchor/offramp/start` via um drawer com iframe Etherfuse.

---

## Architecture

Dois novos arquivos, duas modificações de página.

```
apps/web/src/
├── lib/api/
│   └── anchor.ts                        (novo) — hooks React Query
└── components/anchor/
    └── AnchorDrawer.tsx                 (novo) — drawer compartilhado
apps/web/src/app/
├── (investor)/investor/dashboard/page.tsx  (modif) — botão "Depositar BRL"
└── (pme)/pme/dashboard/page.tsx            (modif) — botão "Sacar BRL"
```

---

## API Layer — `lib/api/anchor.ts`

Dois hooks `useMutation` seguindo o padrão de `investments.ts`.

```typescript
interface StartRampInput { amount: number; quoteId?: string }
interface StartRampResponse { id: string; interactiveUrl?: string; status: string }

useAnchorOnrampStart()  → POST /anchor/onramp/start
useAnchorOfframpStart() → POST /anchor/offramp/start
```

Ambos retornam `StartRampResponse`. O campo relevante é `interactiveUrl`.

---

## Component — `AnchorDrawer`

### Props

```typescript
interface AnchorDrawerProps {
  mode: 'onramp' | 'offramp';
  open: boolean;
  onClose: () => void;
}
```

### Steps internos

| Step | O que renderiza |
|------|-----------------|
| `amount` | Input numérico BRL + botão "Continuar" |
| `loading` | Spinner enquanto chama a API |
| `iframe` | `<iframe src={interactiveUrl}>` + botão "Fechar" |
| `error` | Mensagem de erro inline + botão "Tentar novamente" |

### Behavior

- Abre no step `amount`
- Reset para `amount` ao fechar
- Ao submeter: step `loading` → chama `onrampStart` ou `offrampStart` com `{ amount }`
- Se sucesso com `interactiveUrl`: step `iframe`
- Se sucesso sem `interactiveUrl` (sandbox limitation): exibe mensagem de aviso
- Se erro: step `error`
- iframe: `allow="payment"`, `width="100%"`, `height="520px"`, sem border
- Label do botão principal: `mode === 'onramp' ? 'Depositar BRL' : 'Sacar BRL'`

### Drawer sizing

Seguir o padrão `BuyDrawer` existente — `Drawer` primitivo do projeto.

---

## Page Changes

### Investor Dashboard

Adicionar botão "Depositar BRL" ao lado dos botões existentes ("Relatório", "Investir").

```tsx
<button className="btn btn-primary" onClick={() => setOnrampOpen(true)}>
  <Icon name="arrow-down" size={14} /> Depositar BRL
</button>
<AnchorDrawer mode="onramp" open={onrampOpen} onClose={() => setOnrampOpen(false)} />
```

### PME Dashboard

Adicionar botão "Sacar BRL" no header da página.

```tsx
<button className="btn btn-primary" onClick={() => setOfframpOpen(true)}>
  <Icon name="arrow-up" size={14} /> Sacar BRL
</button>
<AnchorDrawer mode="offramp" open={offrampOpen} onClose={() => setOfframpOpen(false)} />
```

---

## Error Handling

- Erro da API: `extractApiErrorMessage(err)` → exibir inline no step `error`
- `interactiveUrl` ausente (sandbox): mostrar aviso "Fluxo PIX disponível apenas em sandbox — URL não retornada pela Etherfuse"
- Validação de amount: maior que 0, campo obrigatório

---

## Out of Scope

- Polling de status da transação após fechar o iframe
- Notificação de sucesso pós-KYC (requer webhook)
- Exibição de saldo TESOURO (requer endpoint de saldo)
- KYC URL separada (`/anchor/kyc-url`)
