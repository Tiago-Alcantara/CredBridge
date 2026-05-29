---
title: Fluxo e regras da smart wallet
tags:
  - smart-wallet
  - passkey
  - stellar
  - auth
  - financial-authorization
date: 2026-05-21
status: legado
---

# Fluxo e regras da smart wallet

> Atualizacao 2026-05-25: a implementacao viva nao cria mais smart
> account/passkey manual com `passkey-kit`. A wallet Stellar provisionada pela
> Privy e a fonte unica para wallet do usuario, e autorizacoes financeiras sao
> assinadas com `useSignRawHash` da Privy e verificadas contra
> `privyStellarWalletAddress`. As secoes historicas abaixo descrevem o fluxo
> anterior e devem ser tratadas como referencia legada ate este documento ser
> reescrito.

Este documento explica como a smart wallet do usuario funciona hoje no
CredBridge, quando ela e criada, quais regras existem, quais arquivos controlam
cada parte e onde alterar caso seja necessario mudar o comportamento.

## Compatibilidade com a wallet embedded Privy

A wallet embedded Stellar criada no login Privy e a smart account Soroban
baseada em passkey nao sao tratadas como a mesma credencial nesta fase.

- `privyStellarWalletAddress` identifica a wallet embedded vinculada a sessao
  Privy e comprova provisionamento de wallet durante onboarding.
- `stellarWalletId`, `passkeyId`, `passkeyPublicKey`, `walletType` e
  `walletStatus` continuam identificando a smart account/passkey exigida pela
  autorizacao financeira existente.
- O KYC nao cria mais smart account automaticamente.
- Quando uma operacao financeira ainda exigir WebAuthn, o banner e o fluxo de
  autorizacao explicam que a configuracao e para assinatura avancada da
  operacao, nao para login.

A substituicao das assinaturas WebAuthn por assinaturas Privy Stellar exige uma
decisao separada sobre transacoes Stellar Tier 2, verificacao de assinatura,
replay protection e compatibilidade com os contratos Soroban existentes.

## Resumo rapido

A smart wallet **nao e criada automaticamente em todo login**.

O login Privy cria a sessao web do usuario, usando JWT interno, e provisiona
uma wallet embedded Stellar separada. A smart account/passkey e criada depois,
quando uma operacao financeira precisa dela ou quando a interface oferece a
configuracao.

Hoje existem dois momentos principais em que a smart account pode ser criada:

1. pelo banner de configuracao nos dashboards;
2. automaticamente antes da primeira acao financeira que exige assinatura.

O modelo atual separa duas coisas:

- **login web**: identifica quem esta usando a plataforma;
- **smart wallet/passkey**: confirma que o usuario autorizou uma acao financeira
  especifica.

Isso quer dizer que o usuario pode estar logado sem ainda ter smart wallet.
Quando ele tentar fazer uma operacao sensivel, a aplicacao exige ou dispara o
setup da smart wallet.

## Arquivos principais

### Frontend

| Arquivo | Responsabilidade |
|---------|------------------|
| `apps/web/src/lib/wallet/passkey-client.ts` | Cria/deploya a smart wallet com `passkey-kit` e assina desafios financeiros com WebAuthn/passkey |
| `apps/web/src/lib/api/wallet.ts` | Hooks `useCreateWallet` e `useGetWallet`, que falam com `/v1/wallet` |
| `apps/web/src/components/auth/KycFlow.tsx` | Salva os dados do KYC sem criar smart account/passkey |
| `apps/web/src/components/auth/WalletSetupBanner.tsx` | Mostra banner para configurar wallet quando o usuario ainda nao tem uma |
| `apps/web/src/lib/financial-actions/useFinancialAuthorization.ts` | Garante que exista smart wallet antes de autorizar acoes financeiras |
| `apps/web/src/components/investor/BuyDrawer.tsx` | Exemplo de compra que exige assinatura da smart wallet |
| `apps/web/src/components/pme/InvoiceTable.tsx` | Exemplo de cessao de recebivel que exige assinatura da smart wallet |

### Backend

