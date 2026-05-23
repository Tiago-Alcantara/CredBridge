#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error,
    Address, BytesN, Env, Symbol,
};

// ===========================================================================
// Constants — Scales for integer-only arithmetic
// ===========================================================================
const BPS_SCALE: i128 = 10_000;
const SECONDS_PER_DAY: i128 = 86_400;
const PRICE_SCALE: i128 = 1_000_000_000;
const MAX_RATE_BPS: i128 = 5_000; // 50% per day — generous for testing

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
    InvalidRate = 6,
    InvoiceAlreadyProcessed = 7,
    InvalidSharePrice = 8,
    InvalidNav = 9,
    TimestampWentBackwards = 10,
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
    pub asset_address: Address,            // BRLT token contract
    pub share_token_address: Address,      // Share/quota token contract

    pub total_principal: i128,             // Outstanding principal from purchased invoices
    pub accrued_interest: i128,            // Accumulated interest since last accrual
    pub total_shares: i128,                // Total shares minted (scaled by SHARE_SCALE)

    pub average_daily_rate_bps: i128,      // Weighted average daily rate in BPS
    pub last_accrual_timestamp: u64,       // Last time interest was accrued

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
pub struct AccruedEvent {
    pub elapsed_seconds: u64,
    pub interest_accrued: i128,
    pub total_accrued_interest: i128,
    pub new_nav: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AnticipationEvent {
    pub invoice_hash: BytesN<32>,
    pub anticipation_amount: i128,
    pub rate_bps: i128,
    pub maturity_timestamp: u64,
    pub total_principal: i128,
    pub average_daily_rate_bps: i128,
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
    pub average_daily_rate_bps: i128,
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
            accrued_interest: 0,
            total_shares: 0,
            average_daily_rate_bps: 0,
            last_accrual_timestamp: env.ledger().timestamp(),
            paused: false,
        };

