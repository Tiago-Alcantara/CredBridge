# CredBridge

Plataforma de tokenização de recebíveis que conecta PMEs que precisam de crédito com investidores. As empresas submetem seus recebíveis (notas fiscais, duplicatas, contratos), investidores financiam essas operações, e os liquidações acontecem via PIX, TED ou blockchain Stellar. Todo o fluxo é auditado on-chain.

A plataforma possui três perfis de usuário: **PME**, **Investidor** e **Parceiro**.

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript 5 |
| UI | React 19 + Tailwind CSS v4 |
| Formulários | React Hook Form + Zod |
| Data fetching | TanStack Query v5 |
| Blockchain | Stellar (autenticação e liquidação on-chain) |

---

## Estrutura de Pastas

```
src/
├── app/
│   ├── (marketing)/        # landing page pública
│   ├── (auth)/             # login e onboarding
│   ├── (pme)/              # dashboard da PME
│   ├── (investor)/         # dashboard do investidor
│   └── (partner)/          # dashboard do parceiro
├── components/
│   ├── primitives/         # atoms: Icon, Logo, StatusBadge
│   ├── patterns/           # Sidebar, TopNav, AppTopBar
│   ├── pme/                # componentes específicos da PME
│   ├── investor/           # componentes específicos do investidor
│   └── partner/            # componentes específicos do parceiro
├── hooks/                  # useTheme
├── lib/
│   ├── api/                # clientes HTTP (TanStack Query)
│   ├── i18n/               # traduções PT/EN
│   └── validations/        # schemas Zod
├── providers/              # QueryProvider
└── types/                  # tipos globais
styles/
└── tokens.css              # design tokens (fonte da verdade)
```

---

## Pré-requisitos

- [Node.js](https://nodejs.org) v18 ou superior
- npm v9 ou superior (vem junto com o Node)

---

## Como rodar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.local.example .env.local
# edite o .env.local com os valores reais

# 3. Rodar em modo desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Outros comandos

```bash
npm run build   # gera o build de produção
npm start       # roda o build de produção
npm run lint    # verifica o código com ESLint
```