| Arquivo | Responsabilidade |
|---------|------------------|
| `apps/api/src/modules/stellar-wallet/stellar-wallet.controller.ts` | Expõe `POST /v1/wallet/create` e `GET /v1/wallet` |
| `apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts` | Salva e consulta os dados da wallet no usuario |
| `apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts` | Valida o payload de criacao da wallet |
| `apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts` | Cria, verifica e consome autorizacoes financeiras assinadas com passkey |
| `apps/api/src/modules/financial-authorizations/financial-authorization.types.ts` | Define quais operacoes financeiras exigem assinatura direta |
| `apps/api/prisma/schema.prisma` | Define os campos da wallet no modelo `User` |

## Campos salvos no banco

Os dados da smart wallet ficam no model `User`, em:

```text
apps/api/prisma/schema.prisma
```

Campos atuais:

```prisma
stellarWalletId  String?
passkeyId        String?
passkeyPublicKey String?
walletType       String?
walletStatus     String?
```

Quando a wallet e criada com sucesso, o backend salva:

```ts
stellarWalletId: dto.contractId
passkeyId: dto.keyId
passkeyPublicKey: dto.publicKey
walletType: "smart_account"
walletStatus: "ready"
```

Na pratica:

- `stellarWalletId` guarda o `contractId` da smart wallet Stellar;
- `passkeyId` guarda o identificador da credencial WebAuthn/passkey;
- `passkeyPublicKey` guarda a chave publica extraida da passkey;
- `walletType` indica o tipo da wallet, hoje `smart_account`;
- `walletStatus` indica se a wallet esta pronta, hoje `ready`.

## Como a smart wallet e criada

O fluxo tecnico de criacao fica no frontend, em:

```text
apps/web/src/lib/wallet/passkey-client.ts
```

A funcao principal e:

```ts
registerAndDeployWallet(userEmail)
```

Ela faz o seguinte:

1. le as variaveis publicas da Stellar;
2. importa o pacote `passkey-kit`;
3. cria uma instancia de `PasskeyKit`;
4. abre o fluxo de passkey no navegador;
5. cria uma transacao assinada para deploy da wallet;
6. extrai a chave publica da passkey;
7. envia a transacao para a Stellar RPC;
8. aguarda confirmacao on-chain;
9. retorna `contractId`, `keyId` e `publicKey`.

As variaveis usadas sao:

```env
NEXT_PUBLIC_STELLAR_RPC_URL=
NEXT_PUBLIC_STELLAR_WALLET_WASM_HASH=
NEXT_PUBLIC_STELLAR_NETWORK=
```

Exemplo do retorno esperado:

```ts
{
  contractId: "C...",
  keyId: "credential-id-base64url",
  publicKey: "p256-public-key-base64url"
}
```

Depois disso, o frontend envia esses dados para a API:

```http
POST /v1/wallet/create
Authorization: Bearer <accessToken>
```

Payload:

```json
{
  "contractId": "C...",
  "keyId": "credential-id-base64url",
  "publicKey": "p256-public-key-base64url"
}
```

## Onde a wallet e criada hoje

### KYC da PME

Arquivo:

```text
apps/web/src/components/auth/KycFlow.tsx
```

Quando o usuario PME termina o KYC, o componente atualiza o perfil e segue para
o dashboard. Ele nao cria smart account/passkey: a wallet embedded Stellar ja
foi provisionada pelo login Privy, e a assinatura financeira permanece um
passo separado.

### 1. Pelo banner no dashboard

Arquivo:

```text
apps/web/src/components/auth/WalletSetupBanner.tsx
```

Esse componente chama:

```ts
useGetWallet()
```

Se a API retornar que o usuario nao tem smart account/passkey, o banner aparece
com a mensagem:

```text
Assinatura avancada para operacoes financeiras ainda nao configurada.
```

Ao clicar em `Configurar assinatura`, ele chama:

```ts
registerAndDeployWallet(me.email)
createWallet.mutateAsync(...)
```

O banner esta nos dashboards:

```text
apps/web/src/app/(pme)/pme/dashboard/page.tsx
apps/web/src/app/(investor)/investor/dashboard/page.tsx
```

Caso queira mudar onde o banner aparece, mexa nesses dashboards ou mova o
componente para um layout compartilhado.

Exemplo:

> "Quero mostrar o banner em todas as telas logadas."

Onde mexer:

- colocar `WalletSetupBanner` nos layouts de area autenticada;
- ou criar um wrapper global para paginas PME/investidor.

