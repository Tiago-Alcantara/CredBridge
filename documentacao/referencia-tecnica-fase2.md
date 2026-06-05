# 🚀 Referência Técnica e Regras de Negócio: CredBridge — Fase 2 (Contratos & Validação)

Focar na finalização e validação da arquitetura de **Smart Contracts (Soroban/Stellar)** e nos gatilhos de sincronização off-chain.

A prioridade da Fase 2 é garantir:

- consistência matemática do Pool de Liquidez;
- emissão correta de cotas;
- cálculo seguro de NAV;
- integração com o contrato de NF-e já existente;
- prevenção de dupla tokenização e duplo processamento;
- sincronização confiável entre contrato NF-e, backend e contrato do Pool;
- rastreabilidade por eventos on-chain;
- validação completa em ambiente Testnet.

Este documento centraliza as diretrizes arquiteturais, regras de segurança, especificações matemáticas e detalhamento das tarefas da Fase 2, servindo como **referência principal** para a implementação.

---

# 1. Regras Críticas de Negócio e Segurança (Stellar / Soroban)

As seguintes regras devem ser estritamente seguidas durante a implementação dos contratos inteligentes e dos drivers off-chain.

---

## 1.1 Ambiente de execução

Todo código de contrato inteligente em Rust/Soroban deve utilizar:

```rust
#![no_std]
```

Nenhum contrato deve depender de bibliotecas incompatíveis com o ambiente `no_std`.

---

## 1.2 Tipagem de dados

Valores financeiros devem ser tratados sempre como inteiros, evitando qualquer uso de `float`, `double`, `f64` ou equivalentes.

| Tipo de dado | Tipo recomendado | Observação |
|---|---:|---|
| Valores monetários | `i128` | Menor unidade do ativo |
| Quantidade de cotas | `i128` | Com escala fixa |
| Taxas em basis points | `i128` | Ex: 100 bps = 1% |
| Timestamps | `u64` | Unix timestamp |
| Endereços | `Address` | Contas e contratos |
| Hash da NF-e | `BytesN<32>` | Hash da chave de acesso |

---

## 1.3 Identificação e unicidade da NF-e

A Chave de Acesso da NF-e possui 44 dígitos e deve continuar sendo a referência única da nota no sistema.

Porém, em vez de usar a chave diretamente como `Symbol` no `Persistent Storage`, a recomendação é utilizar o hash da chave de acesso:

```text
invoice_hash = sha256(nfe_access_key)
```

O contrato deve armazenar esse identificador como:

```rust
BytesN<32>
```

Estrutura recomendada:

```rust
#[contracttype]
pub enum DataKey {
    PoolState,
    ProcessedInvoice(BytesN<32>),
}
```

Motivo:

- evita uso indevido de `Symbol` para dados longos;
- reduz risco de problemas com identificadores dinâmicos;
- melhora padronização entre contrato NF-e, Pool e backend;
- facilita idempotência.

---

## 1.4 Gerenciamento de estado e TTL

Todo registro salvo em `Persistent Storage` deve considerar gerenciamento de TTL.

Registros críticos que exigem atenção:

- estado global do Pool;
- NF-es processadas;
- configurações de admin/operator;
- flags de pausa;
- eventuais índices auxiliares.

A estratégia de TTL deve garantir que dados críticos não expirem indevidamente enquanto ainda forem necessários para auditoria, idempotência ou cálculo econômico.

---

## 1.5 Autenticação on-chain

Toda função que altera estado ou movimenta fundos deve utilizar:

```rust
require_auth()
```

Matriz mínima de permissões:

| Função | Quem autentica | Observação |
|---|---|---|
| `initialize` | Admin/deployer | Apenas uma vez |
| `deposit` | Investidor | Autoriza movimentação de BRLT |
| `register_anticipation` | Operator/Admin | Registra NF-e antecipada no Pool |
| `pause` | Admin | Pausa operações críticas |
| `unpause` | Admin | Reativa operações |
| `set_operator` | Admin | Atualiza operador autorizado |
| `get_nav` | Público | Apenas leitura |
| `get_share_price` | Público | Apenas leitura |
| `get_pool_state` | Público | Apenas leitura |

---

## 1.6 Robustez e erros customizados

Todos os erros relevantes devem ser representados por enums customizados mapeados via:

```rust
#[contracterror]
```

Exemplo recomendado:

```rust
#[contracterror]
pub enum PoolError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Paused = 4,
    InvalidAmount = 5,
    InvalidRate = 6,
    InvoiceAlreadyProcessed = 7,
    InvalidSharePrice = 8,
    InvalidNav = 9,
    TimestampWentBackwards = 10,
}
```

---

## 1.7 Pausa operacional

