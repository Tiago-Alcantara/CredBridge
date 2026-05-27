// Contratos Soroban compilam para WASM — sem acesso a filesystem, threads ou stdlib do Rust
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, BytesN, Env, String, Symbol,
};
use stellar_macros::default_impl;
use stellar_tokens::non_fungible::{burnable::NonFungibleBurnable, Base, NonFungibleToken};

// ===========================================================================
// Status — covers the full lifecycle of an NF-e
// ===========================================================================
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum NfeStatus {
    Active,        // Tokenized, not yet listed or sold
    ListedForSale, // Owner wants to sell to the Pool
    SoldToPool,    // Purchased by the Pool
    Settled,       // Payment received — liquidated
    Defaulted,     // Debtor failed to pay
    Cancelled,     // Invoice cancelled/voided
}

impl NfeStatus {
    pub fn to_symbol(&self, env: &Env) -> Symbol {
        match self {
            NfeStatus::Active => Symbol::new(env, "Active"),
            NfeStatus::ListedForSale => Symbol::new(env, "ListedForSale"),
            NfeStatus::SoldToPool => Symbol::new(env, "SoldToPool"),
            NfeStatus::Settled => Symbol::new(env, "Settled"),
            NfeStatus::Defaulted => Symbol::new(env, "Defaulted"),
            NfeStatus::Cancelled => Symbol::new(env, "Cancelled"),
        }
    }
}

// ===========================================================================
// Data structures
// ===========================================================================

// Estrutura principal armazenada on-chain para cada NFe tokenizada
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NfeData {
    pub key: String,           // UUID do receivable no banco de dados off-chain
    pub token_id: u32,         // ID do NFT correspondente on-chain (novo)
    pub value: i128,           // valor em centavos
    pub due_date: u64,         // timestamp Unix em segundos do vencimento
    pub xml_hash: BytesN<32>,  // SHA-256 do XML original — prova que o documento não foi alterado
    pub owner: Address,        // carteira atual do dono
    pub status: Symbol,        // "Active" | "ListedForSale" | "SoldToPool" | "Settled" | "Defaulted" | "Cancelled"

    // Phase 2 fields (for invoice sale flow)
    pub invoice_hash: BytesN<32>, // SHA-256(access_key) — unique identifier for Pool idempotency
    pub rate_bps: i128,           // Requested daily rate in basis points (set when listed)
    pub advance_amount: i128,     // Requested advance amount (set when listed)
}

// Sale listing data stored separately for auditability
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SaleListingData {
    pub owner: Address,
    pub face_value: i128,
    pub requested_advance_amount: i128,
    pub requested_rate_bps: i128,
    pub maturity_timestamp: u64,
    pub listed_at: u64,
}

// DataKey é o índice de armazenamento
#[contracttype]
pub enum DataKey {
    Nfe(String),
    SaleListing(String),
    Platform,               // Configuração do endereço admin da plataforma (novo)
    TokenToNfe(u32),        // ID sequencial do NFT -> UUID da NF-e (novo)
    XmlHashToToken(BytesN<32>), // SHA-256 do XML -> ID do NFT para idempotência física (novo)
}