### 2. Antes da primeira acao financeira

Arquivo:

```text
apps/web/src/lib/financial-actions/useFinancialAuthorization.ts
```

Esse hook e o guardiao das acoes financeiras no frontend.

Fluxo atual:

1. consulta a wallet com `useGetWallet`;
2. se nao existir wallet ou se `walletType !== "smart_account"`, cria uma;
3. depois cria um desafio de autorizacao financeira;
4. pede assinatura via passkey;
5. envia a assinatura para verificacao no backend;
6. retorna `authorizationId`.

Isso permite um fluxo progressivo:

- usuario entra e navega;
- quando for fazer algo sensivel, a smart wallet passa a ser obrigatoria.

Caso precise mudar a regra de "criar automaticamente antes da primeira acao",
esse e o arquivo principal.

Exemplo:

> "Nao quero criar wallet automaticamente na compra. Quero mostrar uma tela
> explicando antes."

Onde mexer:

- `apps/web/src/lib/financial-actions/useFinancialAuthorization.ts`, removendo
  ou alterando o trecho que chama `registerAndDeployWallet`;
- componentes de UI como `BuyDrawer.tsx` e `InvoiceTable.tsx`, para mostrar o
  estado "configure sua wallet antes de continuar".

## Como a API salva a wallet

Controller:

```text
apps/api/src/modules/stellar-wallet/stellar-wallet.controller.ts
```

Service:

```text
apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts
```

DTO:

```text
apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts
```

A rota de criacao:

```http
POST /v1/wallet/create
```

Ela e protegida por JWT:

```ts
@UseGuards(JwtAuthGuard)
```

Isso significa que somente usuario logado consegue salvar a propria wallet.

Regras atuais no backend:

1. busca o usuario pelo `userId` do JWT;
2. se o usuario nao existir, retorna `User not found`;
3. se o usuario ja tiver `stellarWalletId`, nao sobrescreve;
4. se nao tiver wallet, grava os dados recebidos;
5. marca `walletType` como `smart_account`;
6. marca `walletStatus` como `ready`;
7. registra auditoria `wallet.setup_completed`;
8. retorna `{ contractId }`.

## Validacoes atuais da criacao

Arquivo:

```text
apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts
```

Regras:

```ts
contractId: string obrigatoria e precisa bater com /^C[A-Z0-9]+$/
keyId: string obrigatoria
publicKey: string obrigatoria
```

Caso precise mudar o formato aceito do `contractId`, e nesse arquivo.

Exemplo:

> "Quero aceitar outro tipo de identificador de wallet."

Onde mexer:

```text
apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts
```

Possivel ajuste:

```ts
@Matches(/^C[A-Z0-9]+$/)
```

Essa regex hoje assume contrato Stellar no formato iniciado por `C`.

## Regras para considerar a wallet pronta

O backend considera que uma smart wallet esta pronta para autorizacao financeira
quando o usuario tem todos estes campos:

```ts
stellarWalletId
passkeyId
passkeyPublicKey
walletType === "smart_account"
walletStatus === "ready"
```

Essa regra esta em:

```text
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
```

Trecho conceitual:

```ts
if (
  !user?.stellarWalletId ||
  !user.passkeyId ||
  !user.passkeyPublicKey ||
  user.walletType !== "smart_account" ||
  user.walletStatus !== "ready"
) {
  throw wallet_required;
}
```

Caso precise mudar as regras para uma wallet ser considerada valida, e nesse
arquivo que voce deve mexer.

Exemplos:

> "Quero permitir wallet com `walletStatus === pending`."

Mexer em:

```text
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
```

> "Quero aceitar outro tipo de wallet alem de `smart_account`."

Mexer em:

```text
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
apps/web/src/lib/financial-actions/useFinancialAuthorization.ts
```

O frontend tambem checa `walletType !== "smart_account"` antes de decidir criar
uma nova wallet.

## Quais acoes exigem assinatura da smart wallet

Arquivo:

```text
apps/api/src/modules/financial-authorizations/financial-authorization.types.ts
```

Operacoes conhecidas:

```ts
export type FinancialOperation =
  | "receivable.tokenize"
  | "receivable.assignment"
  | "pme.withdrawal"
  | "investor.deposit"
  | "investment.purchase"
  | "investor.withdrawal";
```