O contrato do Pool deve implementar mecanismo de pausa emergencial:

```rust
pause(admin: Address)
unpause(admin: Address)
```

Quando pausado, o contrato deve bloquear:

- novos depósitos;
- registro de novas antecipações;
- movimentações de fundos;
- futuras operações de resgate, quando implementadas.

Funções de leitura podem continuar disponíveis.

---

# 2. Arquitetura e Contexto de Implementação (Monorepo)

## 2.1 Estrutura geral

```text
contracts/
  liquidity_pool/
  nfe_tokenization/
  mock_brlt/

apps/
  api/
    src/
      modules/
      shared/
        blockchain/
      sync-driver/

scripts/
  deploy-mock-brlt.ts
  faucet-brlt.ts
  listen-nfe-events.ts
  test-core-flow.ts
```

---

## 2.2 Componentes principais

| Componente | Responsabilidade |
|---|---|
| Smart Contracts Soroban/Rust | Lógica on-chain crítica |
| Contrato NF-e | Tokenização, unicidade e evento de NF-e tokenizada |
| Liquidity Pool | Depósitos, NAV, cotas, juros e registro de antecipações |
| Token BRLT mockado | Simulação de stablecoin BRL na Testnet |
| Backend Node.js/TypeScript | Listener, orquestração, retry e auditoria |
| Scripts Testnet | Deploy, faucet e validação E2E |
| Testes unitários | Validação matemática e segurança dos contratos |

---

## 2.3 Ambiente de teste

O ambiente de teste deve utilizar intensivamente a **Stellar Testnet**, com ativos mockados para eliminar dependências externas.

Ativo principal de teste:

```text
Dummy BRLT
```

Finalidade:

- simular depósitos de investidores;
- testar transferências;
- validar emissão de cotas;
- validar NAV;
- validar integração com o Pool.

---

# 3. Especificação Matemática do Pool

Antes de iniciar a implementação do contrato do Pool, a matemática deve estar formalmente definida.

Essa é a parte mais sensível da Fase 2, pois erros aqui podem causar:

- emissão incorreta de cotas;
- diluição indevida de investidores;
- NAV inconsistente;
- juros acumulados de forma errada;
- divergência entre backend e contrato.

---

## 3.1 Conceitos principais

| Termo | Definição |
|---|---|
| `cash_balance` | Saldo real de BRLT mantido pelo contrato |
| `total_principal` | Principal em aberto referente às NF-es antecipadas |
| `accrued_interest` | Juros acumulados desde o último accrual |
| `NAV` | Valor patrimonial líquido do Pool |
| `total_shares` | Total de cotas emitidas |
| `share_price` | Preço atual de uma cota |
| `average_daily_rate_bps` | Taxa média diária ponderada do principal em aberto |
| `last_accrual_timestamp` | Último timestamp usado no cálculo de juros |

---

## 3.2 Escalas recomendadas

Todos os cálculos devem ser feitos com inteiros.

Sugestão inicial:

```text
BPS_SCALE = 10_000
SECONDS_PER_DAY = 86_400
PRICE_SCALE = 1_000_000_000
SHARE_SCALE = 1_000_000_000
```

Essas escalas devem ser replicadas nos testes e documentadas no contrato.

---

## 3.3 Accrual logic

A função interna `accrue_interest()` deve calcular juros pro-rata com base no tempo decorrido desde o último update.

```text
elapsed_seconds = env.ledger().timestamp() - last_accrual_timestamp
```

Fórmula linear sugerida:

```text
interest =
    total_principal
    * average_daily_rate_bps
    * elapsed_seconds
    / (BPS_SCALE * SECONDS_PER_DAY)
```

Regras:

- se `total_principal == 0`, apenas atualizar `last_accrual_timestamp`;
- se `elapsed_seconds == 0`, não acumular juros;
- se `current_timestamp < last_accrual_timestamp`, retornar erro;
- toda operação econômica relevante deve chamar `accrue_interest()` antes de alterar estado.

---

## 3.4 Cálculo de NAV

Modelo recomendado:

```text
NAV = cash_balance + total_principal + accrued_interest
```

Observação importante:

```text
NAV contábil != caixa disponível
```

O Pool pode ter NAV positivo, mas caixa insuficiente para resgates imediatos, caso parte relevante do capital esteja alocada em antecipações de NF-e.

Mesmo que resgate não seja implementado nesta fase, essa distinção deve estar prevista no design.

---

## 3.5 Cálculo do preço da cota

Se o Pool ainda não possui cotas:

```text
share_price = PRICE_SCALE
```

Caso contrário:

```text
share_price = NAV * PRICE_SCALE / total_shares
```

Regras:

- `share_price` não pode ser zero se `total_shares > 0`;
- `NAV` não pode ser negativo;
- arredondamentos devem ser conservadores e documentados.

---

## 3.6 Emissão de cotas no depósito

A função `deposit(investor, amount)` deve calcular as cotas usando o NAV **antes** da entrada do novo dinheiro.

Isso evita diluição incorreta.

### Pool vazio

```text
shares_to_mint = amount * SHARE_SCALE
```

### Pool já existente

```text
shares_to_mint = amount * total_shares / nav_before_deposit
```

Fluxo correto:

```text
1. validar amount > 0
2. exigir investor.require_auth()
3. chamar accrue_interest()
4. calcular nav_before_deposit
5. transferir BRLT do investidor para o contrato
6. calcular shares_to_mint
7. mintar cotas
8. atualizar total_shares
9. emitir evento Deposit
```

---

## 3.7 Média ponderada da taxa

Ao registrar uma nova antecipação:

```text
new_average_rate =
    (
        current_principal * current_average_rate
        + anticipation_amount * anticipation_rate
    )
    / (current_principal + anticipation_amount)
```

Regras:

- se `current_principal == 0`, a nova taxa média é a taxa da nota;
- se `anticipation_amount <= 0`, retornar erro;
- se `anticipation_rate <= 0`, retornar erro;
- aplicar limite máximo de taxa;
- garantir que todas as taxas estejam na mesma unidade temporal.

---

# 4. Invariantes Obrigatórias

As seguintes regras devem sempre ser verdadeiras:

```text
total_shares >= 0
```

```text
NAV >= 0
```

```text
amount de depósito > 0
```

```text
anticipation_amount > 0
```

```text
rate_bps dentro do limite permitido
```

```text
invoice_hash não pode ser processado duas vezes
```

```text
last_accrual_timestamp nunca pode andar para trás
```

```text
share_price > 0 quando total_shares > 0
```

```text
somente admin/operator pode registrar antecipação
```

```text
deposit sempre chama accrue_interest antes de calcular cotas
```

```text
register_anticipation sempre chama accrue_interest antes de alterar principal/taxa
```

```text
contrato pausado não aceita depósitos nem antecipações
```

Essas invariantes devem virar testes automatizados.

---

# 5. Eventos On-chain

Eventos são obrigatórios para rastreabilidade, sincronização off-chain e auditoria.

---

## 5.1 Evento de depósito

```text
Deposit {
    investor,
    amount,
    shares_minted,
    nav_before,
    nav_after,
    share_price
}
```

---

## 5.2 Evento de accrual

```text
Accrued {
    elapsed_seconds,
    interest_accrued,
    total_accrued_interest,
    new_nav,
    timestamp
}
```

---

## 5.3 Evento de antecipação registrada

```text
AnticipationRegistered {
    invoice_hash,
    anticipation_amount,
    rate_bps,
    maturity_timestamp,
    total_principal,
    average_daily_rate_bps
}
```

---

## 5.4 Evento de NF-e tokenizada

O contrato de NF-e deve emitir evento após tokenização bem-sucedida:

```text
InvoiceTokenized {
    invoice_hash,
    amount,
    rate_bps,
    maturity_timestamp,
    issuer,
    timestamp
}
```

---

## 5.5 Eventos de pausa

```text
PoolPaused {
    admin,
    timestamp
}
```

```text
PoolUnpaused {
    admin,
    timestamp
}
```

---

# 6. Detalhamento das Tasks (Fase 2)

---

## [Task 1] Especificação Matemática do Pool

**Objetivo:** Fechar a modelagem econômica antes da implementação.

**Passos de implementação:**

- [ ] Definir fórmula final de NAV.
- [ ] Definir fórmula final de share price.
- [ ] Definir fórmula final de emissão de cotas.
- [ ] Definir escalas fixas.
- [ ] Definir regra de arredondamento.
- [ ] Definir unidade da taxa.
- [ ] Definir limite máximo de taxa.
- [ ] Definir comportamento de Pool vazio.
- [ ] Definir eventos econômicos.
- [ ] Validar exemplos numéricos manualmente.

---

## [Task 2] Smart Contract: Liquidity Pool (Rust/Soroban)

**Diretório alvo:** `contracts/liquidity_pool/`

**Objetivo:** Implementar o cofre de investimentos responsável por depósitos, NAV, juros, cotas e registro de antecipações.

---

### 2.1 Inicialização

Criar função:

```rust
initialize(
    admin: Address,
    operator: Address,
    asset_address: Address,
    share_token_address: Address
)
```

Responsabilidades:

- [ ] Validar que o contrato ainda não foi inicializado.
- [ ] Configurar admin.
- [ ] Configurar operador autorizado.
- [ ] Configurar token BRLT.
- [ ] Configurar token de cotas.
- [ ] Inicializar `total_principal = 0`.
- [ ] Inicializar `accrued_interest = 0`.
- [ ] Inicializar `total_shares = 0`.
- [ ] Definir `last_accrual_timestamp`.
- [ ] Definir `paused = false`.

---

### 2.2 Estado do Pool

Estrutura sugerida:

```rust
#[contracttype]
pub struct PoolState {
    pub admin: Address,
    pub operator: Address,
    pub asset_address: Address,
    pub share_token_address: Address,

    pub total_principal: i128,
    pub accrued_interest: i128,
    pub total_shares: i128,

    pub average_daily_rate_bps: i128,
    pub last_accrual_timestamp: u64,

    pub paused: bool,
    pub initialized: bool,
}
```

---

### 2.3 Accrual Logic

Criar função interna:

```rust
fn accrue_interest(env: &Env, state: &mut PoolState)
```

Responsabilidades:

- [ ] Calcular `elapsed_seconds`.
- [ ] Validar timestamp.
- [ ] Calcular juros pro-rata.
- [ ] Atualizar `accrued_interest`.
- [ ] Atualizar `last_accrual_timestamp`.
- [ ] Emitir evento `Accrued`, se houver juros acumulados.

---

### 2.4 Deposit & Mint

Criar função:

```rust
deposit(investor: Address, amount: i128)
```

Responsabilidades:

- [ ] Validar contrato inicializado.
- [ ] Validar contrato não pausado.
- [ ] Validar `amount > 0`.
- [ ] Executar `investor.require_auth()`.
- [ ] Chamar `accrue_interest()` antes de calcular cotas.
- [ ] Calcular `nav_before_deposit`.
- [ ] Transferir `amount` de BRLT do investidor para o contrato.
- [ ] Calcular cotas com base no NAV anterior.
- [ ] Mintar cotas para o investidor.
- [ ] Atualizar `total_shares`.
- [ ] Emitir evento `Deposit`.

---

### 2.5 Registro de Antecipação

Substituir a ideia de:

```rust
update_pool_after_anticipation(new_principal, new_rate)
```

por um modelo incremental:

```rust
register_anticipation(
    operator: Address,
    invoice_hash: BytesN<32>,
    anticipation_amount: i128,
    rate_bps: i128,
    maturity_timestamp: u64
)
```

Responsabilidades:

- [ ] Validar contrato inicializado.
- [ ] Validar contrato não pausado.
- [ ] Executar `operator.require_auth()`.
- [ ] Validar operador autorizado.
- [ ] Chamar `accrue_interest()`.
- [ ] Verificar se `invoice_hash` já foi processado.
- [ ] Validar `anticipation_amount > 0`.
- [ ] Validar `rate_bps`.
- [ ] Atualizar `average_daily_rate_bps`.
- [ ] Atualizar `total_principal`.
- [ ] Marcar `invoice_hash` como processado.
- [ ] Emitir evento `AnticipationRegistered`.

---

### 2.6 Funções de leitura

Implementar:

```rust
get_nav() -> i128
```

```rust
get_share_price() -> i128
```

```rust
get_pool_state() -> PoolState
```

Responsabilidades:

- [ ] Permitir leitura pública.
- [ ] Não alterar estado.
- [ ] Retornar dados consistentes.
- [ ] Considerar accrual estimado, se aplicável.

---

### 2.7 Pausa e controle operacional

Implementar:

```rust
pause(admin: Address)
```

```rust
unpause(admin: Address)
```

```rust
set_operator(admin: Address, new_operator: Address)
```

Responsabilidades:

- [ ] Exigir autenticação do admin.
- [ ] Validar permissões.
- [ ] Bloquear depósitos quando pausado.
- [ ] Bloquear antecipações quando pausado.
- [ ] Emitir eventos de pausa e reativação.

---

### 2.8 Erros customizados

Implementar enum:

```rust
#[contracterror]
pub enum PoolError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Paused = 4,
    InvalidAmount = 5,
    InvalidRate = 6,
    InvoiceAlreadyProcessed = 7,
    InvalidSharePrice = 8,
    InvalidNav = 9,
    TimestampWentBackwards = 10,
}
```

---

## [Task 3] Integração com Contrato de NF-e

**Objetivo:** Garantir que a tokenização da NF-e acione corretamente o fluxo de atualização do Pool.

**Passos de implementação:**

- [ ] Revisar contrato de NF-e existente.
- [ ] Confirmar prevenção de dupla tokenização.
- [ ] Implementar ou padronizar `invoice_hash`.
- [ ] Emitir evento `InvoiceTokenized`.
- [ ] Incluir no evento:
  - [ ] `invoice_hash`;
  - [ ] `amount`;
  - [ ] `rate_bps`;
  - [ ] `maturity_timestamp`;
  - [ ] `issuer`;
  - [ ] `timestamp`.
