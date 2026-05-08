# Product Marketing Context — CredBridge

*Last updated: 2026-05-07*

---

## Product Overview

**One-liner:**
Plataforma que conecta PMEs brasileiras que precisam antecipar recebíveis a investidores que buscam rentabilidade, com liquidação e trilha de auditoria on-chain via Stellar.

**What it does:**
CredBridge permite que micro e pequenas empresas (PMEs) submetam notas fiscais eletrônicas (NF-e) e recebam o valor antecipado em até 1 dia útil. Do outro lado, investidores pessoas físicas e jurídicas financiam essas operações e obtêm retorno acima do CDI em prazos curtos (30-90 dias). Todo o fluxo — cessão, liquidação, auditoria — é registrado on-chain via Stellar, garantindo rastreabilidade e eliminando risco de dupla cessão.

**Product category:**
Fintech de antecipação de recebíveis / marketplace de crédito B2B / plataforma de receivables financing

**Product type:** Marketplace SaaS B2B2C (dois lados: PME cedente + Investidor cessionário)

**Business model:**
- Taxa de antecipação cobrada da PME (% sobre o valor face da NF, proporcional ao prazo)
- Revenue share com Parceiros que integram e originam operações
- Estágio MVP: sem FIDC próprio — liquidação via PIX/TED; blockchain como camada de prova, não de custódia

---

## Target Audience

### Lado PME (cedente)

**Target companies:** ME e EPP brasileiras, Simples Nacional, faturamento R$ 300k–4M/ano, emitem NF-e em operações B2B, clientes CNPJ com prazo de pagamento 21-90 dias

**Decision-makers:** Sócio-proprietário, gestor financeiro (na maioria das PMEs é a mesma pessoa)

**Primary use case:** Converter NF-e emitida (mas ainda não vencida) em caixa imediato para cobrir folha, diesel, estoque ou fornecedor

**Jobs to be done:**
- Pagar salários/fornecedores sem depender do prazo do cliente
- Aceitar contratos maiores sem precisar ter capital de giro próprio para sustentar o prazo
- Ter trilha de auditoria que prove a cessão e proteja contra cobrança dupla

**Setores prioritários para MVP:**
- Prestadoras de serviços de TI (NF-e serviço, prazo 30-60 dias)
- Distribuidoras de alimentos/produtos (NF-e venda, prazo 21-45 dias)
- Transportadoras pequenas (CT-e + NF-e serviço, prazo 30-60 dias)
- Construtoras/empreiteiras ME/EPP (NF-e serviço, prazo 30-90 dias)

### Lado Investidor (cessionário)

**Target profile:** Pessoa física investidor acreditado ou não (CPF), ou pessoa jurídica (gestora pequena, family office), que busca rentabilidade CDI+ em prazos curtos com ativo real como lastro

**Decision-makers:** O próprio investidor (PF) ou gestor de portfólio (PJ)

**Primary use case:** Alocar capital em recebíveis de PMEs com sacado CNPJ de boa qualidade, prazo 30-90 dias, retorno acima do CDI (CDI + 3-8% ao ano equivalente), com trilha on-chain para garantia

**Jobs to be done:**
- Diversificar de renda fixa tradicional (CDB, Tesouro) com ativo de prazo curto
- Ter transparência e rastreabilidade do ativo comprado (saber exatamente qual NF, qual sacado, qual vencimento)
- Acesso simples via plataforma digital, sem precisar montar FIDC próprio

### Perfil Parceiro

**Target:** Fintechs de ERP (Bling, Omie, Nuvem Fiscal), contadores, plataformas de gestão financeira para PME, associações comerciais — que integram CredBridge como feature de antecipação para sua base

---

## Personas Detalhadas (PME)

| Persona | Setor | Porte | Cares about | Challenge | Value we promise |
|---------|-------|-------|-------------|-----------|------------------|
| Marcelo (TI) | Serviços TI | ME 3-8 func. | Pagar PJs e CLT no prazo | Gap salário (dia 5) vs recebimento NF-e (30-60 dias) | Antecipa NF-e em 1 dia útil, taxa transparente, 100% digital |
| Sandra (Distribuição) | Distribuidora alimentos | EPP 10-25 func. | Comprar estoque à vista p/ desconto do fornecedor | Vende a prazo (21-45 dias), paga fornecedor em 7 dias | Aceita lote de notas pequenas, processo batch, sem agência |
| Roberto (Transporte) | Transportadora | ME 4-10 func. | Diesel e manutenção não esperam 60 dias | CT-e não é aceito por factorings tradicionais | Aceita CT-e + NF-e serviço, sem garantia pessoal |

> Personas completas com dores, vocabulário, gatilhos e alternativas: `.agents/personas-pme-brasil.md`

---

## Problems & Pain Points

**Core problem (PME):**
PMEs brasileiras emitem NF-e mas recebem 30-90 dias depois. Enquanto isso, custos operacionais (folha, diesel, estoque, fornecedor) são imediatos. O gap de caixa é crônico.

