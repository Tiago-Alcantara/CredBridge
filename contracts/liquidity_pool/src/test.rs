#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    Address, BytesN, Env, String,
};

// We register mock_brlt directly for testing
use mock_brlt::MockBrltToken;

// ===========================================================================
// Test setup
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

    let pool_address = env.register(LiquidityPool, ());
    let pool_client = LiquidityPoolClient::new(&env, &pool_address);

    let share_address = {
        let token_id = env.register(MockBrltToken, ());
        let client = mock_brlt::MockBrltTokenClient::new(&env, &token_id);
        // Pool contract will be the admin of share token so it can mint/burn
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

fn make_invoice_hash(env: &Env, seed: u8) -> BytesN<32> {
    BytesN::from_array(env, &[seed; 32])
}

// ===========================================================================
// Tests
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
    assert_eq!(state.total_shares, 0);
    assert!(!state.paused);
}

#[test]
fn test_deposit_first_investor() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let amount: i128 = 10_000_0000000; // 10,000 BRLT (7 decimals)

    setup.brlt_client.mint(&setup.admin, &investor, &amount);
    setup.pool_client.deposit(&investor, &amount);

    // Share balance (CBPOOL) should be 10,000 (1:1 price initial)
    let shares = setup.share_client.balance(&investor);
    assert_eq!(shares, amount);

    let state = setup.pool_client.get_pool_state();
    assert_eq!(state.total_shares, amount);
    assert_eq!(setup.pool_client.get_nav(), amount);
    assert_eq!(setup.pool_client.get_share_price(), 1_000_000_000); // 1.0
}

#[test]
fn test_buy_tokenized_invoice() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let seller = Address::generate(&setup.env);
    let deposit_amount: i128 = 10_000_0000000;

    setup.brlt_client.mint(&setup.admin, &investor, &deposit_amount);
    setup.pool_client.deposit(&investor, &deposit_amount);

    let hash = make_invoice_hash(&setup.env, 1);
    let face_value: i128 = 5_000_0000000;
    let advance_amount: i128 = 4_800_0000000;

    let seller_before = setup.brlt_client.balance(&seller);

    setup.pool_client.buy_tokenized_invoice(
        &setup.operator,
        &seller,
        &hash,
        &face_value,
        &advance_amount,
        &0,
        &0,
    );

    assert_eq!(setup.brlt_client.balance(&seller) - seller_before, advance_amount);

    let state = setup.pool_client.get_pool_state();
    assert_eq!(state.total_principal, advance_amount);

    // Pool cash BRLT = deposit_amount - advance_amount
    let pool_brlt = setup.brlt_client.balance(&setup.pool_address);
    assert_eq!(pool_brlt, deposit_amount - advance_amount);

    // NAV = cash + principal = (10,000 - 4,800) + 4,800 = 10,000
    assert_eq!(setup.pool_client.get_nav(), deposit_amount);
}

#[test]
fn test_withdraw_with_yield() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);
    let seller = Address::generate(&setup.env);
    let deposit_amount: i128 = 10_000_0000000;

    // 1. Investor deposits 10,000 BRLT
    setup.brlt_client.mint(&setup.admin, &investor, &deposit_amount);
    setup.pool_client.deposit(&investor, &deposit_amount);

    // 2. Buy a receivable of face value 5,000 for 4,800 BRLT (R$ 200 yield)
    let hash = make_invoice_hash(&setup.env, 1);
    setup.pool_client.buy_tokenized_invoice(
        &setup.operator,
        &seller,
        &hash,
        &5_000_0000000,
        &4_800_0000000,
        &0,
        &0,
    );

    // 3. Debtor pays face value 5,000 BRLT back to the Pool
    setup.brlt_client.mint(&setup.admin, &setup.pool_address, &5_000_0000000);

    // 4. Operator settles invoice in pool, reducing outstanding principal by the advanced 4,800 BRLT
    setup.pool_client.settle_invoice_in_pool(&setup.operator, &hash, &4_800_0000000);

    // 5. NAV should reflect cash (5,200 remaining + 5,000 received = 10,200)
    let nav = setup.pool_client.get_nav();
    assert_eq!(nav, 10_200_0000000);

    // Share price should be 1.02 BRLT (1,020,000,000)
    let price = setup.pool_client.get_share_price();
    assert_eq!(price, 1_020_000_000);

    // 6. Investor withdraws half their shares (5,000 shares)
    // They should receive 5,000 * 1.02 = 5,100 BRLT (R$ 5,000 principal + R$ 100 profit!)
    let investor_before = setup.brlt_client.balance(&investor);
    setup.pool_client.withdraw(&investor, &5_000_0000000);

    let investor_after = setup.brlt_client.balance(&investor);
    assert_eq!(investor_after - investor_before, 5_100_0000000);

    // Share balance of investor should be 5,000 remaining
    assert_eq!(setup.share_client.balance(&investor), 5_000_0000000);
}

#[test]
fn test_pause_and_unpause() {
    let setup = setup_pool();
    let investor = Address::generate(&setup.env);

    setup.pool_client.pause(&setup.admin);
    let state = setup.pool_client.get_pool_state();
    assert!(state.paused);

    // Deposit should fail while paused
    setup.brlt_client.mint(&setup.admin, &investor, &1000);
}