Operacoes que exigem assinatura direta:

```ts
export const DIRECT_AUTH_OPERATIONS = new Set<FinancialOperation>([
  "receivable.assignment",
  "pme.withdrawal",
  "investor.deposit",
  "investment.purchase",
  "investor.withdrawal",
]);
```

Hoje `receivable.tokenize` nao esta na lista de assinatura direta.

Caso precise mudar quais operacoes exigem assinatura, e nesse arquivo.

Exemplo:

> "Quero que tokenizar NF-e tambem exija assinatura da PME."

Onde mexer:

```text
apps/api/src/modules/financial-authorizations/financial-authorization.types.ts
```

Adicionar:

```ts
"receivable.tokenize"
```

Tambem sera necessario ajustar o frontend que chama a tokenizacao, hoje em:

```text
apps/web/src/components/pme/InvoiceTable.tsx
```

Atualmente, quando o recebivel esta `validated`, ele chama direto:

```ts
tokenizeReceivable.mutateAsync(row.id)
```

Para exigir assinatura, esse trecho precisaria chamar `authorize(...)` antes,
como ja acontece na cessao.

## Como funciona a assinatura financeira

O fluxo de assinatura acontece em duas etapas: desafio e verificacao.

### 1. Criacao do desafio

Frontend chama o backend pedindo um desafio para uma operacao:

```http
POST /v1/financial-authorizations/challenge
Authorization: Bearer <accessToken>
```

O backend monta um payload com:

```ts
domain
version
network
operation
userId
walletId
resourceId
amount
destination
nonce
expiresAt
```

Depois gera:

```ts
payloadHash = sha256(JSON.stringify(payload))
```

O desafio expira em 5 minutos:

```ts
const AUTH_TTL_MS = 5 * 60 * 1000;
```

Caso precise mudar o tempo de expiracao da autorizacao, e nesse arquivo:

```text
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
```

Exemplo:

> "Quero que a assinatura expire em 2 minutos."

Alterar:

```ts
const AUTH_TTL_MS = 2 * 60 * 1000;
```

### 2. Assinatura via passkey

Frontend:

```text
apps/web/src/lib/wallet/passkey-client.ts
```

Funcao:

```ts
signFinancialAuthorization(payloadHash, keyId)
```

Ela chama:

```ts
startAuthentication(...)
```

O `payloadHash` vira o challenge da passkey. Se houver `keyId`, o navegador e
orientado a usar aquela credencial especifica.

### 3. Verificacao no backend

Backend:

```text
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
```

A verificacao usa `@simplewebauthn/server`:

```ts
verifyAuthenticationResponse(...)
```

Regras verificadas:

- a autorizacao existe;
- pertence ao usuario logado;
- ainda nao foi consumida;
- ainda nao expirou;
- o `payloadHash` recebido bate com o salvo;
- a assinatura WebAuthn/passkey e valida para a chave publica salva;
- a origem esperada bate com `WEB_ORIGIN`;
- o RPID esperado bate com `WEBAUTHN_RP_ID`.

Variaveis importantes:

```env
WEB_ORIGIN=
WEBAUTHN_RP_ID=
```

Caso a verificacao de assinatura esteja falhando por ambiente, geralmente os
primeiros lugares para checar sao essas duas variaveis.

## Como a autorizacao e consumida

Depois que a assinatura e verificada, o frontend recebe um `authorizationId`.

Esse `authorizationId` e enviado para a operacao de negocio.

Exemplo: compra de recebivel.

Frontend:

```text
apps/web/src/components/investor/BuyDrawer.tsx
```

Fluxo:

```ts
const authorizationId = await authorize({
  operation: "investment.purchase",
  resourceId: receivable.id,
  amount: amountPaid.toFixed(2),
});

await buyMutation.mutateAsync({
  receivableId: receivable.id,
  authorizationId,
});
```

Backend:

```text
apps/api/src/modules/investments/investments.service.ts
```

O service consome a autorizacao antes de executar a liquidacao:

```ts
await this.financialAuthorizations.consume({
  authorizationId: dto.authorizationId,
  userId: investorUserId,
  operation: "investment.purchase",
  resourceId: investment.receivableId,
  amount: investment.amountPaid.toFixed(2),
  destination: null,
});
```