// ===========================================================================
// Event payloads
// ===========================================================================
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenizeEventData {
    pub owner: Address,
    pub value: i128,
    pub invoice_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferEventData {
    pub old_owner: Address,
    pub new_owner: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvoiceListedForSaleEvent {
    pub invoice_hash: BytesN<32>,
    pub owner: Address,
    pub face_value: i128,
    pub requested_advance_amount: i128,
    pub requested_rate_bps: i128,
    pub maturity_timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvoiceSoldToPoolEvent {
    pub invoice_hash: BytesN<32>,
    pub owner: Address,
    pub value: i128,
}

// ===========================================================================
// Errors
// ===========================================================================
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyExists = 1,    // tentativa de tokenizar NFe com key/hash já existente
    NotFound = 2,         // NFe não encontrada no storage
    NotActive = 3,        // operação requer status Active
    AlreadyListed = 4,    // NF-e já está listada para venda
    AlreadySold = 5,      // NF-e já foi vendida ao Pool
    InvalidStatus = 6,    // Status incompatível com a operação
    InvalidAmount = 7,    // Valor inválido
    Unauthorized = 8,     // Caller não é o owner ou platform
}

// ===========================================================================
// TTL constants
// ===========================================================================
const DAY_IN_LEDGERS: u32 = 17280;
const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const TTL_EXTEND: u32 = 30 * DAY_IN_LEDGERS;

// ===========================================================================
// Contract
// ===========================================================================
#[contract]
pub struct CredBridgeContract;

#[contractimpl]
impl CredBridgeContract {
    // -----------------------------------------------------------------------
    // Constructor — sets metadata and platform key
    // -----------------------------------------------------------------------
    pub fn __constructor(
        env: Env,
        uri: String,
        name: String,
        symbol: String,
        platform: Address,
    ) {
        env.storage().instance().set(&DataKey::Platform, &platform);
        Base::set_metadata(&env, uri, name, symbol);
    }

    // -----------------------------------------------------------------------
    // Tokenize — registers an NF-e on-chain and mints its NFT
    // -----------------------------------------------------------------------
    pub fn tokenize_nfe(
        env: Env,
        key: String,
        value: i128,
        due_date: u64,
        xml_hash: BytesN<32>,
        owner: Address,
        platform_auth: Address,
    ) {
        // Validação da Plataforma
        let platform: Address = env
            .storage()
            .instance()
            .get(&DataKey::Platform)
            .unwrap_or_else(|| panic_with_error!(&env, Error::Unauthorized));
        platform_auth.require_auth();
        if platform_auth != platform {
            panic_with_error!(&env, Error::Unauthorized);
        }

        // Validação de idempotência por XML Hash
        let xml_key = DataKey::XmlHashToToken(xml_hash.clone());
        if env.storage().persistent().has(&xml_key) {
            panic_with_error!(&env, Error::AlreadyExists);
        }

        let storage_key = DataKey::Nfe(key.clone());
        if env.storage().persistent().has(&storage_key) {
            panic_with_error!(&env, Error::AlreadyExists);
        }

        // Cunhar NFT sequencial para o proprietário original (PME)
        let token_id = Base::sequential_mint(&env, &owner);

        let invoice_hash = xml_hash.clone();

        let nfe_data = NfeData {
            key: key.clone(),
            token_id,
            value,
            due_date,
            xml_hash,
            owner: owner.clone(),
            status: Symbol::new(&env, "Active"),
            invoice_hash: invoice_hash.clone(),
            rate_bps: 0,
            advance_amount: 0,
        };

        // Salvar dados da NF-e
        env.storage().persistent().set(&storage_key, &nfe_data);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        // Mapear token_id -> key (lookup reverso)
        let token_key = DataKey::TokenToNfe(token_id);
        env.storage().persistent().set(&token_key, &key);
        env.storage()
            .persistent()
            .extend_ttl(&token_key, TTL_THRESHOLD, TTL_EXTEND);

        // Salvar hash do XML mapeado para o ID
        env.storage().persistent().set(&xml_key, &token_id);
        env.storage()
            .persistent()
            .extend_ttl(&xml_key, TTL_THRESHOLD, TTL_EXTEND);

        // Emitir evento de tokenização
        env.events().publish(
            (Symbol::new(&env, "InvoiceTokenized"), key.clone()),
            TokenizeEventData {
                owner,
                value,
                invoice_hash,
            },
        );
    }

    // -----------------------------------------------------------------------
    // Read — public query, renews TTL on each read
    // -----------------------------------------------------------------------
    pub fn get_nfe(env: Env, key: String) -> NfeData {
        let storage_key = DataKey::Nfe(key.clone());
        let nfe_data: NfeData = env
            .storage()
            .persistent()
            .get(&storage_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        nfe_data
    }

    // -----------------------------------------------------------------------
    // Get NF-e by Token ID — lookup reverso
    // -----------------------------------------------------------------------
    pub fn get_nfe_by_token_id(env: Env, token_id: u32) -> NfeData {
        let token_key = DataKey::TokenToNfe(token_id);
        let key: String = env
            .storage()
            .persistent()
            .get(&token_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        Self::get_nfe(env, key)
    }

    // -----------------------------------------------------------------------
    // List for sale — owner declares intent to sell to the Pool
    // -----------------------------------------------------------------------
    pub fn list_invoice_for_sale(
        env: Env,
        owner: Address,
        key: String,
        face_value: i128,
        requested_advance_amount: i128,
        requested_rate_bps: i128,
        maturity_timestamp: u64,
    ) {
        owner.require_auth();

        let storage_key = DataKey::Nfe(key.clone());
        let mut nfe_data: NfeData = env
            .storage()
            .persistent()
            .get(&storage_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        // Validate owner
        if nfe_data.owner != owner {
            panic_with_error!(&env, Error::Unauthorized);
        }

        // Must be Active
        if nfe_data.status != Symbol::new(&env, "Active") {
            panic_with_error!(&env, Error::InvalidStatus);
        }

        // Validate amounts
        if face_value <= 0 || requested_advance_amount <= 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if requested_advance_amount > face_value {
            panic_with_error!(&env, Error::InvalidAmount);
        }

        // Update NF-e status
        nfe_data.status = Symbol::new(&env, "ListedForSale");
        nfe_data.rate_bps = requested_rate_bps;
        nfe_data.advance_amount = requested_advance_amount;

        env.storage().persistent().set(&storage_key, &nfe_data);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        // Store sale listing data for auditability
        let listing_key = DataKey::SaleListing(key.clone());
        let listing = SaleListingData {
            owner: owner.clone(),
            face_value,
            requested_advance_amount,
            requested_rate_bps,
            maturity_timestamp,
            listed_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&listing_key, &listing);
        env.storage()
            .persistent()
            .extend_ttl(&listing_key, TTL_THRESHOLD, TTL_EXTEND);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "InvoiceListedForSale"), key),
            InvoiceListedForSaleEvent {
                invoice_hash: nfe_data.invoice_hash,
                owner,
                face_value,
                requested_advance_amount,
                requested_rate_bps,
                maturity_timestamp,
            },
        );
    }

    // -----------------------------------------------------------------------
    // Mark as sold — called by platform after Pool purchase is confirmed
    // -----------------------------------------------------------------------
    pub fn mark_as_sold(env: Env, key: String, platform_auth: Address) {
        let platform: Address = env
            .storage()
            .instance()
            .get(&DataKey::Platform)
            .unwrap_or_else(|| panic_with_error!(&env, Error::Unauthorized));
        platform_auth.require_auth();
        if platform_auth != platform {
            panic_with_error!(&env, Error::Unauthorized);
        }

        let storage_key = DataKey::Nfe(key.clone());
        let mut nfe_data: NfeData = env
            .storage()
            .persistent()
            .get(&storage_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        // Must be ListedForSale
        if nfe_data.status != Symbol::new(&env, "ListedForSale") {
            panic_with_error!(&env, Error::InvalidStatus);
        }

        nfe_data.status = Symbol::new(&env, "SoldToPool");

        env.storage().persistent().set(&storage_key, &nfe_data);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (Symbol::new(&env, "InvoiceSoldToPool"), key),
            InvoiceSoldToPoolEvent {
                invoice_hash: nfe_data.invoice_hash,
                owner: nfe_data.owner,
                value: nfe_data.value,
            },
        );
    }

    // -----------------------------------------------------------------------
    // Transfer ownership — model custodial controlled by platform
    // -----------------------------------------------------------------------
    pub fn transfer_ownership(env: Env, key: String, new_owner: Address, platform_auth: Address) {
        let platform: Address = env
            .storage()
            .instance()
            .get(&DataKey::Platform)
            .unwrap_or_else(|| panic_with_error!(&env, Error::Unauthorized));
        platform_auth.require_auth();
        if platform_auth != platform {
            panic_with_error!(&env, Error::Unauthorized);
        }

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

        // Transferir o NFT real on-chain
        Base::transfer(&env, &old_owner, &new_owner, nfe_data.token_id);

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

    // -----------------------------------------------------------------------
    // Settle — mark as paid and burn the NFT
    // -----------------------------------------------------------------------
    pub fn settle_nfe(env: Env, key: String, platform_auth: Address) {
        let platform: Address = env
            .storage()
            .instance()
            .get(&DataKey::Platform)
            .unwrap_or_else(|| panic_with_error!(&env, Error::Unauthorized));
        platform_auth.require_auth();
        if platform_auth != platform {
            panic_with_error!(&env, Error::Unauthorized);
        }

        let storage_key = DataKey::Nfe(key.clone());
        let mut nfe_data: NfeData = env
            .storage()
            .persistent()
            .get(&storage_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        // Allow settling from Active or SoldToPool
        let status_active = Symbol::new(&env, "Active");
        let status_sold = Symbol::new(&env, "SoldToPool");
        if nfe_data.status != status_active && nfe_data.status != status_sold {
            panic_with_error!(&env, Error::NotActive);
        }

        // Queimar o NFT on-chain
        Base::burn(&env, &nfe_data.owner, nfe_data.token_id);

        nfe_data.status = Symbol::new(&env, "Settled");

        env.storage().persistent().set(&storage_key, &nfe_data);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (Symbol::new(&env, "settle_nfe"), key.clone()),
            nfe_data.owner,
        );
    }

    // -----------------------------------------------------------------------
    // Get sale listing data
    // -----------------------------------------------------------------------
    pub fn get_sale_listing(env: Env, key: String) -> SaleListingData {
        let listing_key = DataKey::SaleListing(key);
        env.storage()
            .persistent()
            .get(&listing_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound))
    }
}

// ===========================================================================
// Trait implementations (OpenZeppelin SEP-50 NFT)
// ===========================================================================
#[default_impl]
#[contractimpl]
impl NonFungibleToken for CredBridgeContract {
    type ContractType = Base;

    // Sobrescrever a função transfer padrão (Opção A)
    // Apenas a conta Platform cadastrada no constructor pode assinar/executar transferências
    fn transfer(env: &Env, from: Address, to: Address, token_id: u32) {
        let platform: Address = env
            .storage()
            .instance()
            .get(&DataKey::Platform)
            .unwrap_or_else(|| panic_with_error!(env, Error::Unauthorized));
        
        // Exige autenticação da plataforma administradora
        platform.require_auth();
        
        // Executa a transferência real do token base
        Base::transfer(env, &from, &to, token_id);
    }
}

#[default_impl]
#[contractimpl]
impl NonFungibleBurnable for CredBridgeContract {}

mod test;