- [ ] Garantir compatibilidade com o backend listener.
- [ ] Criar teste de integração NF-e → Backend → Pool.

---
## [Task 3.1] Venda/Cessão de NF-e Tokenizada para o Pool

**Objetivo:** Cobrir o caso em que a NF-e já foi tokenizada e o cliente decide vender a nota para o Pool de Liquidez.

Este fluxo representa a operação econômica de antecipação: o cliente possui uma NF-e tokenizada e deseja cedê-la/vendê-la ao Pool. O Pool paga ao cliente o valor líquido antecipado em BRLT e passa a registrar essa NF-e como ativo do Pool.

---

### 3.1.1 Premissas de negócio

- A NF-e já deve estar tokenizada no contrato de NF-e.
- A NF-e deve possuir um `invoice_hash` único.
- A NF-e não pode ter sido vendida/cedida anteriormente.
- O vendedor precisa ser o proprietário ou detentor autorizado do token/registro da NF-e.
- O Pool precisa ter caixa disponível suficiente em BRLT para pagar o valor antecipado.
- A taxa da operação deve ser definida antes do registro da venda.
- A operação deve ser idempotente para evitar dupla venda da mesma NF-e.

---

### 3.1.2 Diferença entre tokenizar e vender a nota

A tokenização apenas registra a NF-e on-chain.

```text
NF-e emitida → NF-e tokenizada
```

A venda/cessão é a operação financeira onde o cliente transfere o direito econômico da nota para o Pool e recebe BRLT.

```text
NF-e tokenizada → Cliente vende para o Pool → Pool paga BRLT → Pool registra principal e taxa
```

Portanto, o evento `InvoiceTokenized` não deve necessariamente significar que a nota já entrou no Pool. Ele apenas indica que a nota está disponível para ser usada em uma operação posterior.

---

### 3.1.3 Novo status recomendado para NF-e

O contrato ou backend deve conseguir distinguir os estados da nota.

Estados sugeridos:

```text
TOKENIZED
LISTED_FOR_SALE
SOLD_TO_POOL
SETTLED
DEFAULTED
CANCELLED
```

Descrição:

| Status | Significado |
|---|---|
| `TOKENIZED` | NF-e registrada on-chain, mas ainda não vendida |
| `LISTED_FOR_SALE` | Cliente manifestou intenção de vender a nota |
| `SOLD_TO_POOL` | Nota foi comprada pelo Pool |
| `SETTLED` | Nota foi liquidada/paga |
| `DEFAULTED` | Nota ficou inadimplente |
| `CANCELLED` | Nota foi cancelada/inutilizada |

---

### 3.1.4 Função recomendada no contrato de NF-e

Criar função para permitir que o proprietário liste a NF-e para venda:

```rust
list_invoice_for_sale(
    owner: Address,
    invoice_hash: BytesN<32>,
    face_value: i128,
    requested_advance_amount: i128,
    requested_rate_bps: i128,
    maturity_timestamp: u64
)
```

Responsabilidades:

- [ ] Validar que a NF-e existe/tokenizada.
- [ ] Validar que `owner` é proprietário ou autorizado.
- [ ] Executar `owner.require_auth()`.
- [ ] Validar que a NF-e ainda não foi vendida.
- [ ] Validar `face_value > 0`.
- [ ] Validar `requested_advance_amount > 0`.
- [ ] Validar `requested_advance_amount <= face_value`.
- [ ] Validar `requested_rate_bps` dentro do limite permitido.
- [ ] Atualizar status para `LISTED_FOR_SALE`.
- [ ] Emitir evento `InvoiceListedForSale`.

Evento sugerido:

```text
InvoiceListedForSale {
    invoice_hash,
    owner,
    face_value,
    requested_advance_amount,
    requested_rate_bps,
    maturity_timestamp,
    timestamp
}
```

---

### 3.1.5 Função recomendada no contrato do Pool

Criar função específica para compra/cessão da NF-e:

```rust
buy_tokenized_invoice(
    operator: Address,
    seller: Address,
    invoice_hash: BytesN<32>,
    face_value: i128,
    advance_amount: i128,
    rate_bps: i128,
    maturity_timestamp: u64
)
```

Essa função pode substituir ou encapsular `register_anticipation`, pois representa a operação completa de compra da nota pelo Pool.

Responsabilidades:

- [ ] Validar contrato inicializado.
- [ ] Validar contrato não pausado.
- [ ] Executar `operator.require_auth()`.
- [ ] Validar operador autorizado.
- [ ] Chamar `accrue_interest()`.
- [ ] Validar que `invoice_hash` ainda não foi processado no Pool.
- [ ] Validar que a NF-e está tokenizada e listada para venda.
- [ ] Validar que `seller` é o proprietário ou recebedor autorizado.
- [ ] Validar `face_value > 0`.
- [ ] Validar `advance_amount > 0`.
- [ ] Validar `advance_amount <= face_value`.
- [ ] Validar `rate_bps` dentro do limite permitido.
- [ ] Validar que o Pool possui BRLT suficiente para pagar `advance_amount`.
- [ ] Transferir `advance_amount` de BRLT do Pool para o vendedor.
- [ ] Transferir ou registrar o direito econômico da NF-e para o Pool.
- [ ] Atualizar `total_principal`.
- [ ] Atualizar `average_daily_rate_bps`.
- [ ] Marcar `invoice_hash` como processado.
- [ ] Atualizar status da NF-e para `SOLD_TO_POOL`.
- [ ] Emitir evento `TokenizedInvoicePurchased`.

Evento sugerido:

```text
TokenizedInvoicePurchased {
    invoice_hash,
    seller,
    advance_amount,
    face_value,
    rate_bps,
    maturity_timestamp,
    total_principal,
    average_daily_rate_bps,
    timestamp
}
```

---

### 3.1.6 Ajuste na modelagem do Pool

No fluxo de venda da nota, a entrada no Pool não é apenas um registro contábil. Existe uma saída de caixa.

Antes da compra:

```text
cash_balance = saldo BRLT do Pool
total_principal = principal atual em notas compradas
```

Durante a compra:

```text
cash_balance diminui pelo advance_amount
total_principal aumenta pelo advance_amount ou pelo valor contábil definido da operação
```

Modelo recomendado para esta fase:

```text
total_principal += advance_amount
```

O `face_value` deve ser salvo como dado econômico da nota para liquidação futura, mas o principal investido pelo Pool é o valor efetivamente antecipado.

Observação:

```text
face_value != advance_amount
```

Exemplo:

```text
Valor de face da NF-e: 100.000 BRLT
Valor antecipado ao cliente: 95.000 BRLT
Principal alocado pelo Pool: 95.000 BRLT
Spread/receita esperada: diferença econômica refletida pela taxa e vencimento
```

---

### 3.1.7 Ajuste no fluxo do backend

O backend não deve tratar toda NF-e tokenizada como antecipada automaticamente.

Fluxo correto:

```text
1. NF-e é tokenizada
2. Contrato emite InvoiceTokenized
3. Backend registra status TOKENIZED
4. Cliente solicita venda da nota
5. Backend valida dados comerciais da operação
6. NF-e é listada para venda ou enviada para aprovação
7. Operador aprova compra pelo Pool
8. Backend chama buy_tokenized_invoice no Pool
9. Pool paga BRLT ao cliente
10. Pool registra principal e taxa
11. NF-e muda para SOLD_TO_POOL
12. Backend marca evento como PROCESSED
```

---

### 3.1.8 Novos eventos para o backend escutar

Além de `InvoiceTokenized`, o backend deve considerar:

```text
InvoiceListedForSale
```

```text
TokenizedInvoicePurchased
```

Esses eventos permitem separar claramente:

- criação/tokenização da nota;
- intenção de venda;
- compra efetiva pelo Pool.

---

### 3.1.9 Novos testes obrigatórios

Adicionar testes unitários e E2E para:

- [ ] NF-e tokenizada não altera automaticamente o principal do Pool.
- [ ] Cliente consegue listar NF-e tokenizada para venda.
- [ ] Cliente não consegue listar NF-e que não possui.
- [ ] Cliente não consegue vender NF-e já vendida.
- [ ] Pool não compra NF-e duplicada.
- [ ] Pool não compra se estiver pausado.
- [ ] Pool não compra se não tiver caixa suficiente.
- [ ] Pool transfere BRLT ao vendedor após compra.
- [ ] Pool atualiza `total_principal` após compra.
- [ ] Pool atualiza taxa média ponderada após compra.
- [ ] NF-e muda para `SOLD_TO_POOL`.
- [ ] Evento `TokenizedInvoicePurchased` é emitido.
- [ ] Retry do backend não gera pagamento duplicado.

---


## [Task 4] Backend: Driver de Sincronização (Node.js/TypeScript)

**Diretório alvo:** `apps/api/src/shared/blockchain/` ou novo módulo `apps/api/src/modules/sync-driver/`

**Objetivo:** Atuar como orquestrador off-chain entre o contrato de NF-e e o contrato do Pool.

---

### 4.1 Responsabilidades

