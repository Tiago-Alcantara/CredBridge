# Profissionalização dos Smart Contracts CredBridge

Refatorar os **3 contratos** do CredBridge para usar a biblioteca **OpenZeppelin Stellar Contracts** — o padrão de mercado para contratos auditados e seguros no ecossistema Soroban.

---

## Resumo Executivo

| Contrato | Estado Atual | Novo Padrão | Resultado |
|----------|-------------|-------------|-----------|
| **NF-e Tokenization** | Registry manual (storage) | OpenZeppelin `NonFungibleToken` (SEP-50) | Cada NF-e = **1 NFT real** na carteira da PME |
| **Mock BRLT** | Token manual (sem trait) | OpenZeppelin `FungibleToken` (SEP-41) | Token **reconhecido** por wallets e explorers |
| **Liquidity Pool** | contractclient manual | Consome tokens OZ via `TokenClient` padrão | Interoperabilidade garantida |

---

## Contexto

### Problema Atual
- **NF-e:** Dados salvos no storage do contrato. Não aparece como ativo na carteira da PME. Não é tokenização real.
- **BRLT:** Reimplementa `balance`, `transfer`, `mint`, `burn` na mão. Não implementa o trait SEP-41 oficial. Wallets e explorers não reconhecem como token válido.
- **Pool:** Lógica de negócio boa, mas usa `contractclient` manual para interagir com tokens em vez do `TokenClient` padrão do soroban-sdk.

### Padrão de Mercado
- **Centrifuge, Goldfinch, Huma Finance**: Cada recebível = 1 NFT. Tokens fungíveis seguem ERC-20 (equivalente Stellar = SEP-41).
- **OpenZeppelin**: Biblioteca auditada, mantida, padrão da indústria. Já disponível para Stellar/Soroban via [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts).

---

## Perguntas Abertas (Aguardando Aprovação)

1. **NFT Metadata URI:** Usar `https://credbridge.io/nfe/` como placeholder para testnet?
2. **NFT Nome/Símbolo:** `"CredBridge NF-e"` / `"CBNFE"` — ok?
3. **Burn automático:** Quando `settle_nfe` é chamado, queimar o NFT automaticamente? (Padrão = sim)
4. **BRLT decimais:** Manter 7 decimais (padrão Stellar) ou usar 2 (centavos BRL)?

---

## Dependências OpenZeppelin

### Workspace Cargo.toml (atualizado)

```toml
[workspace.dependencies]
soroban-sdk = "22.0.0"
stellar-tokens = "=0.7.1"     # FungibleToken + NonFungibleToken
stellar-macros = "=0.7.1"     # #[only_owner] e decorators
stellar-access = "=0.7.1"     # Ownable, access control
```

---

## Contrato 1: NF-e Tokenization (NFT)

### Objetivo
Cada NF-e tokenizada = **1 NFT único** (token_id sequencial) na carteira da PME.

### Arquivos Modificados

#### [MODIFY] `contracts/nfe_tokenization/Cargo.toml`
```toml
[dependencies]
soroban-sdk = { workspace = true }
stellar-tokens = { workspace = true }
stellar-macros = { workspace = true }
```

#### [MODIFY] `contracts/nfe_tokenization/src/lib.rs`

**Mudanças estruturais:**

1. **Implementar traits `NonFungibleToken` + `NonFungibleBurnable`**
   - Expõe automaticamente: `balance_of`, `owner_of`, `transfer_from`, etc.

2. **Novo constructor `__constructor`**
   ```rust
   pub fn __constructor(e: &Env, uri: String, name: String, symbol: String, platform: Address) {
       e.storage().instance().set(&DataKey::Platform, &platform);
       Base::set_metadata(e, uri, name, symbol);
   }
   ```

3. **NfeData — novo campo `token_id`**
   ```rust
   pub struct NfeData {
       pub key: String,
       pub token_id: u32,          // ← NOVO
       pub value: i128,
       pub due_date: u64,
       pub xml_hash: BytesN<32>,
       pub owner: Address,
       pub status: Symbol,
       pub invoice_hash: BytesN<32>,
       pub rate_bps: i128,
       pub advance_amount: i128,
   }
   ```

4. **DataKey — novos índices**
   ```rust
   pub enum DataKey {
       Nfe(String),
       SaleListing(String),
       Platform,            // ← NOVO
       TokenToNfe(u32),     // ← NOVO: token_id → nfe_key
   }
   ```

5. **`tokenize_nfe` — minta NFT**
   ```rust
   // Após criar NfeData:
   let token_id = Base::sequential_mint(&env, &owner);
   nfe_data.token_id = token_id;
   env.storage().persistent().set(&DataKey::TokenToNfe(token_id), &key);
   ```

6. **`transfer_ownership` — transfere NFT junto**
   ```rust
   Base::transfer(&env, nfe_data.token_id, &old_owner, &new_owner);
   ```

7. **`settle_nfe` — queima NFT**
   ```rust
   Base::burn(&env, nfe_data.token_id);
   ```

