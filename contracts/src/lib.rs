// Contratos Soroban compilam para WASM — sem acesso a filesystem, threads ou stdlib do Rust
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, BytesN, Env, String, Symbol,
};

// #[contracttype] ensina o Soroban a serializar/deserializar esse tipo para armazenamento on-chain
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum NfeStatus {
    Active,
    Settled,
    Cancelled,
}

impl NfeStatus {
    pub fn to_symbol(&self, env: &Env) -> Symbol {
        match self {
            NfeStatus::Active => Symbol::new(env, "Active"),
            NfeStatus::Settled => Symbol::new(env, "Settled"),
            NfeStatus::Cancelled => Symbol::new(env, "Cancelled"),
        }
    }
}

// Estrutura principal armazenada on-chain para cada NFe tokenizada
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NfeData {
    pub key: String,          // UUID do receivable no banco de dados off-chain
    pub value: i128,          // valor em centavos (i128 suporta números grandes sem overflow)
    pub due_date: u64,        // timestamp Unix em segundos do vencimento
    pub xml_hash: BytesN<32>, // SHA-256 do XML original — prova que o documento não foi alterado
    pub owner: Address,       // carteira atual do dono (G... clássica ou C... smart wallet)
    pub status: Symbol,       // "Active" | "Settled" | "Cancelled"
}

// DataKey é o índice de armazenamento — cada NFe vive em Nfe("uuid") no ledger
#[contracttype]
pub enum DataKey {
    Nfe(String),
}

// Payloads dos eventos emitidos — indexadores externos como Horizon os capturam
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenizeEventData {
    pub owner: Address,
    pub value: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferEventData {
    pub old_owner: Address,
    pub new_owner: Address,
}

// Erros tipados retornam códigos numéricos na blockchain (Error #1, #2, #3)
// Isso permite que o frontend interprete o erro sem depender de strings
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyExists = 1, // tentativa de tokenizar NFe com key já existente
    NotFound = 2,      // NFe não encontrada no storage
    NotActive = 3,     // operação requer status Active (transfer/settle em NFe já liquidada)
}

// TTL (Time To Live) — dados on-chain expiram se não renovados
// Cada ledger ≈ 5 segundos → 17280 ledgers = 1 dia
// Threshold = quando falta menos de 30 dias, estende automaticamente + 30 dias
const DAY_IN_LEDGERS: u32 = 17280;
const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const TTL_EXTEND: u32 = 30 * DAY_IN_LEDGERS;

// #[contract] marca a struct como ponto de entrada do contrato Soroban
#[contract]
pub struct CredBridgeContract;

// #[contractimpl] expõe os métodos públicos como funções invocáveis on-chain
#[contractimpl]
impl CredBridgeContract {
    // Registra uma NFe on-chain pela primeira vez
    // Chamado pela plataforma quando o PME ativa o receivable
    pub fn tokenize_nfe(
        env: Env,
        key: String,          // UUID do receivable
        value: i128,          // valor em centavos
        due_date: u64,        // Unix timestamp
        xml_hash: BytesN<32>, // SHA-256 do XML
        owner: Address,       // carteira do PME que detém a NFe
        platform_auth: Address, // carteira da plataforma — controla autorização na API
    ) {
        // Plataforma custodial assina a transação e garante que só PMEs autenticados tokenizam
        platform_auth.require_auth();

        let storage_key = DataKey::Nfe(key.clone());

        // Impede tokenização duplicada da mesma NFe
        if env.storage().persistent().has(&storage_key) {
            panic_with_error!(&env, Error::AlreadyExists);
        }

        let nfe_data = NfeData {
            key: key.clone(),
            value,
            due_date,
            xml_hash,
            owner: owner.clone(),
            status: Symbol::new(&env, "Active"),
        };

        // persistent() = dado sobrevive entre transações, mas expira se TTL não for renovado
        // (alternativas: instance() e temporary() têm ciclos de vida diferentes)
        env.storage().persistent().set(&storage_key, &nfe_data);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        // Eventos são indexados pelo Horizon — o frontend usa para exibir histórico
        env.events().publish(
            (Symbol::new(&env, "tokenize_nfe"), key.clone()),
            value,
        );
    }

    // Leitura pública — qualquer um pode consultar sem assinar transação
    // O stellar CLI avisa "read-only" porque não escreve nada no ledger
    pub fn get_nfe(env: Env, key: String) -> NfeData {
        let storage_key = DataKey::Nfe(key.clone());
        let nfe_data: NfeData = env
            .storage()
            .persistent()
            .get(&storage_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        // Renova TTL a cada leitura — NFes consultadas nunca expiram
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        nfe_data
    }

    // Transfere propriedade da NFe para outro endereço (ex: cessão para a CredBridge)
    // Só a plataforma pode transferir — modelo custodial controla via API
    pub fn transfer_ownership(env: Env, key: String, new_owner: Address, platform_auth: Address) {
        platform_auth.require_auth();

        let storage_key = DataKey::Nfe(key.clone());
        let mut nfe_data: NfeData = env
            .storage()
            .persistent()
            .get(&storage_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        if nfe_data.status != Symbol::new(&env, "Active") {
            panic_with_error!(&env, Error::NotActive);
        }

        let old_owner = nfe_data.owner.clone();
        nfe_data.owner = new_owner.clone();

        env.storage().persistent().set(&storage_key, &nfe_data);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (Symbol::new(&env, "transfer_ownership"), key.clone()),
            TransferEventData {
                old_owner,
                new_owner,
            },
        );
    }

    // Marca NFe como liquidada — chamado pela plataforma após o pagamento ser confirmado
    // platform_auth é o endereço da plataforma passado como parâmetro (não hardcoded)
    // isso permite trocar a conta da plataforma sem redesployar o contrato
    pub fn settle_nfe(env: Env, key: String, platform_auth: Address) {
        // Só a plataforma pode liquidar — ela passa seu próprio endereço e assina
        platform_auth.require_auth();

        let storage_key = DataKey::Nfe(key.clone());
        let mut nfe_data: NfeData = env
            .storage()
            .persistent()
            .get(&storage_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        if nfe_data.status != Symbol::new(&env, "Active") {
            panic_with_error!(&env, Error::NotActive);
        }

        nfe_data.status = Symbol::new(&env, "Settled");

        env.storage().persistent().set(&storage_key, &nfe_data);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        // Emite evento com o owner final — útil para o investidor confirmar o recebimento
        env.events().publish(
            (Symbol::new(&env, "settle_nfe"), key.clone()),
            nfe_data.owner,
        );
    }
}

mod test;
