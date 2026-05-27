---
title: Fluxo de login atual do usuario
tags:
  - auth
  - login
  - jwt
  - onboarding
  - privy
date: 2026-05-23
status: atual
---

# Fluxo de login atual do usuario

Este documento descreve o fluxo de autenticacao implementado no CredBridge,
considerando frontend Next.js, Privy e backend NestJS.

## Visao geral

O login da CredBridge usa Privy no frontend para autenticar o usuario, manter a
sessao Privy e provisionar uma embedded wallet Stellar vinculada ao usuario.
Depois que a wallet existe, o frontend envia o access token e o identity token
assinados pela Privy para `POST /v1/auth/privy/session`.

O NestJS nao confia em e-mail ou endereco de wallet enviados livremente pelo
navegador: ele valida os tokens Privy, obtem o DID, o e-mail verificado e a
wallet Stellar vinculada, cria ou atualiza o `User` local e emite o JWT interno
usado nas APIs CredBridge.

## Arquivos principais

### Frontend

- `apps/web/src/app/(auth)/login/page.tsx`
  - tela de entrada que apresenta o painel Privy.
- `apps/web/src/components/auth/PrivyLoginPanel.tsx`
  - inicia o login Privy, troca a sessao e direciona por perfil.
- `apps/web/src/providers/PrivyAuthProvider.tsx`
  - configura os metodos `email` e `google` da Privy.
- `apps/web/src/hooks/usePrivySessionBootstrap.ts`
  - provisiona a embedded wallet Stellar, obtem tokens e inicia a sessao API.
- `apps/web/src/lib/api/privy-session.ts`
  - chama `/auth/privy/session` e grava o JWT interno.
- `apps/web/src/lib/api/auth-storage.ts`
  - leitura, gravacao e limpeza do JWT no `localStorage`.
- `apps/web/src/app/(auth)/onboarding/role/page.tsx`
  - escolha de perfil para usuarios que ainda nao possuem `role`.
- `apps/web/src/components/auth/KycFlow.tsx`
  - atualiza o perfil PME sem criar wallet manual.

### Backend

- `apps/api/src/modules/auth/auth.controller.ts`
  - define os endpoints `/v1/auth/*`, incluindo a sessao Privy.
- `apps/api/src/modules/auth/auth.service.ts`
  - vincula/cria usuario local e emite o JWT CredBridge.
- `apps/api/src/modules/auth/privy-auth.service.ts`
  - valida tokens Privy e extrai a identidade autenticada.
- `apps/api/src/modules/auth/jwt.strategy.ts`
  - valida o JWT interno recebido no header `Authorization`.
- `apps/api/src/modules/stellar-wallet/*`
  - expõe a wallet Stellar provisionada pela Privy para telas e fluxos
    financeiros.

## Modelo de sessao

O frontend mantem dois niveis de sessao:

1. A sessao Privy identifica o usuario e a embedded wallet Stellar.
2. O JWT interno CredBridge autoriza chamadas das APIs da aplicacao.

O frontend salva o JWT interno no `localStorage` usando a chave:

```text
credbridge.accessToken
```

A troca de sessao envia os tokens verificados pela Privy:

```http
POST /v1/auth/privy/session
Authorization: Bearer <privy-access-token>
privy-id-token: <privy-identity-token>
```

A resposta inclui o JWT interno e os dados vinculados:

```json
{
  "accessToken": "jwt-interno",
  "needsRoleSelection": true,
  "user": {
    "id": "id-do-usuario",
    "email": "usuario@empresa.com",
    "role": null,
    "privyStellarWalletAddress": "G..."
  }
}
```

## Fluxo Privy

1. O usuario abre `/login` e escolhe entrar com Privy.
2. Privy autentica com os metodos habilitados (`email` ou `google`).
3. O frontend cria uma embedded wallet `stellar` caso o usuario ainda nao tenha
   uma wallet Stellar vinculada na Privy.
4. O frontend renova os dados do usuario e obtem access token e identity token.
5. O frontend chama `POST /v1/auth/privy/session`.
6. A API verifica os dois tokens com `@privy-io/node` e exige o mesmo Privy DID.
7. A API vincula um usuario existente pelo e-mail verificado ou cria um novo
   usuario com `role: null`.
8. A API persiste `privyUserId`, `privyStellarWalletAddress` e
   `privyWalletStatus`.
9. A API retorna o JWT interno CredBridge.
10. Usuarios sem perfil escolhem `pme` ou `investor` em `/onboarding/role`;
    usuarios com perfil seguem para o dashboard correspondente.

## Perfil e KYC

1. Um usuario novo chega em `/onboarding/role` com o JWT interno valido.
2. O usuario escolhe `pme` ou `investor` por `PATCH /v1/auth/me/role`.
3. A API retorna um novo JWT contendo o perfil definido.
4. Um investidor segue para `/investor/dashboard`.
5. Uma PME conclui o `KycFlow`, que chama `PATCH /v1/auth/me` e segue para
   `/pme/dashboard`.
6. O KYC nao cria wallet manual: a wallet Stellar ja vem da Privy e e exigida
   nos fluxos financeiros compativeis.

## Protecao e expiracao

O frontend protege paginas client-side com `useRequireAuth`. Esse hook verifica
o JWT interno e direciona o usuario para `/login` ou para seu dashboard quando
necessario. A protecao efetiva dos dados continua no backend, com
`JwtAuthGuard` nas rotas protegidas.

Nas chamadas autenticadas, `apiFetch` injeta:

```http
Authorization: Bearer <accessToken>
```

Quando a API responde `401`, o token interno e removido e o usuario volta para
o login. Ao escolher outra conta no painel Privy, a sessao Privy e o JWT
interno tambem sao limpos.

## Endpoints de autenticacao

| Metodo | Rota | Protegida | Uso atual |
|--------|------|-----------|-----------|
| `POST` | `/v1/auth/privy/session` | Nao | Troca tokens Privy pelo JWT interno |
| `PATCH` | `/v1/auth/me/role` | Sim | Define o perfil de usuario sem `role` |
| `GET` | `/v1/auth/me` | Sim | Consulta dados do usuario autenticado |
| `PATCH` | `/v1/auth/me` | Sim | Atualiza dados de perfil/KYC |
| `PATCH` | `/v1/auth/me/password` | Sim | Altera senha de contas compativeis |
| `POST` | `/v1/auth/register` | Nao | Endpoint legado de cadastro por senha |
| `POST` | `/v1/auth/login` | Nao | Endpoint legado de login por senha |
| `POST` | `/v1/auth/google` | Nao | Endpoint legado de Google direto |

## Regras importantes

- A sessao Privy exige access token e identity token validos para o mesmo DID.
- A API usa somente e-mail verificado e wallet Stellar obtidos da Privy.
- Um usuario novo criado pelo fluxo Privy nasce com `role: null`.
- A embedded wallet Stellar da Privy e a fonte usada para autorizacao
  financeira por assinatura.
- O JWT interno continua validado no backend com `passport-jwt`.

## Configuracao local

O backend requer:

```env
PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_JWT_VERIFICATION_KEY=
```

O frontend requer:

```env
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_PRIVY_CLIENT_ID=
```
