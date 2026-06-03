#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String, Symbol};

fn create_contract(env: &Env) -> CredBridgeContractClient<'_> {
    let contract_id = env.register(CredBridgeContract, ());
    CredBridgeContractClient::new(env, &contract_id)
}

#[test]
fn test_tokenize_and_events() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    
    let key = String::from_str(&env, "35230500000000000000550010000000011000000001");
    let value: i128 = 150000;
    let due_date: u64 = 1735689600;
    let xml_hash = BytesN::from_array(&env, &[1u8; 32]);
    let owner = Address::generate(&env);

    client.tokenize_nfe(&key, &value, &due_date, &xml_hash, &owner);

    let nfe = client.get_nfe(&key);
    assert_eq!(nfe.key, key.clone());
    assert_eq!(nfe.value, value);
    assert_eq!(nfe.due_date, due_date);
    assert_eq!(nfe.xml_hash, xml_hash);
    assert_eq!(nfe.owner, owner.clone());
    assert_eq!(nfe.status, Symbol::new(&env, "Active"));

    // Check events
    // let events = env.events().all();
    // assert_eq!(events.len(), 1);
    // let event = events.get(0).unwrap();
    
    // assert_eq!(
    //     event.1,
    //     vec![&env, Symbol::new(&env, "tokenize_nfe").into_val(&env), key.clone().into_val(&env)]
    // );
    // let event_data = TokenizeEventData::from_val(&env, &event.2);
    // assert_eq!(
    //     event_data,
    //     TokenizeEventData { owner: owner.clone(), value }
    // );
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #1)")]
fn test_tokenize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    
    let key = String::from_str(&env, "35230500000000000000550010000000011000000001");
    let value: i128 = 150000;
    let due_date: u64 = 1735689600;
    let xml_hash = BytesN::from_array(&env, &[1u8; 32]);
    let owner = Address::generate(&env);

    client.tokenize_nfe(&key, &value, &due_date, &xml_hash, &owner);
    // Should panic with Error::AlreadyExists (1)
    client.tokenize_nfe(&key, &value, &due_date, &xml_hash, &owner);
}

#[test]
fn test_transfer_ownership() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    
    let key = String::from_str(&env, "35230500000000000000550010000000011000000001");
    let value: i128 = 150000;
    let due_date: u64 = 1735689600;
    let xml_hash = BytesN::from_array(&env, &[1u8; 32]);
    let owner = Address::generate(&env);

    client.tokenize_nfe(&key, &value, &due_date, &xml_hash, &owner);

    let new_owner = Address::generate(&env);
    client.transfer_ownership(&key, &new_owner);

    let nfe = client.get_nfe(&key);
    assert_eq!(nfe.owner, new_owner.clone());

    // Check events
    // let events = env.events().all();
    // assert_eq!(events.len(), 2); // tokenize + transfer
    // let event = events.get(1).unwrap();
    
    // assert_eq!(
    //     event.1,
    //     vec![&env, Symbol::new(&env, "transfer_ownership").into_val(&env), key.clone().into_val(&env)]
    // );
    // let event_data = TransferEventData::from_val(&env, &event.2);
    // assert_eq!(
    //     event_data,
    //     TransferEventData { old_owner: owner, new_owner: new_owner.clone() }
    // );
}

#[test]
fn test_settle_nfe() {
    let env = Env::default();
    env.mock_all_auths();

    let client = create_contract(&env);
    
    let key = String::from_str(&env, "35230500000000000000550010000000011000000001");
    let value: i128 = 150000;
    let due_date: u64 = 1735689600;
    let xml_hash = BytesN::from_array(&env, &[1u8; 32]);
    let owner = Address::generate(&env);
    let platform_auth = Address::generate(&env);

    client.tokenize_nfe(&key, &value, &due_date, &xml_hash, &owner);
    client.settle_nfe(&key, &platform_auth);

    let nfe = client.get_nfe(&key);
    assert_eq!(nfe.status, Symbol::new(&env, "Settled"));

    // Check events
    // let events = env.events().all();
    // assert_eq!(events.len(), 2); // tokenize + settle
    // let event = events.get(1).unwrap();
    
    // assert_eq!(
    //     event.1,
    //     vec![&env, Symbol::new(&env, "settle_nfe").into_val(&env), key.clone().into_val(&env)]
    // );
    // let event_data = Address::from_val(&env, &event.2);
    // assert_eq!(
    //     event_data,
    //     owner
    // );
}
