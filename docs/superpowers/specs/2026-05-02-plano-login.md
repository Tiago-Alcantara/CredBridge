# Plano de Login — CredBridge

> **Data:** 2026-05-02
> **Escopo:** UI funcional de login + registro consumindo o backend JWT real (já pronto). Persona prioritária: **PME**.
> **Fora do escopo:** Stellar SEP-10 real, KYC real, refresh token, social login, recuperação de senha, MFA.

---

## Estado atual (mapeado)

### Backend — ✅ pronto

- `POST /v1/auth/register` — bcrypt 10 rounds + JWT
- `POST /v1/auth/login` — valida senha, retorna `{ accessToken, user }`
- `POST /v1/auth/stellar/challenge` — **stub** (retorna string fake)
- `POST /v1/auth/stellar/verify` — **stub**
- `JwtAuthGuard` aplicado em receivables, documents, settlements, audit
- `JwtPayload`: `{ sub, email, role }`

### Frontend — infra ✅ pronta

- `apiFetch` wrapper (`lib/api/client.ts`) com `Authorization: Bearer` automático
- `auth-storage.ts` — token em `localStorage['credbridge.accessToken']`
- Hooks TanStack: `useLogin`, `useRegister`, `logout` (`lib/api/auth.ts`)
- `setOnUnauthorized` handler global — 401 limpa token
- `extractApiErrorMessage` — extrai mensagem do `ApiError.body`

### Frontend — UI 🟡 parcial

- `app/(auth)/login/page.tsx` existe mas **botões não chamam `useLogin`**:
  - Inputs de email/senha sem `useState`/`onChange`
  - Botão "continuar" só faz `setStep("stellar")`, não autentica
  - Sem validação Zod, sem mensagem de erro
- `app/(auth)/onboarding/page.tsx` — só 9 linhas, placeholder
- `StellarAuth` e `KycFlow` componentes — stubs visuais
- "Criar conta" link aponta `href="#"` — sem destino
- **Nenhuma rota está protegida no client** — `/pme/dashboard` etc abrem sem login
- Sem redirect global para `/login` em 401
- Sem layout/contexto de usuário logado

---

## Plano em 5 fases

```
Fase 1 (login real) → Fase 2 (registro) → Fase 3 (guard rotas) →
Fase 4 (logout + UX 401) → Fase 5 (validação Zod + erros)
```

Ordem importa. Fase 1 destrava as outras.

---

## Fase 1 — Login real funcionando

**Objetivo:** Usuário existente entra com email/senha, token salvo, redireciona pro dashboard da role.

### Tasks

- [ ] **1.1** Controlar inputs no `login/page.tsx`
  - `useState` para `email`, `password`
  - `onChange` nos `<input>`

- [ ] **1.2** Wire `useLogin` no botão "continuar" (step `credentials`)
  - `mutate({ email, password })`
  - `onSuccess`: redireciona pelo `data.user.role` (não pelo `role` selecionado na UI — confiar no backend)
  - `onError`: setar state de erro local

- [ ] **1.3** Mapear `user.role` → rota
  ```ts
  const route = {
    pme: "/pme/dashboard",
    investor: "/investor/dashboard",
    partner: "/partner/dashboard",
  }[user.role] ?? "/";
  ```

- [ ] **1.4** Mostrar erro abaixo do form
  - Usar `extractApiErrorMessage(error)`
  - 401 → "Email ou senha incorretos"
  - Outros → mensagem do backend

- [ ] **1.5** Loading state no botão (`isPending`)
  - Botão disabled + spinner

- [ ] **1.6** Smoke test
  ```bash
  # criar usuário direto via curl
  curl -X POST http://localhost:3001/v1/auth/register \
    -H 'Content-Type: application/json' \
    -d '{"email":"pme@test.com","password":"senha123","role":"pme"}'
  # depois fazer login na UI
  ```

**Critério:** login com user válido redireciona pra `/pme/dashboard` e o token aparece no localStorage.

---

## Fase 2 — Registro real

**Objetivo:** Link "Criar conta" leva pra fluxo que registra no backend.

### Tasks

- [ ] **2.1** Decidir UX
  - Opção A: nova rota `/register`
  - Opção B: novo `step="register"` na mesma página de login
  - **Recomendado: A** (rota separada, mais limpo)

- [ ] **2.2** Criar `app/(auth)/register/page.tsx`
  - Mesma estrutura visual do login
  - Inputs: email, senha, confirmar senha, role (dropdown)
  - Botão "Criar conta" chama `useRegister`
  - `onSuccess`: redireciona como Fase 1

- [ ] **2.3** Atualizar link no login
  - `href="/register"` em vez de `#`

- [ ] **2.4** Validação básica
  - Senha mínima 8 chars (alinhar com backend `RegisterDto`)
  - Confirmar senha precisa bater
  - Email com regex simples

- [ ] **2.5** Smoke test
  - Criar conta na UI → token salvo → dashboard.

---

## Fase 3 — Guard de rotas

**Objetivo:** Quem não está logado não vê dashboards. Quem está logado em role errada não acessa rota de outra role.

### Tasks

- [ ] **3.1** Criar hook `useAuth`
  - Lê token + decoda payload (`atob` na parte do meio do JWT)
  - Retorna `{ user, isAuthenticated, isLoading }`
  - Limpa token e retorna `null` se expirado

