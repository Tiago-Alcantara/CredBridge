#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, String,
};

// We register mock_brlt directly for testing
use mock_brlt::MockBrltToken;

// ===========================================================================
// Test helpers
// ===========================================================================

fn create_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn deploy_token(env: &Env, admin: &Address) -> Address {
    let token_id = env.register(MockBrltToken, ());
    let client = mock_brlt::MockBrltTokenClient::new(env, &token_id);
    client.initialize(
        admin,
        &String::from_str(env, "Brazilian Real Token"),
        &String::from_str(env, "BRLT"),
        &7,
    );
    token_id
}


struct TestSetup<'a> {
    env: Env,
    pool_client: LiquidityPoolClient<'a>,
    pool_address: Address,
    brlt_client: mock_brlt::MockBrltTokenClient<'a>,
    share_client: mock_brlt::MockBrltTokenClient<'a>,
    admin: Address,
    operator: Address,
    brlt_address: Address,
    share_address: Address,
}

fn setup_pool() -> TestSetup<'static> {
    let env = create_env();
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);

    let brlt_address = deploy_token(&env, &admin);
    let brlt_client = mock_brlt::MockBrltTokenClient::new(&env, &brlt_address);

    // For share token, the Pool contract itself must be the admin so it can mint
    // We'll deploy with a temp admin, then note that in tests the pool_address
    // needs to be set as admin. For simplicity, deploy share token with pool as admin.
    let pool_address = env.register(LiquidityPool, ());
    let pool_client = LiquidityPoolClient::new(&env, &pool_address);

    let share_address = {
        let token_id = env.register(MockBrltToken, ());
        let client = mock_brlt::MockBrltTokenClient::new(&env, &token_id);
        // Pool contract will be the admin of share token so it can mint
        client.initialize(
            &pool_address,
            &String::from_str(&env, "CredBridge Pool Shares"),
            &String::from_str(&env, "cbSHARE"),
            &7,
        );
        token_id
    };
    let share_client = mock_brlt::MockBrltTokenClient::new(&env, &share_address);

    pool_client.initialize(&admin, &operator, &brlt_address, &share_address);

    TestSetup {
        env,
        pool_client,
        pool_address,
        brlt_client,
        share_client,
        admin,
        operator,
        brlt_address,
        share_address,
    }
}

fn advance_time(env: &Env, seconds: u64) {
    let mut ledger = env.ledger().get();
    ledger.timestamp += seconds;
    ledger.sequence_number += (seconds / 5) as u32; // ~5s per ledger
    env.ledger().set(ledger);
}

fn make_invoice_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

// ===========================================================================
// 6.1 Initialization Tests
// ===========================================================================

#[test]
fn test_initialize_success() {
    let setup = setup_pool();
    let state = setup.pool_client.get_pool_state();

    assert_eq!(state.admin, setup.admin);
    assert_eq!(state.operator, setup.operator);
    assert_eq!(state.asset_address, setup.brlt_address);
    assert_eq!(state.share_token_address, setup.share_address);
    assert_eq!(state.total_principal, 0);
    assert_eq!(state.accrued_interest, 0);
    assert_eq!(state.total_shares, 0);
    assert_eq!(state.average_daily_rate_bps, 0);
    assert!(!state.paused);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_initialize_fails() {
    let setup = setup_pool();
    setup.pool_client.initialize(
        &setup.admin,
        &setup.operator,
        &setup.brlt_address,
        &setup.share_address,
    );
}

#[test]
fn test_initialize_stores_admin_operator_correctly() {
    let setup = setup_pool();
    let state = setup.pool_client.get_pool_state();
    assert_eq!(state.admin, setup.admin);
    assert_eq!(state.operator, setup.operator);
}

// ===========================================================================
// 6.2 Deposit Tests
// ===========================================================================

#[test]
fn test_deposit_first_investor_empty_pool() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let deposit_amount: i128 = 5_000_0000000; // 5000 BRLT (7 decimals)

    // Fund investor with BRLT
    setup.brlt_client.mint(&setup.admin, &investor, &deposit_amount);

    setup.pool_client.deposit(&investor, &deposit_amount);

    // Shares minted = amount (1:1 ratio, no scaling)
    let expected_shares = deposit_amount;
    let share_balance = setup.share_client.balance(&investor);
    assert_eq!(share_balance, expected_shares);

    let state = setup.pool_client.get_pool_state();
    assert_eq!(state.total_shares, expected_shares);

    // Pool should hold the BRLT
    let pool_brlt = setup.brlt_client.balance(&setup.pool_address);
    assert_eq!(pool_brlt, deposit_amount);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_deposit_zero_amount_fails() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    setup.pool_client.deposit(&investor, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_deposit_negative_amount_fails() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    setup.pool_client.deposit(&investor, &(-100));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_deposit_when_paused_fails() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);

    setup.pool_client.pause(&setup.admin);
    setup.pool_client.deposit(&investor, &1000);
}