8. **Implementar traits**
   ```rust
   #[contractimpl(contracttrait)]
   impl NonFungibleToken for CredBridgeContract {
       type ContractType = Base;
   }

   #[contractimpl(contracttrait)]
   impl NonFungibleBurnable for CredBridgeContract {}
   ```

9. **Nova função `get_nfe_by_token_id`**
   ```rust
   pub fn get_nfe_by_token_id(env: Env, token_id: u32) -> NfeData {
       let key: String = env.storage().persistent()
           .get(&DataKey::TokenToNfe(token_id))
           .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));
       Self::get_nfe(env, key)
   }
   ```

### Testes atualizados (`test.rs`)
- `balance_of(pme)` = 1 após `tokenize_nfe`
- `owner_of(token_id)` = `pme_address`
- `balance_of(pme)` = 0 após `settle_nfe` (burn)
- Transfer do NFT funciona ao chamar `transfer_ownership`

---

## Contrato 2: Mock BRLT (Token Fungível SEP-41)

### Objetivo
Substituir a implementação manual por um token **SEP-41 compliant** usando OpenZeppelin `FungibleToken`.

### Arquivos Modificados

#### [MODIFY] `contracts/mock_brlt/Cargo.toml`
```toml
[dependencies]
soroban-sdk = { workspace = true }
stellar-tokens = { workspace = true }
stellar-macros = { workspace = true }
```

#### [REWRITE] `contracts/mock_brlt/src/lib.rs`

**Antes (316 linhas manuais)** → **Depois (~40 linhas com OpenZeppelin)**

```rust
#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};
use stellar_tokens::fungible::{
    FungibleToken, Base,
    mintable::FungibleMintable,
    burnable::FungibleBurnable,
};

#[contracttype]
pub enum DataKey {
    Admin,
}

#[contract]
pub struct MockBrltToken;

#[contractimpl]
impl MockBrltToken {
    pub fn __constructor(e: &Env, admin: Address, name: String, symbol: String, decimals: u32) {
        e.storage().instance().set(&DataKey::Admin, &admin);
        Base::set_metadata(e, name, symbol, decimals);
    }

    pub fn mint(e: &Env, to: Address, amount: i128) {
        let admin: Address = e.storage().instance()
            .get(&DataKey::Admin)
            .expect("admin should be set");
        admin.require_auth();
        Base::mint(e, &to, amount);
    }
}

// SEP-41 compliant — wallets e explorers reconhecem automaticamente
#[contractimpl(contracttrait)]
impl FungibleToken for MockBrltToken {
    type ContractType = Base;
}

#[contractimpl(contracttrait)]
impl FungibleBurnable for MockBrltToken {}
```

### Vantagens vs. implementação atual
| Aspecto | Manual (atual) | OpenZeppelin (novo) |
|---------|---------------|-------------------|
| Linhas de código | 316 | ~40 |
| SEP-41 compliant | ❌ | ✅ |
| Visível em wallets | ❌ | ✅ |
| Auditado | ❌ | ✅ |
| `approve` / `transfer_from` | Manual | Automático |

---

## Contrato 3: Liquidity Pool (Ajustes Mínimos)

### Objetivo
A lógica de negócio do pool **não muda**. Apenas ajustar a interface de consumo de tokens para ser compatível com os novos contratos OZ.

### Arquivos Modificados

#### [MODIFY] `contracts/liquidity_pool/Cargo.toml`
- Sem mudanças de dependências (já usa soroban-sdk puro)

#### [MODIFY] `contracts/liquidity_pool/src/lib.rs`

**Mudanças mínimas:**

1. **`TokenClient` trait** — Verificar compatibilidade com SEP-41 do novo BRLT
   - O `TokenClient` manual já usa `transfer`, `balance` — mesma assinatura do SEP-41 ✅
   - Possível ajuste: usar o `soroban_sdk::token::TokenClient` nativo em vez do `contractclient` manual

2. **`ShareTokenClient` trait** — Ajustar para usar `mint(admin, to, amount)` do novo BRLT
   - O novo BRLT com OZ tem `mint(to, amount)` sem admin como parâmetro (admin via `require_auth` interno)
   - **Ajuste necessário** na assinatura do `ShareTokenClient::mint`

```rust
// ANTES (manual):
#[contractclient(name = "ShareTokenClient")]
pub trait ShareTokenInterface {
    fn mint(env: Env, admin: Address, to: Address, amount: i128);
    fn burn(env: Env, from: Address, amount: i128);
    fn balance(env: Env, account: Address) -> i128;
}

// DEPOIS (compatível com OZ FungibleToken):
// Depende da interface final do mint no novo BRLT
// Se o mint do OZ aceita (to, amount) sem admin:
#[contractclient(name = "ShareTokenClient")]
pub trait ShareTokenInterface {
    fn mint(env: Env, to: Address, amount: i128);
    fn burn(env: Env, from: Address, amount: i128);
    fn balance(env: Env, account: Address) -> i128;
}
```

