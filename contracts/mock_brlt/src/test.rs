#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup_token(env: &Env) -> (MockBrltTokenClient<'_>, Address) {
    let contract_id = env.register(MockBrltToken, ());
    let client = MockBrltTokenClient::new(env, &contract_id);
    let admin = Address::generate(env);

    client.initialize(
        &admin,
        &String::from_str(env, "Brazilian Real Token"),
        &String::from_str(env, "BRLT"),
        &7,
    );

    (client, admin)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup_token(&env);

    assert_eq!(client.name(), String::from_str(&env, "Brazilian Real Token"));
    assert_eq!(client.symbol(), String::from_str(&env, "BRLT"));
    assert_eq!(client.decimals(), 7);
}

#[test]
#[should_panic]
fn test_double_initialize_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_token(&env);
    client.initialize(
        &admin,
        &String::from_str(&env, "X"),
        &String::from_str(&env, "X"),
        &7,
    );
}

#[test]
fn test_mint_and_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_token(&env);
    let user = Address::generate(&env);

    assert_eq!(client.balance(&user), 0);
    client.mint(&admin, &user, &1_000_000_000);
    assert_eq!(client.balance(&user), 1_000_000_000);
}

#[test]
#[should_panic]
fn test_mint_unauthorized() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup_token(&env);
    let faker = Address::generate(&env);
    let user = Address::generate(&env);

    client.mint(&faker, &user, &1_000);
}

#[test]
fn test_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_token(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.mint(&admin, &alice, &10_000);
    client.transfer(&alice, &bob, &3_000);

    assert_eq!(client.balance(&alice), 7_000);
    assert_eq!(client.balance(&bob), 3_000);
}

#[test]
#[should_panic]
fn test_transfer_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_token(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.mint(&admin, &alice, &100);
    client.transfer(&alice, &bob, &200);
}

#[test]
fn test_approve_and_transfer_from() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_token(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mint(&admin, &owner, &10_000);
    client.approve(&owner, &spender, &5_000, &100_000);

    assert_eq!(client.allowance(&owner, &spender), 5_000);

    client.transfer_from(&spender, &owner, &recipient, &3_000);

    assert_eq!(client.balance(&owner), 7_000);
    assert_eq!(client.balance(&recipient), 3_000);
    assert_eq!(client.allowance(&owner, &spender), 2_000);
}

#[test]
#[should_panic]
fn test_transfer_from_insufficient_allowance() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_token(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mint(&admin, &owner, &10_000);
    client.approve(&owner, &spender, &1_000, &100_000);
    client.transfer_from(&spender, &owner, &recipient, &5_000);
}

#[test]
fn test_burn() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_token(&env);
    let user = Address::generate(&env);

    client.mint(&admin, &user, &10_000);
    assert_eq!(client.balance(&user), 10_000);

    client.burn(&user, &3_000);
    assert_eq!(client.balance(&user), 7_000);
}

#[test]
#[should_panic]
fn test_burn_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_token(&env);
    let user = Address::generate(&env);

    client.mint(&admin, &user, &100);
    client.burn(&user, &200);
}