#[test]
fn test_deposit_second_investor_gets_correct_shares() {
    let setup = setup_pool();
    let investor1 = Address::generate(&setup.env);
    let investor2 = Address::generate(&setup.env);
    let amount1: i128 = 10_000_0000000;
    let amount2: i128 = 5_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor1, &amount1);
    setup.brlt_client.mint(&setup.admin, &investor2, &amount2);

    // First deposit
    setup.pool_client.deposit(&investor1, &amount1);

    // Second deposit (no time passed, no interest, NAV = cash only)
    setup.pool_client.deposit(&investor2, &amount2);

    let shares1 = setup.share_client.balance(&investor1);
    let shares2 = setup.share_client.balance(&investor2);

    // With no interest accrued, shares should be proportional
    // investor1 deposited 2x investor2 → should have 2x shares
    assert_eq!(shares1 / shares2, 2);
}

#[test]
fn test_deposit_calls_accrue_before_share_calc() {
    let setup = setup_pool();
    let investor1 = Address::generate(&setup.env);
    let investor2 = Address::generate(&setup.env);
    let amount: i128 = 10_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor1, &amount);
    setup.brlt_client.mint(&setup.admin, &investor2, &amount);

    // First deposit
    setup.pool_client.deposit(&investor1, &amount);

    // Register an anticipation to generate interest
    let hash = make_invoice_hash(&setup.env, 1);
    setup.pool_client.register_anticipation(
        &setup.operator,
        &hash,
        &amount, // principal = full deposit
        &100,    // 1% daily
        &(setup.env.ledger().timestamp() + 30 * 86400),
    );

    // Advance 1 day
    advance_time(&setup.env, 86400);

    // Second deposit should calculate shares based on NAV including accrued interest
    setup.pool_client.deposit(&investor2, &amount);

    let shares1 = setup.share_client.balance(&investor1);
    let shares2 = setup.share_client.balance(&investor2);

    // investor2 should get fewer shares because NAV grew (interest accrued)
    assert!(shares1 > shares2, "Second investor should get fewer shares after interest accrual");
}

// ===========================================================================
// 6.3 Accrual Tests
// ===========================================================================

#[test]
fn test_accrual_one_day() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let deposit_amount: i128 = 100_000_0000000; // 100k BRLT

    setup.brlt_client.mint(&setup.admin, &investor, &deposit_amount);
    setup.pool_client.deposit(&investor, &deposit_amount);

    // Register anticipation: principal = 50k, rate = 100 bps (1% daily)
    let hash = make_invoice_hash(&setup.env, 1);
    setup.pool_client.register_anticipation(
        &setup.operator,
        &hash,
        &50_000_0000000,
        &100, // 1% daily
        &(setup.env.ledger().timestamp() + 30 * 86400),
    );

    // NAV before time passes
    let nav_before = setup.pool_client.get_nav();

    // Advance exactly 1 day
    advance_time(&setup.env, 86400);

    let nav_after = setup.pool_client.get_nav();

    // Expected interest: 50_000 * 100 * 86400 / (10_000 * 86400) = 50_000 * 0.01 = 500 BRLT
    // In smallest units: 500_0000000
    let interest = nav_after - nav_before;
    assert_eq!(interest, 500_0000000, "Interest for 1 day at 1% on 50k should be 500 BRLT");
}

