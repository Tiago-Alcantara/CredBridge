#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};
use stellar_macros::default_impl;
use stellar_tokens::fungible::{Base, FungibleToken};

#[contracttype]
pub enum DataKey {
    Admin,
    Initialized,
}

#[contract]
pub struct MockBrltToken;

#[contractimpl]
impl MockBrltToken {
    /// Initialize the token with admin, name, symbol and decimals.
    /// Can only be called once.
    pub fn initialize(
        env: Env,
        admin: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("already initialized");
        }
        
        Base::set_metadata(&env, decimals, name, symbol);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    /// Mint tokens to a recipient. Only admin can call.
    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        admin.require_auth();
        
        let expected_admin: Address = env.storage().instance().get(&DataKey::Admin).expect("Admin not initialized");
        if admin != expected_admin {
            panic!("unauthorized");
        }

        Base::mint(&env, &to, amount);
    }

    /// Burn tokens from an account.
    pub fn burn(env: Env, from: Address, amount: i128) {
        // A biblioteca OpenZeppelin já executa from.require_auth() internamente on-chain,
        // garantindo total segurança contra queimas não autorizadas de terceiros.
        Base::burn(&env, &from, amount);
    }
}

#[default_impl]
#[contractimpl]
impl FungibleToken for MockBrltToken {
    type ContractType = Base;
}

mod test;
