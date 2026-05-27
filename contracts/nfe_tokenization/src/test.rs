#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String, Symbol};

fn create_contract<'a>(env: &'a Env, platform: &'a Address) -> CredBridgeContractClient<'a> {
    let uri = String::from_str(env, "https://credbridge.io/nfe/");
    let name = String::from_str(env, "CredBridge NF-e");
    let symbol = String::from_str(env, "CBNFE");
    let contract_id = env.register(CredBridgeContract, (uri, name, symbol, platform.clone()));
    CredBridgeContractClient::new(env, &contract_id)
}

fn tokenize_sample_nfe(
    env: &Env,
    client: &CredBridgeContractClient<'_>,
    owner: &Address,
    platform: &Address,
) -> String {
    let key = String::from_str(env, "35230500000000000000550010000000011000000001");
    let value: i128 = 150000;
    let due_date: u64 = 1735689600;
    let xml_hash = BytesN::from_array(env, &[1u8; 32]);

    client.tokenize_nfe(&key, &value, &due_date, &xml_hash, owner, platform);
    key
}

// ===========================================================================
// Tokenization Tests & NFT Properties
// ===========================================================================

#[test]
fn test_tokenize_and_read() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    // Verificar dados no storage persistente
    let nfe = client.get_nfe(&key);
    assert_eq!(nfe.key, key.clone());
    assert_eq!(nfe.value, 150000);
    assert_eq!(nfe.owner, owner.clone());
    assert_eq!(nfe.status, Symbol::new(&env, "Active"));
    assert_eq!(nfe.invoice_hash, BytesN::from_array(&env, &[1u8; 32]));
    assert_eq!(nfe.rate_bps, 0);
    assert_eq!(nfe.advance_amount, 0);

    // Verificar propriedades do NFT padrão SEP-50
    assert_eq!(client.balance(&owner), 1);
    assert_eq!(client.owner_of(&nfe.token_id), owner.clone());
    assert_eq!(client.token_uri(&nfe.token_id), String::from_str(&env, "https://credbridge.io/nfe/0"));

    // Lookup reverso pelo Token ID
    let lookup_nfe = client.get_nfe_by_token_id(&nfe.token_id);
    assert_eq!(lookup_nfe.key, key);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_tokenize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    tokenize_sample_nfe(&env, &client, &owner, &platform);
    // Tenta duplicar
    tokenize_sample_nfe(&env, &client, &owner, &platform);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_tokenize_duplicate_xml_hash_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    tokenize_sample_nfe(&env, &client, &owner, &platform);

    // Tentar com chave diferente, mas mesmo XML hash
    let key2 = String::from_str(&env, "different-key-same-xml");
    let value: i128 = 150000;
    let due_date: u64 = 1735689600;
    let xml_hash = BytesN::from_array(&env, &[1u8; 32]); // Mesmo hash do anterior

    client.tokenize_nfe(&key2, &value, &due_date, &xml_hash, &owner, &platform);
}

// ===========================================================================
// Transfer Tests & Platform Restrictions
// ===========================================================================

#[test]
fn test_transfer_ownership() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);
    let nfe_before = client.get_nfe(&key);

    let new_owner = Address::generate(&env);
    client.transfer_ownership(&key, &new_owner, &platform);

    // Verificar atualização do storage
    let nfe_after = client.get_nfe(&key);
    assert_eq!(nfe_after.owner, new_owner);

    // Verificar atualização de propriedade do NFT
    assert_eq!(client.balance(&owner), 0);
    assert_eq!(client.balance(&new_owner), 1);
    assert_eq!(client.owner_of(&nfe_before.token_id), new_owner);
}



// ===========================================================================
// Settle Tests
// ===========================================================================

#[test]
fn test_settle_nfe_burns_nft() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);
    let nfe = client.get_nfe(&key);

    assert_eq!(client.balance(&owner), 1);

    client.settle_nfe(&key, &platform);

    // Status deve ser "Settled"
    let nfe_after = client.get_nfe(&key);
    assert_eq!(nfe_after.status, Symbol::new(&env, "Settled"));

    // O NFT deve ter sido destruído/queimado
    assert_eq!(client.balance(&owner), 0);
}

#[test]
fn test_settle_sold_nfe() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    // List for sale
    client.list_invoice_for_sale(
        &owner, &key, &150000, &142500, &100, &1735689600,
    );
    // Mark as sold
    client.mark_as_sold(&key, &platform);

    // Settle from SoldToPool status
    client.settle_nfe(&key, &platform);
    let nfe = client.get_nfe(&key);
    assert_eq!(nfe.status, Symbol::new(&env, "Settled"));
}

// ===========================================================================
// Invoice Sale Flow Tests
// ===========================================================================

#[test]
fn test_list_invoice_for_sale() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    client.list_invoice_for_sale(
        &owner,
        &key,
        &150000,  // face value
        &142500,  // advance (95%)
        &100,     // 1% daily rate
        &1735689600,
    );

    let nfe = client.get_nfe(&key);
    assert_eq!(nfe.status, Symbol::new(&env, "ListedForSale"));
    assert_eq!(nfe.rate_bps, 100);
    assert_eq!(nfe.advance_amount, 142500);

    // Check sale listing data
    let listing = client.get_sale_listing(&key);
    assert_eq!(listing.owner, owner);
    assert_eq!(listing.face_value, 150000);
    assert_eq!(listing.requested_advance_amount, 142500);
    assert_eq!(listing.requested_rate_bps, 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_list_invoice_wrong_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);
    let faker = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    // faker tries to list — should fail
    client.list_invoice_for_sale(
        &faker, &key, &150000, &142500, &100, &1735689600,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_list_invoice_already_listed() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    client.list_invoice_for_sale(&owner, &key, &150000, &142500, &100, &1735689600);
    // Try listing again — should fail
    client.list_invoice_for_sale(&owner, &key, &150000, &142500, &100, &1735689600);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_list_invoice_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    // advance > face value
    client.list_invoice_for_sale(&owner, &key, &100000, &200000, &100, &1735689600);
}

#[test]
fn test_mark_as_sold() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    client.list_invoice_for_sale(&owner, &key, &150000, &142500, &100, &1735689600);
    client.mark_as_sold(&key, &platform);

    let nfe = client.get_nfe(&key);
    assert_eq!(nfe.status, Symbol::new(&env, "SoldToPool"));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_mark_as_sold_not_listed() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    // Try to mark as sold without listing first
    client.mark_as_sold(&key, &platform);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_mark_as_sold_already_sold() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    client.list_invoice_for_sale(&owner, &key, &150000, &142500, &100, &1735689600);
    client.mark_as_sold(&key, &platform);
    // Try marking as sold again
    client.mark_as_sold(&key, &platform);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_cannot_list_sold_invoice() {
    let env = Env::default();
    env.mock_all_auths();

    let platform = Address::generate(&env);
    let client = create_contract(&env, &platform);
    let owner = Address::generate(&env);

    let key = tokenize_sample_nfe(&env, &client, &owner, &platform);

    client.list_invoice_for_sale(&owner, &key, &150000, &142500, &100, &1735689600);
    client.mark_as_sold(&key, &platform);

    // Try to list again after sold — should fail
    client.list_invoice_for_sale(&owner, &key, &150000, &142500, &100, &1735689600);
}