- [ ] **3.2** Criar componente `<RequireAuth role?="pme|investor|partner">`
  - Se não logado → `router.replace("/login")`
  - Se role errada → `router.replace("/")` (ou tela "sem permissão")
  - Renderiza `children` quando OK

- [ ] **3.3** Aplicar nos layouts de route group
  - `app/(pme)/layout.tsx` → `<RequireAuth role="pme">`
  - `app/(investor)/layout.tsx` → `<RequireAuth role="investor">`
  - `app/(partner)/layout.tsx` → `<RequireAuth role="partner">`

- [ ] **3.4** Smoke test
  - Sem token, abrir `/pme/dashboard` → redireciona pra `/login`
  - Logado como `investor`, abrir `/pme/dashboard` → redireciona

> **Nota:** isso é guard de **client-side**. Não é proteção real (token vai no Authorization header — segurança real está no backend). Mas é UX necessária.

---

## Fase 4 — Logout + UX de 401

**Objetivo:** Usuário consegue sair. Token expirado/inválido manda usuário pro login automaticamente.

### Tasks

- [ ] **4.1** Botão logout no `Sidebar`/`AppTopBar`
  - Chama `logout()` (já existe em `auth.ts`)
  - `queryClient.clear()` pra limpar cache
  - `router.push("/login")`

- [ ] **4.2** Wire `setOnUnauthorized` global
  - No `QueryProvider` ou em um `AuthProvider` novo:
    ```ts
    setOnUnauthorized(() => {
      queryClient.clear();
      window.location.href = "/login";
    });
    ```
  - Já existe no client.ts mas não está conectado

- [ ] **4.3** Smoke test
  - Logout → token sumiu, dashboard redireciona pra login
  - Token expirado/inválido na requisição → 401 → redireciona automaticamente

---

## Fase 5 — Validação Zod + erros padronizados

**Objetivo:** Validação client-side casa com a do backend. Mensagens de erro claras e consistentes.

### Tasks

- [ ] **5.1** Criar `lib/validations/auth.ts`
  - `loginSchema` — email, password
  - `registerSchema` — email, password (min 8), confirmPassword (refine), role (enum)

- [ ] **5.2** Integrar com React Hook Form + zodResolver
  - Trocar inputs controlados manuais por `register("email")`
  - Erros de campo abaixo do input

- [ ] **5.3** Componente `<FormField>` reutilizável
  - Label + input + erro
  - Padroniza UI de erro de campo

- [ ] **5.4** Smoke test
  - Submeter form vazio → erros aparecem inline
  - Submeter senha < 8 → erro inline
  - 400 do backend → erros mapeados pros campos certos

---

## Estrutura final esperada

```
apps/web/src/
├── app/
│   └── (auth)/
│       ├── layout.tsx
│       ├── login/page.tsx         (refeito — Fases 1, 5)
│       ├── register/page.tsx      (novo — Fase 2)
│       └── onboarding/page.tsx    (placeholder por enquanto)
├── components/
│   ├── auth/
│   │   ├── RequireAuth.tsx        (novo — Fase 3)
│   │   ├── KycFlow.tsx            (já existe — stub)
│   │   ├── StellarAuth.tsx        (já existe — stub)
│   │   ├── LoginBG.tsx            (já existe)
│   │   └── FormField.tsx          (novo — Fase 5)
│   └── primitives/
│       └── (existentes)
├── hooks/
│   └── useAuth.ts                 (novo — Fase 3)
├── lib/
│   ├── api/
│   │   ├── auth.ts                (já existe)
│   │   ├── auth-storage.ts        (já existe)
│   │   └── client.ts              (já existe)
│   └── validations/
│       └── auth.ts                (novo — Fase 5)
└── providers/
    └── AuthProvider.tsx           (opcional — Fase 4)
```

---

## Decisões em aberto

| Pergunta | Sugestão |
|---|---|
| Rota separada de registro vs step na mesma página | **rota** (`/register`) |
| Token: localStorage vs cookie httpOnly | localStorage por enquanto, migrar antes de prod |
| Logout: limpar `queryClient` ou só remover token | **limpar tudo** |
| Recuperação de senha | fora do escopo desta fase |
| Stellar SEP-10 | fora — manter botão como "em breve" |
| KYC PME após registro | fora — abrir tela placeholder |
| Refresh token | fora — JWT expira, força re-login |

---

## Riscos / pontos de atenção

- **Hidratação SSR:** `useAuth` e `RequireAuth` mexem com `localStorage` → só renderizar conteúdo após `useEffect` montar. Sem isso, hydration mismatch.
- **Race condition no logout:** `queryClient.clear()` antes do redirect pra evitar refetch com token zerado.
- **Token decode:** `atob(token.split(".")[1])` quebra se token mal formado. Try/catch obrigatório.
- **Backend `RegisterDto`:** confirmar regras (min length da senha) pra alinhar Zod com `class-validator`.

---

## Critério de pronto da fase

- ✅ Login com user válido → dashboard correto
- ✅ Registro cria user → loga automaticamente
- ✅ Logout funciona, redireciona
- ✅ Rotas protegidas
- ✅ 401 redireciona automaticamente
- ✅ Erros do backend aparecem na UI

Tudo isso sem Stellar/KYC reais — só email/senha JWT.

---

## Notas relacionadas

- Backend pronto: `apps/api/src/modules/auth/`
- Spec original (já concluída): `docs/superpowers/specs/2026-05-02-proximos-passos-curto-prazo.md` — Fase 3
- Status geral: `docs/STATUS.md`
