// Contratos Soroban compilam para WASM — sem acesso a filesystem, threads ou stdlib do Rust
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, BytesN, Env, String, Symbol,
};

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
    pub value: i128,           // valor em centavos (i128 suporta números grandes sem overflow)
    pub due_date: u64,         // timestamp Unix em segundos do vencimento
    pub xml_hash: BytesN<32>,  // SHA-256 do XML original — prova que o documento não foi alterado
    pub owner: Address,        // carteira atual do dono (G... clássica ou C... smart wallet)
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

// DataKey é o índice de armazenamento — cada NFe vive em Nfe("uuid") no ledger
#[contracttype]
pub enum DataKey {
    Nfe(String),
    SaleListing(String),
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
    AlreadyExists = 1,    // tentativa de tokenizar NFe com key já existente
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
    // Tokenize — registers an NF-e on-chain for the first time
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
        platform_auth.require_auth();

        let storage_key = DataKey::Nfe(key.clone());

        if env.storage().persistent().has(&storage_key) {
            panic_with_error!(&env, Error::AlreadyExists);
        }

        // Compute invoice_hash = the xml_hash serves as a unique identifier
        // In production, this would be sha256(nfe_access_key)
        let invoice_hash = xml_hash.clone();

        let nfe_data = NfeData {
            key: key.clone(),
            value,
            due_date,
            xml_hash,
            owner: owner.clone(),
            status: Symbol::new(&env, "Active"),
            invoice_hash: invoice_hash.clone(),
            rate_bps: 0,
            advance_amount: 0,
        };

        env.storage().persistent().set(&storage_key, &nfe_data);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        // Emit enriched tokenization event
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
        platform_auth.require_auth();

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

    // -----------------------------------------------------------------------
    // Settle — mark as paid
    // -----------------------------------------------------------------------
    pub fn settle_nfe(env: Env, key: String, platform_auth: Address) {
        platform_auth.require_auth();

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

mod test;
