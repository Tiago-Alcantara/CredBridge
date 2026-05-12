#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, Address, BytesN, Env, String, Symbol,
};

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

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NfeData {
    pub key: String,
    pub value: i128,
    pub due_date: u64,
    pub xml_hash: BytesN<32>,
    pub owner: Address,
    pub status: Symbol,
}

#[contracttype]
pub enum DataKey {
    Nfe(String),
}

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

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyExists = 1,
    NotFound = 2,
    NotActive = 3,
}

// 30 days in ledgers (assuming 5s per ledger) -> 30 * 24 * 60 * 60 / 5 = 518400
const DAY_IN_LEDGERS: u32 = 17280;
const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const TTL_EXTEND: u32 = 30 * DAY_IN_LEDGERS;

#[contract]
pub struct CredBridgeContract;

#[contractimpl]
impl CredBridgeContract {
    pub fn tokenize_nfe(
        env: Env,
        key: String,
        value: i128,
        due_date: u64,
        xml_hash: BytesN<32>,
        owner: Address,
    ) {
        owner.require_auth();

        let storage_key = DataKey::Nfe(key.clone());

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

        env.storage().persistent().set(&storage_key, &nfe_data);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (Symbol::new(&env, "tokenize_nfe"), key.clone()),
            value,
        );
    }

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

    pub fn transfer_ownership(env: Env, key: String, new_owner: Address) {
        let storage_key = DataKey::Nfe(key.clone());
        let mut nfe_data: NfeData = env
            .storage()
            .persistent()
            .get(&storage_key)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        // Authenticate current owner
        nfe_data.owner.require_auth();

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

    pub fn settle_nfe(env: Env, key: String, platform_auth: Address) {
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

        env.events().publish(
            (Symbol::new(&env, "settle_nfe"), key.clone()),
            nfe_data.owner,
        );
    }
}

mod test;