**Por que as alternativas atuais falham:**
- **Bancos (Itaú, Caixa, BB PJ):** exigem relacionamento de 12+ meses, garantia real, análise de 4-8 semanas; limite insuficiente para PME nova
- **Factorings tradicionais:** taxa obscura (ad valorem + taxa de serviço não discriminada), processo presencial, não aceitam CT-e, exigem duplicata física, mínimo de operação alto
- **Fintechs grandes (Asaas, Omie Antecipa):** processo lento de KYC, negativa sem explicação, não aceitam NF-e de serviço de todos os setores
- **Cheque especial PJ:** 8-15% ao mês — inviável para margem de 8-20%

**O que custa ao PME:**
- Perde contratos por não ter caixa para sustentar o prazo exigido pelo cliente grande
- Paga taxa de 4-8% ao mês em cheque especial quando o caixa estoura
- Constrangimento de pedir adiantamento para o cliente ou prazo para o fornecedor
- Risco de ter a mesma NF cedida duas vezes (dupla cessão — problema real no mercado)

**Tensão emocional:**
- *"Trabalho muito e não consigo pagar minhas contas em dia"*
- *"Minha empresa cresce mas meu caixa some"*
- *"Tenho medo de aceitar contrato grande e não conseguir entregar"*

**Core problem (Investidor):**
Investidor PF que quer CDI+ em prazo curto não tem acesso fácil a recebíveis de PMEs sem montar FIDC ou entrar em plataformas que não têm transparência sobre o ativo subjacente.

---

## Competitive Landscape

**Diretos** (mesmo problema, mesma solução):
- **Adiante Recebíveis** — foco em NF-e, mas processo lento e reclamações de KYC no Reclame Aqui
- **Monkey.tech** — marketplace de recebíveis, mais voltado para empresas médias
- **Nexoos** — P2P lending, não específico de recebíveis/NF-e
- **Capital Empreendedor** — agregador, não plataforma própria

**Secundários** (mesmo problema, solução diferente):
- **Factorings regionais presenciais** — funcionam mas lentas, opacas, sem digital
- **Cheque especial PJ** — caro demais (8-15%/mês)
- **Antecipação bancária PJ** — Itaú, Bradesco, Caixa — lenta, burocrática, limite baixo

**Indiretos** (abordagem conflitante):
- **Fazer nada / pedir prazo para fornecedor** — corrói relacionamento e desconto
- **Sócio coloca capital próprio** — mistura PF e PJ, não escala

**Como todos falham:**
- Taxa não é transparente antes de fechar
- Processo não é 100% digital
- Não aceitam CT-e ou NF-e de serviço de todos os setores
- Sem prova auditável de cessão → risco de dupla cessão
- Montante mínimo exclui PMEs com notas pequenas

---

## Differentiation

**Key differentiators:**
1. **Trilha on-chain via Stellar** — cada cessão, hash de documento e liquidação registrados; prova auditável que elimina risco de dupla cessão
2. **Aceita CT-e + NF-e de serviço** — não só duplicata de venda; abre setores excluídos (transporte, TI, construção)
3. **Simulador de taxa transparente antes do commit** — usuário vê exatamente quanto desconta e quanto recebe antes de assinar
4. **Upload em lote** — Sandra com 40 notas de R$ 800 consegue operar; factorings tradicionais ignoram esse perfil
5. **100% digital, sem garantia pessoal** — sem cheque caução, sem ir à agência, KYC digital

**Por que é melhor:**
Factoring resolveu o problema dos anos 90 para empresas médias. CredBridge resolve para PMEs digitais de hoje — processo mobile-first, transparência de taxa, rastreabilidade blockchain, sem exclusão por volume de nota pequeno.

**Por que clientes escolhem CredBridge:**
- Primeira plataforma que aceitou o CT-e deles
- Sabem exatamente a taxa antes de confirmar
- Confiam que a NF não vai ser cedida duas vezes (prova on-chain)

---

## Objections

| Objeção | Resposta |
|---------|----------|
| "A taxa vai ser absurda igual a factoring de bairro" | Simulador mostra taxa antes de confirmar. Sem cobranças ocultas (sem ad valorem separado). |
| "Vão pedir garantia pessoal ou cheque caução" | Zero garantia pessoal. O risco é do sacado (seu cliente CNPJ), não de você. |
| "Se meu cliente não pagar eu fico com o problema?" | Operação com direito de regresso — mesmas condições do mercado; explicado claramente no onboarding. |
| "Mais um app que pede KYC e some" | KYC digital em < 10 min, aprovação em até 24h, SLA comunicado no dashboard. |
| "Não aceita CT-e" | CredBridge aceita CT-e e NF-e de serviço — informe o documento, nós analisamos. |
| "Minhas notas são muito pequenas" | Upload em lote. Sem valor mínimo por nota individual. |

**Anti-persona (PME):**
- Empresa que emite NF-e só para PF (consumidor final) — não há sacado CNPJ para análise de risco
- MEI sem histórico de faturamento (< 6 meses de operação)
- Empresa com inadimplência fiscal ativa (CNPJ irregular)