#[test]
fn test_accrual_fractional_day() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let deposit_amount: i128 = 100_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &deposit_amount);
    setup.pool_client.deposit(&investor, &deposit_amount);

    let hash = make_invoice_hash(&setup.env, 1);
    setup.pool_client.register_anticipation(
        &setup.operator,
        &hash,
        &100_000_0000000,
        &100, // 1% daily
        &(setup.env.ledger().timestamp() + 30 * 86400),
    );

    // Advance 12 hours (half a day)
    advance_time(&setup.env, 43200);

    let nav_after = setup.pool_client.get_nav();
    let expected_nav = 100_000_0000000 + 100_000_0000000 + 500_0000000; // cash + principal + half-day interest
    assert_eq!(nav_after, expected_nav, "NAV should reflect half-day interest");
}

#[test]
fn test_accrual_zero_principal_no_interest() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let deposit_amount: i128 = 10_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &deposit_amount);
    setup.pool_client.deposit(&investor, &deposit_amount);

    // No anticipation registered, so principal = 0
    let nav_before = setup.pool_client.get_nav();
    advance_time(&setup.env, 86400 * 30);
    let nav_after = setup.pool_client.get_nav();

    assert_eq!(nav_before, nav_after, "No interest should accrue when principal is 0");
}

#[test]
fn test_accrual_updates_timestamp() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let amount: i128 = 10_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &amount);
    setup.pool_client.deposit(&investor, &amount);

    let hash = make_invoice_hash(&setup.env, 1);
    setup.pool_client.register_anticipation(
        &setup.operator, &hash, &amount, &100,
        &(setup.env.ledger().timestamp() + 30 * 86400),
    );

    let state_before = setup.pool_client.get_pool_state();
    advance_time(&setup.env, 86400);

    // Force accrual by making a new deposit
    setup.brlt_client.mint(&setup.admin, &investor, &1_0000000);
    setup.pool_client.deposit(&investor, &1_0000000);

    let state_after = setup.pool_client.get_pool_state();
    assert!(
        state_after.last_accrual_timestamp > state_before.last_accrual_timestamp,
        "Timestamp should be updated after accrual"
    );
}

// ===========================================================================
// 6.4 Anticipation / Buy Invoice Tests
// ===========================================================================

#[test]
fn test_register_anticipation_updates_principal_and_rate() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let amount: i128 = 100_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &amount);
    setup.pool_client.deposit(&investor, &amount);

    let hash = make_invoice_hash(&setup.env, 1);
    setup.pool_client.register_anticipation(
        &setup.operator, &hash, &50_000_0000000, &200,
        &(setup.env.ledger().timestamp() + 30 * 86400),
    );

    let state = setup.pool_client.get_pool_state();
    assert_eq!(state.total_principal, 50_000_0000000);
    assert_eq!(state.average_daily_rate_bps, 200);
}