3. **`mint_shares` helper** — Remover parâmetro `admin`
```rust
// ANTES:
fn mint_shares(env: &Env, share_token: &Address, to: &Address, amount: i128) {
    let client = ShareTokenClient::new(env, share_token);
    client.mint(&env.current_contract_address(), to, &amount);
}

// DEPOIS:
fn mint_shares(env: &Env, share_token: &Address, to: &Address, amount: i128) {
    let client = ShareTokenClient::new(env, share_token);
    client.mint(to, &amount);
}
```

> **Nota:** A lógica de deposit, withdraw, buy_tokenized_invoice e settle_invoice_in_pool permanece **100% igual**.

---

## Sequência de Deploy

```bash
# 1. Compilar todos os contratos
cd contracts
stellar contract build

# 2. Deploy BRLT primeiro (dependência do Pool)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/mock_brlt_token.wasm \
  --source <PLATFORM_KEY> \
  --network testnet \
  -- \
  --admin <PLATFORM_ADDRESS> \
  --name "Brazilian Real Token" \
  --symbol "BRLT" \
  --decimals 7
# → Anotar BRLT_CONTRACT_ID

# 3. Deploy Share Token (CBPOOL) — mesmo padrão do BRLT
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/mock_brlt_token.wasm \
  --source <PLATFORM_KEY> \
  --network testnet \
  -- \
  --admin <PLATFORM_ADDRESS> \
  --name "CredBridge Pool Share" \
  --symbol "CBPOOL" \
  --decimals 7
# → Anotar CBPOOL_CONTRACT_ID

# 4. Deploy Liquidity Pool
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/liquidity_pool.wasm \
  --source <PLATFORM_KEY> \
  --network testnet \
  -- \
  --admin <PLATFORM_ADDRESS> \
  --operator <PLATFORM_ADDRESS> \
  --asset_address <BRLT_CONTRACT_ID> \
  --share_token_address <CBPOOL_CONTRACT_ID>
# → Anotar POOL_CONTRACT_ID

# 5. Deploy NF-e NFT
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/nfe_contract.wasm \
  --source <PLATFORM_KEY> \
  --network testnet \
  -- \
  --uri "https://credbridge.io/nfe/" \
  --name "CredBridge NF-e" \
  --symbol "CBNFE" \
  --platform <PLATFORM_ADDRESS>
# → Anotar NFE_CONTRACT_ID

# 6. Atualizar .env
STELLAR_NFE_CONTRACT_ID=<NFE_CONTRACT_ID>
STELLAR_POOL_CONTRACT_ID=<POOL_CONTRACT_ID>
STELLAR_BRLT_TOKEN_ID=<BRLT_CONTRACT_ID>
```

---

## Ajustes no Backend (`apps/api/`)

### `stellar.service.ts`
- `tokenizeNfe`: Sem mudanças na chamada
- `transferNftToPlatform`: Sem mudanças
- **Novo**: `getNfeByTokenId(tokenId: number)` — consulta NF-e pelo ID do NFT
- `payPme` / `mintBrlt`: Ajustar assinatura do `mint` se mudar (remover admin param)

### `.env`
- Atualizar os 3 Contract IDs após deploy

---

## Fluxo Completo (Após Implementação)

```
PME faz upload da NF-e
        │
        ▼
API chama tokenize_nfe(key, value, owner...)
        │
        ▼
Contrato minta NFT #1 → carteira da PME
        │
        ▼
NFT aparece no Stellar Explorer ✅
BRLT aparece como token SEP-41 ✅
        │
        ▼
PME solicita cessão
        │
        ▼
API chama transfer_ownership(key, platform)
NFT transferido: PME → Platform
        │
        ▼
Pool compra a NF-e via buy_tokenized_invoice
BRLT transferido: Pool → PME (antecipação)
        │
        ▼
Sacado paga → settle_nfe(key)
NFT queimado 🔥 (burn)
Pool reduz principal via settle_invoice_in_pool
```

---

## Verificação

### Testes Automatizados
```bash
# Todos os contratos (Rust)
cd contracts && cargo test

# API (Node)
cd apps/api && npm test
```

### Verificação Manual
1. Tokenizar NF-e → NFT visível na carteira PME no Stellar Explorer
2. Mint BRLT → Token SEP-41 visível como ativo na carteira
3. Deposit no Pool → CBPOOL shares visíveis na carteira do investidor
4. Liquidar → NFT queimado, balance = 0

---

## Estimativa de Esforço

| Componente | Estimativa |
|-----------|-----------|
| NF-e → NFT (contrato + testes) | ~2-3h |
| BRLT → OZ FungibleToken | ~1h |
| Pool → Ajuste de interface | ~30min |
| Compilação + Deploy testnet (3 contratos) | ~1h |
| Ajustes no StellarService | ~30min |
| Verificação E2E | ~30min |
| **Total** | **~5-6h** |

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Incompatibilidade soroban-sdk 22 + stellar-tokens 0.7.1 | Verificar no crates.io antes de compilar |
| Tamanho do WASM exceder limite | `opt-level = "z"` + `lto = true` (já configurado) |
| Constructor muda deploy flow | Documentar nova sequência no README |
| Pool mint sem admin param | Ajustar `ShareTokenInterface` para nova assinatura |
| Migração de dados antigos | Já limpamos o banco local — deploy limpo |
