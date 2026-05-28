---
title: Integração Anchor Stellar — Etherfuse
tags:
  - ADR
  - stellar
  - anchor
  - etherfuse
  - sep
  - blockchain
date: 2026-05-16
status: aceito
---

# ADR: Integração Anchor Stellar — Etherfuse

## Contexto

O CredBridge usa Stellar para tokenizar NF-es (Soroban) e liquidar pagamentos
entre PMEs e investidores. Até agora os pagamentos on-chain usam XLM nativo,
o que cria fricção: usuários precisam comprar XLM antes de operar.

Para remover essa fricção e manter os pagamentos em BRL, precisamos de um
**Stellar Anchor** que faça a ponte fiat ↔ on-chain via PIX.

## Decisão

Usar **Etherfuse** como anchor para on/off-ramp de BRL.

### Por quê Etherfuse?

- Único provider no [regional-starter-pack](https://github.com/ElliotFriend/regional-starter-pack) com suporte explícito a BRL + PIX
- Token TESOURO lastreado 1:1 em BRL (títulos do Tesouro Nacional)
- Suporte aos 3 SEPs necessários: SEP-38, SEP-10, SEP-24
- API bem documentada com sandbox
- Issuer verificado: `GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4`

### Caveat

Suporte PIX/Brasil está em **sandbox apenas**. Não usar em produção até
Etherfuse documentar e estabilizar o endpoint para BRL.

---

## Token TESOURO

```
Asset code:   TESOURO
Issuer:       GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4
Network:      Testnet (dev) / Mainnet (prod)
Rail:         PIX (Brasil)
Paridade:     1 TESOURO = 1 BRL
```

Wallets Stellar precisam estabelecer uma **trustline** para TESOURO antes
de poder receber o token. O fluxo atual prioriza wallets Stellar da Privy
registradas em `privyStellarWalletAddress`; o antigo caminho explícito
`createCustodialWallet` foi removido.

---

## SEPs utilizados

| SEP | Finalidade | Quando usar |
|-----|-----------|-------------|
| SEP-38 | Cotação BRL ↔ TESOURO | Antes de iniciar on-ramp ou off-ramp |
| SEP-10 | Autenticação da wallet Stellar | Ao conectar wallet do usuário ao anchor |
| SEP-24 | Fluxo interativo de depósito/saque | UI de on-ramp (investor) e off-ramp (PME) |

---

## Fluxo: Investor On-Ramp (BRL → TESOURO)

```
1. Investor abre tela de depósito no CredBridge
2. Frontend chama POST /v1/anchor/onramp/quote  (SEP-38)
   └─ Recebe: taxa de câmbio, fee, expiração
3. Investor confirma valor
4. Frontend chama POST /v1/anchor/onramp/start  (SEP-24 deposit)
   └─ Recebe: interactiveUrl (iframe Etherfuse)
5. Investor completa KYC + PIX dentro do iframe Etherfuse
6. Etherfuse credita TESOURO na wallet Stellar do investor
7. Investor usa TESOURO para comprar recebível (chargeInvestor)
```

## Fluxo: PME Off-Ramp (TESOURO → BRL)

```
1. Liquidação acontece: platform envia TESOURO para wallet PME (payPme)
2. PME vê saldo TESOURO no dashboard
3. PME abre tela de saque
4. Frontend chama POST /v1/anchor/offramp/quote  (SEP-38)
5. PME confirma
6. Frontend chama POST /v1/anchor/offramp/start  (SEP-24 withdraw)
   └─ Recebe: interactiveUrl (iframe Etherfuse)
7. PME informa chave PIX dentro do iframe
8. Etherfuse recebe TESOURO, envia BRL via PIX para PME
```

---

## O que muda no código existente (commit 3)

| Componente | Antes | Depois |
|-----------|-------|--------|
| `payPme` — asset | `Asset.native()` (XLM) | `new Asset('TESOURO', ISSUER)` |
| `chargeInvestor` — asset | `Asset.native()` (XLM) | `new Asset('TESOURO', ISSUER)` |
| Wallet Stellar do usuário | wallet custodial criada explicitamente no backend | wallet Stellar Privy registrada na sessão do usuário |
| `BlockchainInterface` | `amountXlm: number` | `amountBrl: number` |
| Soroban `tokenizeNfe` | inalterado | inalterado |
| `AnchorModule` | não existe | novo módulo NestJS |

---

## Estrutura do pacote `@credbridge/anchor-client`

```
packages/anchor-client/
├── src/
│   ├── types.ts              # Anchor interface + tipos compartilhados
│   ├── etherfuse/
│   │   ├── client.ts         # EtherfuseClient implementando Anchor
│   │   ├── types.ts          # Tipos internos da API Etherfuse
│   │   └── index.ts
│   ├── sep/
│   │   ├── sep10.ts          # Web Auth helpers
│   │   ├── sep24.ts          # Interactive deposit/withdraw
│   │   └── sep38.ts          # RFQ quotes
│   └── index.ts              # Barrel export público
```

Fonte: portado de https://github.com/ElliotFriend/regional-starter-pack

---

## Variáveis de ambiente necessárias (commit 3)

```env
ETHERFUSE_API_KEY=          # chave da API Etherfuse (sandbox ou prod)
ETHERFUSE_BASE_URL=         # https://api.etherfuse.com (padrão sandbox)
```

---

## Referências

- [regional-starter-pack](https://github.com/ElliotFriend/regional-starter-pack)
- [Etherfuse API Docs](https://docs.etherfuse.com)
- [SEP-10 spec](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md)
- [SEP-24 spec](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md)
- [SEP-38 spec](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0038.md)
