# CredBridge API

Backend NestJS 11 da CredBridge. A API roda como modular monolith, expõe rotas com prefixo global `/v1`, usa Prisma 7/PostgreSQL e concentra auth, recebíveis, documentos, investimentos, auditoria, wallet, autorização financeira e integração Anchor/Etherfuse.

## Como rodar

Na raiz do monorepo:

```bash
npm install
cp .env.example apps/api/.env
docker compose up -d
npm exec -w apps/api -- prisma migrate deploy --schema prisma/schema.prisma
npm run dev:api
```

Health check:

```bash
curl http://localhost:3001/v1/health/ping
```

## Scripts

```bash
npm run dev -w apps/api          # nest start --watch
npm run build -w apps/api        # prisma generate && nest build
npm run start -w apps/api        # nest start
npm run start:prod -w apps/api   # node dist/main
npm run lint -w apps/api         # eslint --fix
npm run test -w apps/api         # jest unit
npm run test:e2e -w apps/api     # jest e2e
npm run seed -w apps/api         # prisma/seed.ts
```

## Módulos

| Módulo | Responsabilidade |
|---|---|
| `auth` | Privy session, JWT interno, login/senha legado, Google legado, SEP-10 legado, perfil do usuário |
| `receivables` | criação, listagem, pool, tokenização e cessão de recebíveis |
| `documents` | documentos ligados a recebíveis em rota nested |
| `settlements` | liquidações |
| `audit` | trilha de auditoria por usuário ou entidade |
| `investments` | compra de recebíveis e posições do investidor |
| `stellar-wallet` | consulta da wallet Stellar provisionada pela Privy |
| `financial-authorizations` | desafio e verificação de assinatura Privy Stellar para ações sensíveis |
| `anchor` | on/off-ramp Etherfuse/TESOURO |
| `health` | health check |

## Variáveis importantes

```env
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
PORT=3001
WEB_URL=http://localhost:3000

PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_JWT_VERIFICATION_KEY=
GOOGLE_CLIENT_ID=

STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_SECRET_KEY=
STELLAR_CONTRACT_ID=
STELLAR_WALLET_SECRET=

ETHERFUSE_API_KEY=
ETHERFUSE_BASE_URL=https://api.sand.etherfuse.com
```

`WEB_URL` é usado pelo CORS. A wallet Stellar usada pela API vem da sessão Privy validada server-side.

## Rotas

Todas usam prefixo `/v1`.

| Método | Rota |
|---|---|
| `GET` | `/health/ping` |
| `POST` | `/auth/privy/session` |
| `GET` | `/auth/me` |
| `PATCH` | `/auth/me` |
| `PATCH` | `/auth/me/role` |
| `PATCH` | `/auth/me/password` |
| `POST` | `/auth/register` |
| `POST` | `/auth/login` |
| `POST` | `/auth/google` |
| `POST` | `/auth/stellar/challenge` |
| `POST` | `/auth/stellar/verify` |
| `GET` / `POST` | `/receivables` |
| `GET` | `/receivables/pool` |
| `GET` | `/receivables/pool/stats` |
| `GET` | `/receivables/:id` |
| `PATCH` | `/receivables/:id/activate` |
| `PATCH` | `/receivables/:id/tokenize` |
| `PATCH` | `/receivables/:id/request-assignment` |
| `PATCH` | `/receivables/:id/assign` |
| `GET` / `POST` | `/receivables/:receivableId/documents` |
| `GET` / `POST` | `/settlements` |
| `GET` | `/settlements/receivable/:receivableId` |
| `GET` | `/audit` |
| `GET` / `POST` | `/wallet` e `/wallet/create` |
| `POST` | `/financial-authorizations/challenge` |
| `POST` | `/financial-authorizations/verify` |
| `GET` | `/investments/me` |
| `GET` | `/investments/me/stats` |
| `POST` | `/investments` |
| `GET` | `/anchor/onboarding-status` |
| `POST` | `/anchor/onramp/quote` |
| `POST` | `/anchor/onramp/start` |
| `POST` | `/anchor/offramp/quote` |
| `POST` | `/anchor/offramp/start` |