**Anti-persona (Investidor):**
- Investidor conservador que não aceita risco de crédito de PME
- Quem espera liquidez diária (recebíveis têm prazo fixo de 30-90 dias)

---

## Switching Dynamics

**Push (o que empurra o PME para longe das alternativas):**
- Taxa de cheque especial PJ chegando a 15%/mês
- Factoring local pediu 3 documentos em papel e demorou 5 dias úteis
- Fintech grande negou sem dar motivo
- Cliente estratégico exigiu prazo de 60 dias para manter contrato

**Pull (o que atrai para o CredBridge):**
- Simulador de taxa transparente antes de qualquer compromisso
- "Aceita CT-e" — diferencial único que nenhum outro oferece
- Registro on-chain visível: "minha NF está protegida"
- Processo 100% digital, aprovação em 24h

**Habit (o que mantém o PME no status quo):**
- Relacionamento antigo com factoring de bairro ("o Seu João me conhece")
- Medo de KYC digital ("vão pedir minha vida toda")
- Costumou a pedir adiantamento para o cliente (constrangedor mas funciona)

**Anxiety (o que preocupa ao mudar):**
- "E se meu cliente souber que eu antecipei?" (notificação de cessão)
- "E se a plataforma fechar, o que acontece com minha NF cedida?"
- "Não entendo de blockchain — vou saber o que está acontecendo?"

---

## Customer Language

**Como descrevem o problema:**
- *"tô com o caixa no zero"*
- *"minha nota tá no prazo mas o dinheiro não cai"*
- *"não aguento mais pagar o limite do banco"*
- *"meu fornecedor quer à vista mas meu cliente paga com 45 dias"*
- *"diesel não espera 60 dias"*
- *"minha margem é pequena — qualquer taxa come tudo"*
- *"caminhão parado é prejuízo direto"*
- *"o banco não empresta pra transportadora pequena"*

**Como descrevem a solução ideal:**
- *"queria antecipar a NF sem complicar"*
- *"quero saber a taxa antes de assinar"*
- *"manda o dinheiro hoje, sem ir à agência"*
- *"aceita lote de nota pequena"*

**Palavras a usar:**
- antecipação, recebível, NF-e, nota fiscal, cessão, liquidação, trilha de auditoria, prazo, taxa transparente, capital de giro, sacado, cessionário, on-chain

**Palavras a evitar:**
- tokenização (assusta PME sem contexto crypto)
- blockchain (falar como "trilha auditável" para PME; "on-chain" para investidor)
- moonshot, 🚀, DeFi, Web3 (não é o posicionamento)
- "fomento mercantil" (burocrático, geração anterior)
- "securitização" (complexo demais para PME)

**Glossário interno:**
| Termo | Significado |
|-------|-------------|
| PME / Cedente | Empresa que submete a NF-e para antecipar |
| Investidor / Cessionário | Quem compra o direito creditório |
| Sacado | Cliente da PME (CNPJ que deve pagar a NF) |
| Antecipação | Receber agora o valor da NF menos o desconto (taxa) |
| Trilha on-chain | Registro imutável no Stellar de cada evento da operação |
| CT-e | Conhecimento de Transporte Eletrônico (documento fiscal de transporte) |
| Dupla cessão | Fraude onde a mesma NF é cedida para dois cessionários — o CredBridge elimina via on-chain |

---

## Brand Voice

**Tone:** Direto, técnico, sem entusiasmo de crypto. Linguagem financeira real.

**Style:** Profissional mas acessível. Nunca condescendente com o PME. Números em destaque, sempre BRL com locale pt-BR (`R$ 1.234,56`). "On-chain" e termos técnicos Stellar em inglês + mono.

**Personality:** Confiável, transparente, eficiente. Fintechfinanceira séria com infraestrutura blockchain — não startup de crypto.

**Nunca usar:** "moonshot", "🚀", "to the moon", jargão DeFi, visual de matrix/neon excessivo

---

## Proof Points

*(Produto em MVP — dados reais a adicionar após primeiras operações)*

**Métricas a destacar quando disponíveis:**
- Tempo médio de aprovação (meta: < 24h)
- Tempo para liquidação (meta: D+1)
- Número de operações registradas on-chain
- Volume total antecipado (R$)
- Taxa média comparada ao mercado

**Value themes:**

| Tema | Prova |
|------|-------|
| Transparência de taxa | Simulador antes do commit — veja o desconto exato antes de confirmar |
| Velocidade | NF-e submetida hoje → caixa amanhã |
| Rastreabilidade | Hash de cada operação consultável no Stellar Explorer |
| Inclusão | Aceita CT-e, NF-e de serviço, notas de qualquer valor |

---

## Goals

**Business goal:** Validar o modelo de marketplace de recebíveis com PMEs brasileiras, atingir as primeiras 50 operações no MVP para provar unit economics

**Conversion action (PME):** Completar cadastro + submeter primeira NF-e para análise

**Conversion action (Investidor):** Completar cadastro + fazer primeiro aporte em proposta de recebível

**Current metrics:** MVP em desenvolvimento (dados reais indisponíveis)