        env.storage().instance().set(&DataKey::PoolState, &state);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
    }

    // -----------------------------------------------------------------------
    // Deposit & Mint shares
    // -----------------------------------------------------------------------
    pub fn deposit(env: Env, investor: Address, amount: i128) {
        investor.require_auth();
        let mut state = Self::load_state(&env);
        Self::require_not_paused(&env, &state);

        if amount <= 0 {
            panic_with_error!(&env, PoolError::InvalidAmount);
        }

        // Accrue interest before calculating NAV
        Self::accrue_interest_internal(&env, &mut state);

        // Calculate NAV before deposit
        let cash_balance = Self::get_token_balance(&env, &state.asset_address);
        let nav_before = cash_balance + state.total_principal + state.accrued_interest;

        // Transfer BRLT from investor to pool
        Self::transfer_token_to_pool(&env, &state.asset_address, &investor, amount);

        // Calculate shares to mint
        // Shares are 1:1 with token units — PRICE_SCALE handles display precision
        let shares_to_mint = if state.total_shares == 0 {
            // First deposit: 1 token unit = 1 share unit
            amount
        } else {
            if nav_before <= 0 {
                panic_with_error!(&env, PoolError::InvalidNav);
            }
            // shares = amount * total_shares / nav_before
            amount * state.total_shares / nav_before
        };

        // Mint share tokens to investor
        Self::mint_shares(&env, &state.share_token_address, &investor, shares_to_mint);

        state.total_shares += shares_to_mint;

        let nav_after = (cash_balance + amount) + state.total_principal + state.accrued_interest;
        let share_price = if state.total_shares > 0 {
            nav_after * PRICE_SCALE / state.total_shares
        } else {
            PRICE_SCALE
        };

        Self::save_state(&env, &state);

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
    // Register anticipation (simple — contábil only, no BRLT transfer)
    // -----------------------------------------------------------------------
    pub fn register_anticipation(
        env: Env,
        operator: Address,
        invoice_hash: BytesN<32>,
        anticipation_amount: i128,
        rate_bps: i128,
        maturity_timestamp: u64,
    ) {
        operator.require_auth();
        let mut state = Self::load_state(&env);
        Self::require_not_paused(&env, &state);
        Self::require_operator(&env, &state, &operator);

        if anticipation_amount <= 0 {
            panic_with_error!(&env, PoolError::InvalidAmount);
        }
        if rate_bps <= 0 || rate_bps > MAX_RATE_BPS {
            panic_with_error!(&env, PoolError::InvalidRate);
        }

        // Check idempotency
        let invoice_key = DataKey::ProcessedInvoice(invoice_hash.clone());
        if env.storage().persistent().has(&invoice_key) {
            panic_with_error!(&env, PoolError::InvoiceAlreadyProcessed);
        }

        // Accrue interest before modifying state
        Self::accrue_interest_internal(&env, &mut state);

        // Update weighted average rate
        state.average_daily_rate_bps = Self::calculate_new_average_rate(
            state.total_principal,
            state.average_daily_rate_bps,
            anticipation_amount,
            rate_bps,
        );

        state.total_principal += anticipation_amount;

        // Mark invoice as processed
        env.storage().persistent().set(&invoice_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&invoice_key, TTL_THRESHOLD, TTL_EXTEND);

        Self::save_state(&env, &state);

        env.events().publish(
            (Symbol::new(&env, "AnticipationRegistered"),),
            AnticipationEvent {
                invoice_hash,
                anticipation_amount,
                rate_bps,
                maturity_timestamp,
                total_principal: state.total_principal,
                average_daily_rate_bps: state.average_daily_rate_bps,
            },
        );
    }

    // -----------------------------------------------------------------------
    // Buy tokenized invoice (full flow: pay seller + register)
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
        if rate_bps <= 0 || rate_bps > MAX_RATE_BPS {
            panic_with_error!(&env, PoolError::InvalidRate);
        }

        // Check idempotency
        let invoice_key = DataKey::ProcessedInvoice(invoice_hash.clone());
        if env.storage().persistent().has(&invoice_key) {
            panic_with_error!(&env, PoolError::InvoiceAlreadyProcessed);
        }

        // Accrue interest first
        Self::accrue_interest_internal(&env, &mut state);

        // Check pool has sufficient BRLT
        let pool_balance = Self::get_token_balance(&env, &state.asset_address);
        if pool_balance < advance_amount {
            panic_with_error!(&env, PoolError::InsufficientPoolBalance);
        }

        // Pay seller
        Self::transfer_token_from_pool(&env, &state.asset_address, &seller, advance_amount);

        // Update weighted average rate
        state.average_daily_rate_bps = Self::calculate_new_average_rate(
            state.total_principal,
            state.average_daily_rate_bps,
            advance_amount,
            rate_bps,
        );

        state.total_principal += advance_amount;

        // Mark invoice as processed
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
                average_daily_rate_bps: state.average_daily_rate_bps,
            },
        );
    }

    // -----------------------------------------------------------------------
    // Read-only functions
    // -----------------------------------------------------------------------
    pub fn get_nav(env: Env) -> i128 {
        let state = Self::load_state(&env);
        let cash_balance = Self::get_token_balance(&env, &state.asset_address);

        // Estimate accrued interest up to now
        let now = env.ledger().timestamp();
        let estimated_interest = Self::estimate_interest(
            &state,
            now,
        );

        cash_balance + state.total_principal + state.accrued_interest + estimated_interest
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

    /// Accrue interest pro-rata based on elapsed time.
    fn accrue_interest_internal(env: &Env, state: &mut PoolState) {
        let now = env.ledger().timestamp();

        if now < state.last_accrual_timestamp {
            panic_with_error!(env, PoolError::TimestampWentBackwards);
        }

        let elapsed = now - state.last_accrual_timestamp;

        if elapsed == 0 || state.total_principal == 0 {
            state.last_accrual_timestamp = now;
            return;
        }

        // interest = total_principal * average_daily_rate_bps * elapsed_seconds
        //            / (BPS_SCALE * SECONDS_PER_DAY)
        let interest = state.total_principal
            * state.average_daily_rate_bps
            * (elapsed as i128)
            / (BPS_SCALE * SECONDS_PER_DAY);

        state.accrued_interest += interest;
        state.last_accrual_timestamp = now;

        if interest > 0 {
            let cash_balance = Self::get_token_balance(env, &state.asset_address);
            let new_nav = cash_balance + state.total_principal + state.accrued_interest;

            env.events().publish(
                (Symbol::new(env, "Accrued"),),
                AccruedEvent {
                    elapsed_seconds: elapsed,
                    interest_accrued: interest,
                    total_accrued_interest: state.accrued_interest,
                    new_nav,
                    timestamp: now,
                },
            );
        }
    }

    /// Estimate interest without modifying state (for read-only NAV).
    fn estimate_interest(state: &PoolState, now: u64) -> i128 {
        if now <= state.last_accrual_timestamp || state.total_principal == 0 {
            return 0;
        }

        let elapsed = now - state.last_accrual_timestamp;
        state.total_principal
            * state.average_daily_rate_bps
            * (elapsed as i128)
            / (BPS_SCALE * SECONDS_PER_DAY)
    }

    /// Calculate weighted average rate after adding a new anticipation.
    fn calculate_new_average_rate(
        current_principal: i128,
        current_rate: i128,
        new_amount: i128,
        new_rate: i128,
    ) -> i128 {
        if current_principal == 0 {
            return new_rate;
        }
        let total = current_principal + new_amount;
        if total == 0 {
            return 0;
        }
        (current_principal * current_rate + new_amount * new_rate) / total
    }

    // -----------------------------------------------------------------------
    // State management
    // -----------------------------------------------------------------------
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

    /// Get BRLT balance of this contract
    fn get_token_balance(env: &Env, token: &Address) -> i128 {
        let client = TokenClient::new(env, token);
        client.balance(&env.current_contract_address())
    }

    /// Transfer BRLT from investor to pool (investor must have approved or authed)
    fn transfer_token_to_pool(env: &Env, token: &Address, from: &Address, amount: i128) {
        let client = TokenClient::new(env, token);
        client.transfer(from, &env.current_contract_address(), &amount);
    }

    /// Transfer BRLT from pool to recipient (for buy_tokenized_invoice)
    fn transfer_token_from_pool(env: &Env, token: &Address, to: &Address, amount: i128) {
        let client = TokenClient::new(env, token);
        client.transfer(&env.current_contract_address(), to, &amount);
    }

    /// Mint share tokens to investor
    fn mint_shares(env: &Env, share_token: &Address, to: &Address, amount: i128) {
        let client = ShareTokenClient::new(env, share_token);
        client.mint(&env.current_contract_address(), to, &amount);
    }
}

// ===========================================================================
// Cross-contract interfaces for token interactions
// ===========================================================================

// We define minimal client traits instead of importing WASM at compile time.
// These match the mock_brlt interface and work with any compatible token contract.

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
    fn balance(env: Env, account: Address) -> i128;
}

#[cfg(test)]
mod test;