Consumir significa marcar `consumedAt`. A mesma autorizacao nao pode ser usada
duas vezes.

## Exemplo: cessao de recebivel pela PME

Frontend:

```text
apps/web/src/components/pme/InvoiceTable.tsx
```

Quando o recebivel esta `tokenized` ou `assignment_pending`, o frontend chama:

```ts
const authorizationId = await authorize({
  operation: "receivable.assignment",
  resourceId: row.id,
  amount: row.valor.toFixed(2),
  destination: "credbridge-pool",
});
```

Depois chama:

```ts
assignReceivable.mutateAsync({ id: row.id, authorizationId });
```

Backend:

```text
apps/api/src/modules/receivables/receivables.service.ts
```

O backend consome a autorizacao exigindo que os dados batam:

```ts
operation: "receivable.assignment"
resourceId: receivable.id
amount: receivable.value.toFixed(2)
destination: "credbridge-pool"
```

Se qualquer campo nao bater, a autorizacao e rejeitada.

## Regras anti-replay e anti-uso indevido

As autorizacoes financeiras tem algumas protecoes:

- cada desafio tem `nonce`;
- cada desafio tem `expiresAt`;
- o hash inclui operacao, usuario, wallet, valor, destino e recurso;
- a autorizacao precisa pertencer ao usuario logado;
- a autorizacao precisa estar verificada antes de ser consumida;
- a autorizacao so pode ser consumida uma vez;
- a operacao consumida precisa ser igual a operacao assinada;
- o recurso consumido precisa ser igual ao recurso assinado;
- o valor consumido precisa ser igual ao valor assinado;
- o destino consumido precisa ser igual ao destino assinado.

Essas regras ficam em:

```text
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
```

Caso precise mudar regras de replay, consumo unico, expiracao ou comparacao de
campos, esse e o arquivo principal.

## Diferenca entre smart wallet e custodial wallet

Existe outro codigo relacionado a wallet Stellar em:

```text
apps/api/src/shared/blockchain/stellar.service.ts
```

Esse service tem funcoes como:

```ts
createCustodialWallet(...)
ensureCustodialWalletForUser(...)
```

Esse caminho e diferente da smart wallet com passkey.

### Smart wallet com passkey

- criada no frontend com `passkey-kit`;
- depende da passkey do usuario;
- salva `walletType: "smart_account"`;
- usada para autorizacoes financeiras;
- principal arquivo frontend: `apps/web/src/lib/wallet/passkey-client.ts`;
- principal modulo backend: `apps/api/src/modules/stellar-wallet`.

### Custodial wallet

- derivada/criada pelo backend;
- usa segredo/plataforma;
- relacionada a pagamentos e operacoes Stellar no `StellarService`;
- pode criar conta Stellar, patrocinar reserva e estabelecer trustline TESOURO.

Importante: se voce for mexer no fluxo de assinatura do usuario, normalmente o
lugar certo nao e `stellar.service.ts`, e sim:

```text
apps/web/src/lib/wallet/passkey-client.ts
apps/web/src/lib/financial-actions/useFinancialAuthorization.ts
apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
```

## Guia "onde mexer se..."

### Quero mudar quando a smart account/passkey e criada

Mexer principalmente em:

```text
apps/web/src/components/auth/WalletSetupBanner.tsx
apps/web/src/lib/financial-actions/useFinancialAuthorization.ts
```

### Quero obrigar configuracao de assinatura logo apos cadastro

Mexer em:

```text
apps/web/src/app/(auth)/onboarding/role/page.tsx
apps/web/src/components/auth/WalletSetupBanner.tsx
```

E avaliar uma protecao adicional nos dashboards. Essa seria uma decisao de
autorizacao financeira; nao deve reutilizar a wallet embedded Privy como smart
account sem a migracao de assinatura correspondente.

### Quero obrigar wallet para entrar no dashboard

Mexer em:

```text
apps/web/src/app/(pme)/pme/dashboard/page.tsx
apps/web/src/app/(investor)/investor/dashboard/page.tsx
apps/web/src/components/auth/WalletSetupBanner.tsx
```

Possivelmente criar um hook novo, por exemplo `useRequireWallet`, usando:

```text
apps/web/src/lib/api/wallet.ts
```

### Quero mudar quais acoes precisam de assinatura

Mexer em:

```text
apps/api/src/modules/financial-authorizations/financial-authorization.types.ts
```

E tambem nos componentes frontend que disparam essas acoes.

Exemplos:

- compra: `apps/web/src/components/investor/BuyDrawer.tsx`;
- cessao PME: `apps/web/src/components/pme/InvoiceTable.tsx`;
- depositos/saques: procurar chamadas de `useFinancialAuthorization`.

### Quero mudar os campos assinados

Mexer em:

```text
apps/api/src/modules/financial-authorizations/financial-authorization.types.ts
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
apps/web/src/lib/api/financial-authorizations.ts
```

Exemplo:

> "Quero incluir `debtorDocument` no payload assinado."

Voce precisaria:

1. adicionar o campo no tipo do payload;
2. incluir o campo na criacao do desafio;
3. enviar o campo pelo frontend;
4. validar esse campo no consumo.

### Quero mudar o tempo de expiracao da assinatura

Mexer em:

```text
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
```

Constante:

```ts
const AUTH_TTL_MS = 5 * 60 * 1000;
```

### Quero mudar a validacao da passkey

Mexer em:

```text
apps/api/src/modules/financial-authorizations/financial-authorizations.service.ts
```

Funcao:

```ts
verifyAssertionForStoredPasskey(...)
```

Tambem conferir envs:

```env
WEB_ORIGIN=
WEBAUTHN_RP_ID=
```

### Quero mudar o deploy/criacao da wallet

Mexer em:

```text
apps/web/src/lib/wallet/passkey-client.ts
```

Ali ficam:

- `PasskeyKit`;
- `createWallet`;
- envio da transacao para Stellar RPC;
- polling da confirmacao;
- extracao da public key da passkey.

### Quero mudar os dados salvos no usuario

Mexer em:

```text
apps/api/prisma/schema.prisma
apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts
apps/api/src/modules/stellar-wallet/dto/create-wallet.dto.ts
apps/web/src/lib/api/wallet.ts
```

Se adicionar campo novo, tambem criar migration Prisma.

### Quero impedir sobrescrever wallet existente

Isso ja acontece em:

```text
apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts
```

Regra atual:

```ts
if (user.stellarWalletId) {
  return { contractId: user.stellarWalletId };
}
```

### Quero permitir trocar wallet

Mexer em:

```text
apps/api/src/modules/stellar-wallet/stellar-wallet.service.ts
```

Mas isso exige cuidado: trocar wallet muda a chave de autorizacao financeira do
usuario. Idealmente precisaria de:

- confirmacao com passkey antiga;
- auditoria;
- invalidacao de autorizacoes pendentes;
- possivel regra de cooldown;
- suporte de UI para troca segura.

## Fluxo completo em alto nivel

```text
Usuario loga
  |
  |-- Privy cria/reutiliza embedded wallet Stellar
  |
  |-- API valida tokens Privy e JWT interno e salvo no localStorage
  |
  |-- Usuario navega
  |
  |-- Se terminar KYC PME:
  |     atualiza apenas o perfil
  |
  |-- Se abrir dashboard sem smart account/passkey:
  |     mostra WalletSetupBanner
  |
  |-- Se fizer acao financeira sem smart account/passkey:
        cria smart account
        cria desafio financeiro
        assina desafio com passkey
        backend verifica assinatura
        backend retorna authorizationId
        operacao de negocio consome authorizationId
        autorizacao e marcada como usada
```

## Pontos de atencao

- Login Privy e smart account/passkey financeira sao fluxos separados.
- A smart account/passkey nao e obrigatoria para navegar no dashboard hoje.
- A smart account/passkey e obrigatoria para operacoes financeiras diretas.
- O backend nao sobrescreve wallet existente.
- A assinatura financeira e especifica por operacao, recurso, valor e destino.
- A autorizacao expira e so pode ser usada uma vez.
- Problemas de passkey em ambiente local geralmente envolvem `WEB_ORIGIN`,
  `WEBAUTHN_RP_ID`, HTTPS/domino ou browser.
- Problemas de deploy da smart wallet geralmente envolvem
  `NEXT_PUBLIC_STELLAR_RPC_URL`, `NEXT_PUBLIC_STELLAR_WALLET_WASM_HASH` ou
  rede Stellar incorreta.
