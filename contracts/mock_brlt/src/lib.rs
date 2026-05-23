#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    Address, Env, String, Symbol,
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum TokenError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InsufficientBalance = 4,
    InsufficientAllowance = 5,
    InvalidAmount = 6,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
#[contracttype]
pub enum DataKey {
    Admin,
    Name,
    Symbol,
    Decimals,
    Balance(Address),
    Allowance(Address, Address),  // (owner, spender)
    Initialized,
}

// ---------------------------------------------------------------------------
// TTL constants
// ---------------------------------------------------------------------------
const DAY_IN_LEDGERS: u32 = 17280;
const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const TTL_EXTEND: u32 = 30 * DAY_IN_LEDGERS;

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------
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
            panic_with_error!(&env, TokenError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::Initialized, &true);

        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    }

    /// Mint tokens to a recipient. Only admin can call.
    pub fn mint(env: Env, admin: Address, to: Address, amount: i128) {
        admin.require_auth();
        Self::require_initialized(&env);
        Self::require_admin(&env, &admin);

        if amount <= 0 {
            panic_with_error!(&env, TokenError::InvalidAmount);
        }

        let balance_key = DataKey::Balance(to.clone());
        let current: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0);
        let new_balance = current + amount;

        env.storage().persistent().set(&balance_key, &new_balance);
        env.storage()
            .persistent()
            .extend_ttl(&balance_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (Symbol::new(&env, "mint"), to),
            amount,
        );
    }

    /// Transfer tokens from sender to recipient. Sender must authenticate.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::require_initialized(&env);

        if amount <= 0 {
            panic_with_error!(&env, TokenError::InvalidAmount);
        }

        Self::spend_balance(&env, &from, amount);

        let to_key = DataKey::Balance(to.clone());
        let to_balance: i128 = env
            .storage()
            .persistent()
            .get(&to_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&to_key, &(to_balance + amount));
        env.storage()
            .persistent()
            .extend_ttl(&to_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (Symbol::new(&env, "transfer"), from, to),
            amount,
        );
    }

    /// Transfer tokens on behalf of owner using allowance. Spender must authenticate.
    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) {
        spender.require_auth();
        Self::require_initialized(&env);

        if amount <= 0 {
            panic_with_error!(&env, TokenError::InvalidAmount);
        }

        // Check and reduce allowance
        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let current_allowance: i128 = env
            .storage()
            .persistent()
            .get(&allowance_key)
            .unwrap_or(0);

        if current_allowance < amount {
            panic_with_error!(&env, TokenError::InsufficientAllowance);
        }

        env.storage()
            .persistent()
            .set(&allowance_key, &(current_allowance - amount));
        env.storage()
            .persistent()
            .extend_ttl(&allowance_key, TTL_THRESHOLD, TTL_EXTEND);

        // Move funds
        Self::spend_balance(&env, &from, amount);

        let to_key = DataKey::Balance(to.clone());
        let to_balance: i128 = env
            .storage()
            .persistent()
            .get(&to_key)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&to_key, &(to_balance + amount));
        env.storage()
            .persistent()
            .extend_ttl(&to_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (Symbol::new(&env, "transfer"), from, to),
            amount,
        );
    }

    /// Approve a spender to use up to `amount` of the owner's tokens.
    pub fn approve(
        env: Env,
        owner: Address,
        spender: Address,
        amount: i128,
    ) {
        owner.require_auth();
        Self::require_initialized(&env);

        let allowance_key = DataKey::Allowance(owner.clone(), spender.clone());
        env.storage()
            .persistent()
            .set(&allowance_key, &amount);
        env.storage()
            .persistent()
            .extend_ttl(&allowance_key, TTL_THRESHOLD, TTL_EXTEND);

        env.events().publish(
            (Symbol::new(&env, "approve"), owner, spender),
            amount,
        );
    }

    // -----------------------------------------------------------------------
    // Read-only functions
    // -----------------------------------------------------------------------

    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(account))
            .unwrap_or(0)
    }

    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(owner, spender))
            .unwrap_or(0)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| String::from_str(&env, ""))
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or(7)
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn require_initialized(env: &Env) {
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic_with_error!(env, TokenError::NotInitialized);
        }
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, TokenError::NotInitialized));

        if *caller != admin {
            panic_with_error!(env, TokenError::Unauthorized);
        }
    }

    fn spend_balance(env: &Env, from: &Address, amount: i128) {
        let from_key = DataKey::Balance(from.clone());
        let from_balance: i128 = env
            .storage()
            .persistent()
            .get(&from_key)
            .unwrap_or(0);

        if from_balance < amount {
            panic_with_error!(env, TokenError::InsufficientBalance);
        }

        env.storage()
            .persistent()
            .set(&from_key, &(from_balance - amount));
        env.storage()
            .persistent()
            .extend_ttl(&from_key, TTL_THRESHOLD, TTL_EXTEND);
    }
}

#[cfg(test)]
mod test;