- [ ] Escutar eventos `InvoiceTokenized`.
- [ ] Validar se o evento já foi processado off-chain.
- [ ] Persistir status de processamento.
- [ ] Chamar `register_anticipation` no contrato do Pool.
- [ ] Tratar retry com idempotência.
- [ ] Registrar logs de auditoria.
- [ ] Armazenar hash da transação.
- [ ] Armazenar erro em caso de falha.
- [ ] Permitir reprocessamento manual seguro.

---

### 4.2 Estados sugeridos

```text
PENDING
PROCESSING
PROCESSED
FAILED
IGNORED_DUPLICATE
```

---

### 4.3 Tabela sugerida

```sql
CREATE TABLE blockchain_sync_events (
    id VARCHAR(255) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    invoice_hash VARCHAR(100) NULL,
    source_contract VARCHAR(255) NOT NULL,
    target_contract VARCHAR(255) NULL,
    tx_hash VARCHAR(255) NULL,
    status VARCHAR(50) NOT NULL,
    error_message TEXT NULL,
    payload JSON NOT NULL,
    processed_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);
```

---

### 4.4 Fluxo do Sync Driver

```text
1. Listener detecta InvoiceTokenized
2. Backend normaliza invoice_hash
3. Backend verifica se evento já existe no banco
4. Se não existe, cria registro PENDING
5. Worker pega evento PENDING
6. Worker chama register_anticipation no Pool
7. Se sucesso, marca PROCESSED
8. Se falha, marca FAILED com erro
9. Retry pode reexecutar com segurança
10. Contrato do Pool bloqueia duplicidade por invoice_hash
```

---

## [Task 5] Ambiente de Testes & Mocking (Testnet)

**Objetivo:** Criar condições de teste independentes de APIs externas.

---

### 5.1 Dummy Asset Deploy

Criar script:

```text
scripts/deploy-mock-brlt.ts
```

Responsabilidades:

- [ ] Deployar token padrão ou SAC compatível.
- [ ] Simular BRLT.
- [ ] Configurar admin do token.
- [ ] Salvar contract ID em `.env.testnet`.
- [ ] Validar transferência básica.

---

### 5.2 Faucet Privado

Criar script:

```text
scripts/faucet-brlt.ts
```

Responsabilidades:

- [ ] Distribuir BRLT mockado para contas de teste.
- [ ] Receber endereço e valor por parâmetro.
- [ ] Registrar tx hash.
- [ ] Facilitar setup de investidores.

Exemplo:

```bash
npm run faucet:brlt -- --to <ADDRESS> --amount 100000000
```

---

## [Task 6] Testes Unitários dos Contratos

**Objetivo:** Validar segurança, matemática e invariantes antes do E2E.

---

### 6.1 Inicialização

- [ ] Inicializa corretamente.
- [ ] Bloqueia segunda inicialização.
- [ ] Salva admin, operador, BRLT e token de cotas.

---

### 6.2 Depósito

- [ ] Rejeita `amount <= 0`.
- [ ] Exige autenticação do investidor.
- [ ] Bloqueia depósito se pausado.
- [ ] Emite cotas corretamente em Pool vazio.
- [ ] Emite cotas corretamente em Pool valorizado.
- [ ] Chama accrual antes de calcular cotas.

---

### 6.3 Accrual

- [ ] Calcula juros corretamente para 1 dia.
- [ ] Calcula juros corretamente para frações de dia.
- [ ] Não acumula juros se principal é zero.
- [ ] Rejeita timestamp retrocedendo.
- [ ] Atualiza `last_accrual_timestamp`.

---

### 6.4 Antecipação

- [ ] Exige operador autorizado.
- [ ] Rejeita operador inválido.
- [ ] Rejeita `anticipation_amount <= 0`.
- [ ] Rejeita taxa inválida.
- [ ] Atualiza principal.
- [ ] Atualiza taxa média ponderada.
- [ ] Bloqueia NF-e duplicada.
- [ ] Chama accrual antes de atualizar principal/taxa.

---

### 6.5 Pausa

- [ ] Admin consegue pausar.
- [ ] Admin consegue despausar.
- [ ] Usuário comum não consegue pausar.
- [ ] Contrato pausado bloqueia depósito.
- [ ] Contrato pausado bloqueia antecipação.

---

### 6.6 Leitura

- [ ] `get_nav` retorna valor esperado.
- [ ] `get_share_price` retorna `PRICE_SCALE` no Pool vazio.
- [ ] `get_share_price` reflete valorização após accrual.
- [ ] `get_pool_state` retorna estado coerente.

---

## [Task 7] Script de Validação End-to-End (E2E)

**Diretório alvo:** `scripts/test-core-flow.ts`

**Objetivo:** Provar a consistência matemática dos contratos integrados.

---

### 7.1 Fluxo obrigatório

Automatizar o fluxo:

```text
1. Deploy do BRLT mockado
2. Deploy ou configuração do contrato NF-e
3. Deploy do Liquidity Pool
4. Inicialização do Pool
5. Criação/funding de conta investidora
6. Faucet envia BRLT mockado ao investidor
7. Investidor executa deposit
8. Validar cotas emitidas
9. Cliente tokeniza NF-e
10. Capturar evento InvoiceTokenized
11. Validar que a tokenização não altera automaticamente o principal do Pool
12. Cliente lista NF-e tokenizada para venda
13. Capturar evento InvoiceListedForSale
14. Operador aprova compra da nota pelo Pool
15. Backend chama buy_tokenized_invoice no Pool
16. Pool transfere BRLT ao vendedor
17. Pool registra a NF-e como ativo comprado
18. Validar principal atualizado
19. Validar taxa média ponderada
20. Validar status SOLD_TO_POOL
21. Simular passagem de tempo
22. Validar accrual
23. Validar NAV
24. Validar share_price
25. Tentar vender/processar a mesma NF-e novamente
26. Confirmar erro/idempotência
```

---

### 7.2 Resultado esperado

O script deve imprimir algo como:

```text
Pool initialized: OK
Investor funded: OK
Deposit executed: OK
Shares minted: OK
Invoice tokenized: OK
Invoice listed for sale: OK
Tokenized invoice purchased: OK
Seller paid in BRLT: OK
Pool principal updated: OK
Weighted average rate updated: OK
Duplicate invoice sale blocked: OK
Accrual validated: OK
NAV validated: OK
Share price validated: OK
```

---

# 7. Backlog Futuro (Pós-Contratos)

---

## 7.1 Resgate e liquidez

- Implementar `redeem`.
- Definir regra de liquidez disponível.
- Definir fila de resgate, se necessário.
- Definir taxa de saída, se aplicável.
- Definir tratamento de inadimplência de NF-e.
- Diferenciar NAV contábil de caixa disponível.

---

## 7.2 SEP-10

- Fluxo de autenticação on-chain.
- Login baseado em assinatura Stellar.
- Conexão entre identidade off-chain e carteira on-chain.

---

## 7.3 SEP-24

- Integração com rampa PIX.
- Anchor BRLT real.
- Fluxo regulado de deposit/withdraw.
- KYC/KYB, se aplicável.

---

## 7.4 Wallet Service

- Account Abstraction.
- Custódia segura de chaves no backend.
- Rotação de chaves.
- Gestão de permissões.
- Assinatura transacional controlada.

---

## 7.5 Observabilidade e auditoria

- Dashboard de eventos on-chain.
- Monitoramento de falhas de sync.
- Alertas de divergência entre banco e contratos.
- Auditoria de NAV.
- Auditoria de taxa média.
- Auditoria de NF-es processadas.
- Relatórios periódicos de consistência.

---

# 8. Checklist de Pronto para Implementação

Antes de iniciar desenvolvimento, confirmar:

- [ ] Fórmula de NAV aprovada.
- [ ] Fórmula de cotas aprovada.
- [ ] Escalas aprovadas.
- [ ] Taxa diária definida.
- [ ] Regra de arredondamento definida.
- [ ] Payload da NF-e definido.
- [ ] Evento `InvoiceTokenized` definido.
- [ ] Evento `AnticipationRegistered` definido.
- [ ] Estrutura de storage definida.
- [ ] Estratégia de TTL definida.
- [ ] Matriz de permissões definida.
- [ ] Contrato de NF-e revisado.
- [ ] Estratégia de idempotência definida.
- [ ] Plano de testes unitários definido.
- [ ] Plano E2E definido.

---

# 9. Resumo Executivo

A Fase 2 deve priorizar segurança matemática, idempotência e rastreabilidade.

A principal mudança em relação ao plano inicial é substituir o modelo em que o backend envia diretamente:

```text
new_principal, new_rate
```

por um modelo incremental e auditável:

```text
register_anticipation(invoice_hash, anticipation_amount, rate_bps, maturity_timestamp)
```

ou, no caso mais completo em que a NF-e já está tokenizada e o cliente decide vender a nota ao Pool:

```text
buy_tokenized_invoice(invoice_hash, seller, face_value, advance_amount, rate_bps, maturity_timestamp)
```

Assim, o contrato do Pool mantém controle econômico próprio, evita sobrescrita perigosa de estado e reduz o risco de inconsistência.

Também foi adicionada uma etapa obrigatória de especificação matemática antes da implementação, porque o ponto mais sensível do sistema não é apenas o deploy do contrato, mas sim garantir que:

```text
depósitos, cotas, NAV, juros e antecipações permaneçam matematicamente consistentes ao longo do tempo.
```