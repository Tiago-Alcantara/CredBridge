#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    Address, BytesN, Env, Symbol,
};

// ===========================================================================
// Constants — Scales for integer-only arithmetic
// ===========================================================================
const PRICE_SCALE: i128 = 1_000_000_000;

// ===========================================================================
// TTL management
// ===========================================================================
const DAY_IN_LEDGERS: u32 = 17280;
const TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const TTL_EXTEND: u32 = 30 * DAY_IN_LEDGERS;

// ===========================================================================
// Error codes
// ===========================================================================
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum PoolError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Paused = 4,
    InvalidAmount = 5,
    InvoiceAlreadyProcessed = 7,
    InvalidNav = 9,
    InsufficientPoolBalance = 11,
}

// ===========================================================================
// Storage types
// ===========================================================================
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolState {
    pub admin: Address,
    pub operator: Address,
    pub asset_address: Address,            // BRLT token contract (represents Credit)
    pub share_token_address: Address,      // Share/quota token contract (CBPOOL)

    pub total_principal: i128,             // Outstanding principal deployed in active invoices
    pub total_shares: i128,                // Total shares/quota tokens minted

    pub paused: bool,
}

#[contracttype]
pub enum DataKey {
    PoolState,
    ProcessedInvoice(BytesN<32>),
    Initialized,
}