#[test]
fn test_register_anticipation_weighted_average_rate() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let amount: i128 = 200_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &amount);
    setup.pool_client.deposit(&investor, &amount);

    // First: 100k at 200 bps
    let hash1 = make_invoice_hash(&setup.env, 1);
    setup.pool_client.register_anticipation(
        &setup.operator, &hash1, &100_000_0000000, &200,
        &(setup.env.ledger().timestamp() + 30 * 86400),
    );

    // Second: 100k at 400 bps
    let hash2 = make_invoice_hash(&setup.env, 2);
    setup.pool_client.register_anticipation(
        &setup.operator, &hash2, &100_000_0000000, &400,
        &(setup.env.ledger().timestamp() + 30 * 86400),
    );

    let state = setup.pool_client.get_pool_state();
    assert_eq!(state.total_principal, 200_000_0000000);
    // Weighted average: (100k * 200 + 100k * 400) / 200k = 300
    assert_eq!(state.average_daily_rate_bps, 300);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_register_anticipation_unauthorized() {
    let setup = setup_pool();
    let faker = Address::generate(&setup.env);
    let hash = make_invoice_hash(&setup.env, 1);

    setup.pool_client.register_anticipation(
        &faker, &hash, &1000, &100,
        &(setup.env.ledger().timestamp() + 86400),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_register_anticipation_duplicate_invoice() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let amount: i128 = 100_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &amount);
    setup.pool_client.deposit(&investor, &amount);

    let hash = make_invoice_hash(&setup.env, 1);
    let ts = setup.env.ledger().timestamp() + 30 * 86400;

    setup.pool_client.register_anticipation(
        &setup.operator, &hash, &50_000_0000000, &100, &ts,
    );
    // Duplicate should fail
    setup.pool_client.register_anticipation(
        &setup.operator, &hash, &50_000_0000000, &100, &ts,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_register_anticipation_zero_amount() {
    let setup = setup_pool();
    let hash = make_invoice_hash(&setup.env, 1);
    setup.pool_client.register_anticipation(
        &setup.operator, &hash, &0, &100,
        &(setup.env.ledger().timestamp() + 86400),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_register_anticipation_invalid_rate() {
    let setup = setup_pool();
    let hash = make_invoice_hash(&setup.env, 1);
    setup.pool_client.register_anticipation(
        &setup.operator, &hash, &1000, &6000, // exceeds MAX_RATE_BPS
        &(setup.env.ledger().timestamp() + 86400),
    );
}

#[test]
fn test_buy_tokenized_invoice_pays_seller_and_updates_state() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let seller = Address::generate(&setup.env);
    let deposit_amount: i128 = 100_000_0000000;

    // Fund pool via deposit
    setup.brlt_client.mint(&setup.admin, &investor, &deposit_amount);
    setup.pool_client.deposit(&investor, &deposit_amount);

    let hash = make_invoice_hash(&setup.env, 1);
    let face_value: i128 = 50_000_0000000;
    let advance_amount: i128 = 47_500_0000000; // 95% of face

    let seller_balance_before = setup.brlt_client.balance(&seller);

    setup.pool_client.buy_tokenized_invoice(
        &setup.operator,
        &seller,
        &hash,
        &face_value,
        &advance_amount,
        &150, // 1.5% daily
        &(setup.env.ledger().timestamp() + 30 * 86400),
    );

    // Seller should have received BRLT
    let seller_balance_after = setup.brlt_client.balance(&seller);
    assert_eq!(seller_balance_after - seller_balance_before, advance_amount);

    // Pool state should reflect the purchase
    let state = setup.pool_client.get_pool_state();
    assert_eq!(state.total_principal, advance_amount);
    assert_eq!(state.average_daily_rate_bps, 150);

    // Pool BRLT balance should decrease
    let pool_balance = setup.brlt_client.balance(&setup.pool_address);
    assert_eq!(pool_balance, deposit_amount - advance_amount);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_buy_tokenized_invoice_insufficient_balance() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let seller = Address::generate(&setup.env);

    // Only deposit 1000 BRLT
    setup.brlt_client.mint(&setup.admin, &investor, &1_000_0000000);
    setup.pool_client.deposit(&investor, &1_000_0000000);

    let hash = make_invoice_hash(&setup.env, 1);
    // Try to buy invoice worth 50k — pool doesn't have enough
    setup.pool_client.buy_tokenized_invoice(
        &setup.operator, &seller, &hash,
        &50_000_0000000, &47_500_0000000, &100,
        &(setup.env.ledger().timestamp() + 86400),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_buy_tokenized_invoice_duplicate() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let seller = Address::generate(&setup.env);
    let amount: i128 = 200_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &amount);
    setup.pool_client.deposit(&investor, &amount);

    let hash = make_invoice_hash(&setup.env, 1);
    let ts = setup.env.ledger().timestamp() + 30 * 86400;

    setup.pool_client.buy_tokenized_invoice(
        &setup.operator, &seller, &hash,
        &50_000_0000000, &47_500_0000000, &100, &ts,
    );
    // Duplicate should fail
    setup.pool_client.buy_tokenized_invoice(
        &setup.operator, &seller, &hash,
        &50_000_0000000, &47_500_0000000, &100, &ts,
    );
}

// ===========================================================================
// 6.5 Pause Tests
// ===========================================================================

#[test]
fn test_admin_can_pause_and_unpause() {
    let setup = setup_pool();

    setup.pool_client.pause(&setup.admin);
    let state = setup.pool_client.get_pool_state();
    assert!(state.paused);

    setup.pool_client.unpause(&setup.admin);
    let state = setup.pool_client.get_pool_state();
    assert!(!state.paused);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_non_admin_cannot_pause() {
    let setup = setup_pool();
    let faker = Address::generate(&setup.env);
    setup.pool_client.pause(&faker);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_paused_blocks_deposit() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);

    setup.pool_client.pause(&setup.admin);
    setup.pool_client.deposit(&investor, &1000);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_paused_blocks_anticipation() {
    let setup = setup_pool();
    let hash = make_invoice_hash(&setup.env, 1);

    setup.pool_client.pause(&setup.admin);
    setup.pool_client.register_anticipation(
        &setup.operator, &hash, &1000, &100,
        &(setup.env.ledger().timestamp() + 86400),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_paused_blocks_buy_invoice() {
    let setup = setup_pool();
    let seller = Address::generate(&setup.env);
    let hash = make_invoice_hash(&setup.env, 1);

    setup.pool_client.pause(&setup.admin);
    setup.pool_client.buy_tokenized_invoice(
        &setup.operator, &seller, &hash,
        &50_000_0000000, &47_500_0000000, &100,
        &(setup.env.ledger().timestamp() + 86400),
    );
}

// ===========================================================================
// 6.6 Read-only Tests
// ===========================================================================

#[test]
fn test_get_share_price_empty_pool() {
    let setup = setup_pool();
    let price = setup.pool_client.get_share_price();
    assert_eq!(price, 1_000_000_000, "Empty pool should have price = PRICE_SCALE");
}

#[test]
fn test_get_nav_reflects_deposits_and_interest() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let amount: i128 = 100_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &amount);
    setup.pool_client.deposit(&investor, &amount);

    let nav = setup.pool_client.get_nav();
    assert_eq!(nav, amount, "NAV should equal deposit amount when no principal");
}

#[test]
fn test_get_share_price_increases_after_accrual() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let amount: i128 = 100_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &amount);
    setup.pool_client.deposit(&investor, &amount);

    let hash = make_invoice_hash(&setup.env, 1);
    setup.pool_client.register_anticipation(
        &setup.operator, &hash, &50_000_0000000, &100,
        &(setup.env.ledger().timestamp() + 30 * 86400),
    );

    let price_before = setup.pool_client.get_share_price();
    advance_time(&setup.env, 86400);
    let price_after = setup.pool_client.get_share_price();

    assert!(price_after > price_before, "Share price should increase after interest accrual");
}

#[test]
fn test_get_pool_state_returns_consistent_data() {
    let setup = setup_pool();
    let state = setup.pool_client.get_pool_state();

    assert_eq!(state.total_principal, 0);
    assert_eq!(state.accrued_interest, 0);
    assert_eq!(state.total_shares, 0);
    assert!(!state.paused);
}

// ===========================================================================
// Admin function tests
// ===========================================================================

#[test]
fn test_set_operator() {
    let setup = setup_pool();
    let new_operator = Address::generate(&setup.env);

    setup.pool_client.set_operator(&setup.admin, &new_operator);

    let state = setup.pool_client.get_pool_state();
    assert_eq!(state.operator, new_operator);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_set_operator_unauthorized() {
    let setup = setup_pool();
    let faker = Address::generate(&setup.env);
    let new_operator = Address::generate(&setup.env);

    setup.pool_client.set_operator(&faker, &new_operator);
}
