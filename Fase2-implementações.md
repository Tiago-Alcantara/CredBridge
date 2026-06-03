# 🛠️ Plano de Desenvolvimento: CredBridge - Foco em Contratos (Fase 2)

## 📌 Visão Geral
Este roteiro prioriza a finalização e a validação da arquitetura de Smart Contracts (Soroban) e os gatilhos locais no Node.js. A integração com rampos de terceiros (SEP-24/Anchor) foi movida para o backlog pós-MVP.

---

## [Task 1] Smart Contract: Liquidity Pool (Rust/Soroban)
**Objetivo:** Implementar o cofre de investimentos, cálculo de NAV e emissão de cotas.

- [ ] **Configuração do Ativo:** Permitir que o contrato receba o Address de um token externo (o seu BRLT de testes) no método de inicialização (`initialize`).
- [ ] **Lógica de Juros (Accrual):** Desenvolver a função interna `accrue_interest()`. Ela deve:
    - Calcular o tempo decorrido: `tempo = env.ledger().timestamp() - last_update_timestamp`.
    - Calcular o juro pro-rata acumulado no período baseado no `total_invested_principal` e na `average_daily_rate_bps`.
    - Atualizar o saldo virtual do pool.
- [ ] **Mecanismo de Depósito (Mint):** Na função `deposit(investor, amount)`:
    - Chamar `accrue_interest()` primeiro.
    - Transferir `amount` de BRLT do investidor para o contrato.
    - Calcular a quantidade de cotas: `Cotas = Valor_Depositado / Preço_Atual_Cota`.
    - Emitir (mint) os tokens de cota para o investidor.
- [ ] **Endpoint de Trigger:** Criar `update_pool_after_anticipation(new_principal, new_rate)` protegido por `admin.require_auth()`.

---

## [Task 2] Backend: Driver de Sincronização (Node.js)
**Objetivo:** Atuar como o cérebro matemático off-chain que alimenta o Pool.

- [ ] **Módulo Matemático:** Criar o script em TypeScript com a fórmula de média ponderada contínua:
  `Nova_Taxa = ((Principal_Atual * Taxa_Atual) + (Valor_Nota * Taxa_Nota)) / (Principal_Atual + Valor_Nota)`.
- [ ] **Script de Acionamento:** Desenvolver a função que lê o sucesso da tokenização do contrato de NF-e (que você já tem), faz o cálculo matemático e chama a função `update_pool_after_anticipation` no novo contrato de Pool.

---

## [Task 3] Ambiente de Testes & Mocking (Testnet)
**Objetivo:** Criar as condições para testar o fluxo sem depender de APIs externas.

- [ ] **Dummy Asset Deploy:** Criar um script para dar deploy em um token padrão (Classic Asset ou SAC) na Testnet para fingir que é o BRLT.
- [ ] **Faucet Privado:** Criar uma função no Node.js para distribuir esse "BRLT falso" para as contas de teste dos investidores.

---

## [Task 4] Script de Validação End-to-End (E2E)
**Objetivo:** Provar a consistência matemática dos contratos integrados.

- [ ] **Automação do Fluxo:** Criar um script único `test-core-flow.ts` que executa:
    1. Inicializa o Pool apontando para o seu Dummy BRLT.
    2. Dá saldo de 10.000 BRLT para o Investidor de teste.
    3. Investidor chama `deposit` de 5.000 BRLT (Contrato deve emitir 5.000 cotas preço 1.0).
    4. Simula a tokenização de uma NF-e de 2.000 BRLT a 5% de taxa no seu contrato existente.
    5. Dispara o trigger do backend atualizando o Pool para o novo Principal e Taxa Média.
    6. Força a passagem de tempo ou simula blocos e chama `get_price()` no Pool para validar se a cota está subindo conforme o esperado.

---

## 📋 Backlog Futuro (Pós-Contratos)
- [ ] Integração com o fluxo de autenticação SEP-10.
- [ ] Integração com os endpoints interativos do SEP-24 (Rampa PIX).