// ===========================================================================
// Event payload types
// ===========================================================================
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DepositEvent {
    pub investor: Address,
    pub amount: i128,
    pub shares_minted: i128,
    pub nav_before: i128,
    pub nav_after: i128,
    pub share_price: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvoicePurchasedEvent {
    pub invoice_hash: BytesN<32>,
    pub seller: Address,
    pub advance_amount: i128,
    pub face_value: i128,
    pub rate_bps: i128,
    pub maturity_timestamp: u64,
    pub total_principal: i128,
}

// ===========================================================================
// Contract
// ===========================================================================
#[contract]
pub struct LiquidityPool;

#[contractimpl]
impl LiquidityPool {
    // -----------------------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------------------
    pub fn initialize(
        env: Env,
        admin: Address,
        operator: Address,
        asset_address: Address,
        share_token_address: Address,
    ) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic_with_error!(&env, PoolError::AlreadyInitialized);
        }

        let state = PoolState {
            admin,
            operator,
            asset_address,
            share_token_address,
            total_principal: 0,
            total_shares: 0,
            paused: false,
        };

        env.storage().instance().set(&DataKey::PoolState, &state);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    }

    // -----------------------------------------------------------------------
    // Deposit BRLT & Mint CBPOOL shares
    // -----------------------------------------------------------------------
    pub fn deposit(env: Env, investor: Address, amount: i128) {
        investor.require_auth();
        let mut state = Self::load_state(&env);
        Self::require_not_paused(&env, &state);

        if amount <= 0 {
            panic_with_error!(&env, PoolError::InvalidAmount);
        }

        // Calculate NAV before deposit: NAV = BRLT balance + deployed principal
        let cash_balance = Self::get_token_balance(&env, &state.asset_address);
        let nav_before = cash_balance + state.total_principal;

        // Transfer BRLT from investor to pool contract
        Self::transfer_token_to_pool(&env, &state.asset_address, &investor, amount);

        // Calculate shares to mint
        // First deposit: 1 BRLT = 1 Share. Subsequent: shares = amount * total_shares / nav_before
        let shares_to_mint = if state.total_shares == 0 {
            amount
        } else {
            if nav_before <= 0 {
                panic_with_error!(&env, PoolError::InvalidNav);
            }
            amount * state.total_shares / nav_before
        };

        // Mint share tokens (CBPOOL) to investor
        Self::mint_shares(&env, &state.share_token_address, &investor, shares_to_mint);

        state.total_shares += shares_to_mint;
        Self::save_state(&env, &state);

        let nav_after = (cash_balance + amount) + state.total_principal;
        let share_price = if state.total_shares > 0 {
            nav_after * PRICE_SCALE / state.total_shares
        } else {
            PRICE_SCALE
        };

        // Emit Deposit event
        env.events().publish(
            (Symbol::new(&env, "Deposit"),),
            DepositEvent {
                investor,
                amount,
                shares_minted: shares_to_mint,
                nav_before,
                nav_after,
                share_price,
            },
        );
    }

    // -----------------------------------------------------------------------
    // Withdraw (Burn CBPOOL shares & return BRLT)
    // -----------------------------------------------------------------------
    pub fn withdraw(env: Env, investor: Address, shares_to_burn: i128) {
        investor.require_auth();
        let mut state = Self::load_state(&env);
        Self::require_not_paused(&env, &state);

        if shares_to_burn <= 0 {
            panic_with_error!(&env, PoolError::InvalidAmount);
        }
        if shares_to_burn > state.total_shares {
            panic_with_error!(&env, PoolError::InvalidAmount);
        }

        // Calculate NAV
        let cash_balance = Self::get_token_balance(&env, &state.asset_address);
        let nav = cash_balance + state.total_principal;

        if nav <= 0 || state.total_shares <= 0 {
            panic_with_error!(&env, PoolError::InvalidNav);
        }

        // brlt_to_return = shares_to_burn * NAV / total_shares (reflects cota appreciation)
        let brlt_to_return = shares_to_burn * nav / state.total_shares;

        if brlt_to_return > cash_balance {
            panic_with_error!(&env, PoolError::InsufficientPoolBalance);
        }

        // Burn share tokens (CBPOOL) from investor
        Self::burn_shares(&env, &state.share_token_address, &investor, shares_to_burn);

        // Transfer BRLT from pool contract to investor
        Self::transfer_token_from_pool(&env, &state.asset_address, &investor, brlt_to_return);

        state.total_shares -= shares_to_burn;
        Self::save_state(&env, &state);

        // Emit Withdraw event
        env.events().publish(
            (Symbol::new(&env, "Withdraw"), investor),
            brlt_to_return,
        );
    }

    // -----------------------------------------------------------------------
    // Buy tokenized invoice (Pool disbursements)
    // -----------------------------------------------------------------------
    pub fn buy_tokenized_invoice(
        env: Env,
        operator: Address,
        seller: Address,
        invoice_hash: BytesN<32>,
        face_value: i128,
        advance_amount: i128,
        rate_bps: i128,
        maturity_timestamp: u64,
    ) {
        operator.require_auth();
        let mut state = Self::load_state(&env);
        Self::require_not_paused(&env, &state);
        Self::require_operator(&env, &state, &operator);

        // Validate inputs
        if advance_amount <= 0 || face_value <= 0 {
            panic_with_error!(&env, PoolError::InvalidAmount);
        }
        if advance_amount > face_value {
            panic_with_error!(&env, PoolError::InvalidAmount);
        }

        // Check idempotency
        let invoice_key = DataKey::ProcessedInvoice(invoice_hash.clone());
        if env.storage().persistent().has(&invoice_key) {
            panic_with_error!(&env, PoolError::InvoiceAlreadyProcessed);
        }

        // Check pool has sufficient BRLT
        let pool_balance = Self::get_token_balance(&env, &state.asset_address);
        if pool_balance < advance_amount {
            panic_with_error!(&env, PoolError::InsufficientPoolBalance);
        }

        // Pay seller (PME)
        Self::transfer_token_from_pool(&env, &state.asset_address, &seller, advance_amount);

        // Increase outstanding principal deployed
        state.total_principal += advance_amount;

        // Mark invoice as processed in pool
        env.storage().persistent().set(&invoice_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&invoice_key, TTL_THRESHOLD, TTL_EXTEND);

        Self::save_state(&env, &state);

        env.events().publish(
            (Symbol::new(&env, "TokenizedInvoicePurchased"),),
            InvoicePurchasedEvent {
                invoice_hash,
                seller,
                advance_amount,
                face_value,
                rate_bps,
                maturity_timestamp,
                total_principal: state.total_principal,
            },
        );
    }

    // -----------------------------------------------------------------------
    // Settle invoice in pool (reduces outstanding principal)
    // -----------------------------------------------------------------------
    pub fn settle_invoice_in_pool(
        env: Env,
        operator: Address,
        invoice_hash: BytesN<32>,
        principal_to_reduce: i128,
    ) {
        operator.require_auth();
        let mut state = Self::load_state(&env);
        Self::require_not_paused(&env, &state);
        Self::require_operator(&env, &state, &operator);

        if principal_to_reduce <= 0 {
            panic_with_error!(&env, PoolError::InvalidAmount);
        }

        if principal_to_reduce > state.total_principal {
            state.total_principal = 0;
        } else {
            state.total_principal -= principal_to_reduce;
        }

        Self::save_state(&env, &state);

        env.events().publish(
            (Symbol::new(&env, "InvoiceSettledInPool"), invoice_hash),
            principal_to_reduce,
        );
    }

    // -----------------------------------------------------------------------
    // Read-only functions
    // -----------------------------------------------------------------------
    pub fn get_nav(env: Env) -> i128 {
        let state = Self::load_state(&env);
        let cash_balance = Self::get_token_balance(&env, &state.asset_address);
        cash_balance + state.total_principal
    }

    pub fn get_share_price(env: Env) -> i128 {
        let state = Self::load_state(&env);

        if state.total_shares == 0 {
            return PRICE_SCALE;
        }

        let nav = Self::get_nav(env);
        nav * PRICE_SCALE / state.total_shares
    }

    pub fn get_pool_state(env: Env) -> PoolState {
        Self::load_state(&env)
    }

    // -----------------------------------------------------------------------
    // Admin functions
    // -----------------------------------------------------------------------
    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        let mut state = Self::load_state(&env);
        Self::require_admin(&env, &state, &admin);

        state.paused = true;
        Self::save_state(&env, &state);

        env.events().publish(
            (Symbol::new(&env, "PoolPaused"),),
            env.ledger().timestamp(),
        );
    }

    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        let mut state = Self::load_state(&env);
        Self::require_admin(&env, &state, &admin);

        state.paused = false;
        Self::save_state(&env, &state);

        env.events().publish(
            (Symbol::new(&env, "PoolUnpaused"),),
            env.ledger().timestamp(),
        );
    }

    pub fn set_operator(env: Env, admin: Address, new_operator: Address) {
        admin.require_auth();
        let mut state = Self::load_state(&env);
        Self::require_admin(&env, &state, &admin);

        state.operator = new_operator;
        Self::save_state(&env, &state);
    }

    // =======================================================================
    // Internal helpers
    // =======================================================================

    fn load_state(env: &Env) -> PoolState {
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic_with_error!(env, PoolError::NotInitialized);
        }
        env.storage()
            .instance()
            .get(&DataKey::PoolState)
            .unwrap_or_else(|| panic_with_error!(env, PoolError::NotInitialized))
    }

    fn save_state(env: &Env, state: &PoolState) {
        env.storage().instance().set(&DataKey::PoolState, state);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    }

    fn require_not_paused(env: &Env, state: &PoolState) {
        if state.paused {
            panic_with_error!(env, PoolError::Paused);
        }
    }

    fn require_admin(env: &Env, state: &PoolState, caller: &Address) {
        if *caller != state.admin {
            panic_with_error!(env, PoolError::Unauthorized);
        }
    }

    fn require_operator(env: &Env, state: &PoolState, caller: &Address) {
        if *caller != state.operator && *caller != state.admin {
            panic_with_error!(env, PoolError::Unauthorized);
        }
    }

    // -----------------------------------------------------------------------
    // Cross-contract token interaction via client interface
    // -----------------------------------------------------------------------

    fn get_token_balance(env: &Env, token: &Address) -> i128 {
        let client = TokenClient::new(env, token);
        client.balance(&env.current_contract_address())
    }

    fn transfer_token_to_pool(env: &Env, token: &Address, from: &Address, amount: i128) {
        let client = TokenClient::new(env, token);
        client.transfer(from, &env.current_contract_address(), &amount);
    }

    fn transfer_token_from_pool(env: &Env, token: &Address, to: &Address, amount: i128) {
        let client = TokenClient::new(env, token);
        client.transfer(&env.current_contract_address(), to, &amount);
    }

    fn mint_shares(env: &Env, share_token: &Address, to: &Address, amount: i128) {
        let client = ShareTokenClient::new(env, share_token);
        client.mint(&env.current_contract_address(), to, &amount);
    }

    fn burn_shares(env: &Env, share_token: &Address, from: &Address, amount: i128) {
        let client = ShareTokenClient::new(env, share_token);
        client.burn(from, &amount);
    }
}

// ===========================================================================
// Cross-contract interfaces for token interactions
// ===========================================================================

use soroban_sdk::contractclient;

#[contractclient(name = "TokenClient")]
pub trait TokenInterface {
    fn transfer(env: Env, from: Address, to: Address, amount: i128);
    fn balance(env: Env, account: Address) -> i128;
    fn approve(env: Env, owner: Address, spender: Address, amount: i128);
}

#[contractclient(name = "ShareTokenClient")]
pub trait ShareTokenInterface {
    fn mint(env: Env, admin: Address, to: Address, amount: i128);
    fn burn(env: Env, from: Address, amount: i128);
    fn balance(env: Env, account: Address) -> i128;
}

#[cfg(test)]
mod test;
