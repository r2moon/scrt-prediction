use cosmwasm_std::testing::{mock_dependencies, mock_env};
use cosmwasm_std::{from_binary, log, Binary, Decimal, HumanAddr, StdError, Uint128};

use prediction::{
    asset::AssetInfo,
    prediction::{ConfigResponse, HandleMsg, InitMsg, QueryMsg, State},
};

use crate::{
    contract::{handle, init, query},
    state::Round,
    tests::test_utils::{init_prediction, start_genesis_round},
};

#[test]
fn test_init_failed_if_fee_rate_is_greater_than_100() {
    let mut deps = mock_dependencies(20, &[]);

    let msg = InitMsg {
        operator_addr: HumanAddr::from("operator_addr"),
        treasury_addr: HumanAddr::from("treasury_addr"),
        bet_asset: AssetInfo::NativeToken {
            denom: "sscrt".to_string(),
        },
        oracle_addr: HumanAddr::from("oracle_addr"),
        oracle_code_hash: String::from("oracle_code_hash"),
        fee_rate: Decimal::percent(101),
        interval: 18000,
        grace_interval: 18000,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
    };

    let env = mock_env("addr", &[]);

    let res = init(&mut deps, env, msg).unwrap_err();
    assert_eq!(StdError::generic_err("Invalid fee rate"), res);
}

#[test]
fn test_init_failed_if_grace_interval_is_greater_than_interval() {
    let mut deps = mock_dependencies(20, &[]);

    let msg = InitMsg {
        operator_addr: HumanAddr::from("operator_addr"),
        treasury_addr: HumanAddr::from("treasury_addr"),
        bet_asset: AssetInfo::NativeToken {
            denom: "sscrt".to_string(),
        },
        oracle_addr: HumanAddr::from("oracle_addr"),
        oracle_code_hash: String::from("oracle_code_hash"),
        fee_rate: Decimal::percent(3),
        interval: 18000,
        grace_interval: 18001,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
    };

    let env = mock_env("addr", &[]);

    let res = init(&mut deps, env, msg).unwrap_err();
    assert_eq!(StdError::generic_err("Invalid grace interval"), res);
}

#[test]
fn test_init() {
    let mut deps = mock_dependencies(20, &[]);

    let msg = InitMsg {
        operator_addr: HumanAddr::from("operator_addr"),
        treasury_addr: HumanAddr::from("treasury_addr"),
        bet_asset: AssetInfo::NativeToken {
            denom: "sscrt".to_string(),
        },
        oracle_addr: HumanAddr::from("oracle_addr"),
        oracle_code_hash: String::from("oracle_code_hash"),
        fee_rate: Decimal::percent(5),
        interval: 18000,
        grace_interval: 18000,
        prng_seed: Binary::from("lolz fun yay".as_bytes()),
    };

    let env = mock_env("addr", &[]);

    init(&mut deps, env, msg).unwrap();

    let res = query(&deps, QueryMsg::Config {}).unwrap();
    let config: ConfigResponse = from_binary(&res).unwrap();
    assert_eq!(
        ConfigResponse {
            owner_addr: HumanAddr::from("addr"),
            operator_addr: HumanAddr::from("operator_addr"),
            treasury_addr: HumanAddr::from("treasury_addr"),
            bet_asset: AssetInfo::NativeToken {
                denom: "sscrt".to_string(),
            },
            oracle_addr: HumanAddr::from("oracle_addr"),
            oracle_code_hash: String::from("oracle_code_hash"),
            fee_rate: Decimal::percent(5),
            interval: 18000,
            grace_interval: 18000,
        },
        config
    );

    let res = query(&deps, QueryMsg::State {}).unwrap();
    let state: State = from_binary(&res).unwrap();
    assert_eq!(
        State {
            epoch: Uint128::zero(),
            total_fee: Uint128::zero(),
            paused: true,
        },
        state
    );
}

#[test]
fn test_update_config_failed_if_unauthorized() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    let msg = HandleMsg::UpdateConfig {
        owner_addr: Some(HumanAddr::from("owner_addr1")),
        operator_addr: Some(HumanAddr::from("operator_addr1")),
        treasury_addr: Some(HumanAddr::from("treasury_addr1")),
        oracle_addr: Some(HumanAddr::from("oracle_addr1")),
        oracle_code_hash: Some(String::from("oracle_code_hash1")),
        fee_rate: Some(Decimal::percent(3)),
        interval: Some(20000),
        grace_interval: Some(20000),
    };

    let env = mock_env("addr", &[]);

    let res = handle(&mut deps, env, msg);
    match res {
        Err(StdError::Unauthorized { .. }) => {}
        _ => panic!("Must return unauthorized error"),
    }
}

#[test]
fn test_update_config_failed_if_fee_rate_is_greater_than_100() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    let msg = HandleMsg::UpdateConfig {
        owner_addr: Some(HumanAddr::from("owner_addr1")),
        operator_addr: Some(HumanAddr::from("operator_addr1")),
        treasury_addr: Some(HumanAddr::from("treasury_addr1")),
        oracle_addr: Some(HumanAddr::from("oracle_addr1")),
        oracle_code_hash: Some(String::from("oracle_code_hash1")),
        fee_rate: Some(Decimal::percent(101)),
        interval: Some(20000),
        grace_interval: Some(20000),
    };

    let env = mock_env("owner_addr", &[]);

    let res = handle(&mut deps, env, msg).unwrap_err();
    assert_eq!(StdError::generic_err("Invalid fee rate"), res);
}

#[test]
fn test_update_config_failed_if_grace_interval_is_greater_than_interval() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    let msg = HandleMsg::UpdateConfig {
        owner_addr: Some(HumanAddr::from("owner_addr1")),
        operator_addr: Some(HumanAddr::from("operator_addr1")),
        treasury_addr: Some(HumanAddr::from("treasury_addr1")),
        oracle_addr: Some(HumanAddr::from("oracle_addr1")),
        oracle_code_hash: Some(String::from("oracle_code_hash1")),
        fee_rate: Some(Decimal::percent(4)),
        interval: Some(20000),
        grace_interval: Some(21000),
    };

    let env = mock_env("owner_addr", &[]);

    let res = handle(&mut deps, env, msg).unwrap_err();
    assert_eq!(StdError::generic_err("Invalid grace interval"), res);
}

#[test]
fn test_update_config() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    let msg = HandleMsg::UpdateConfig {
        owner_addr: Some(HumanAddr::from("owner_addr1")),
        operator_addr: Some(HumanAddr::from("operator_addr1")),
        treasury_addr: Some(HumanAddr::from("treasury_addr1")),
        oracle_addr: Some(HumanAddr::from("oracle_addr1")),
        oracle_code_hash: Some(String::from("oracle_code_hash1")),
        fee_rate: Some(Decimal::percent(4)),
        interval: Some(20000),
        grace_interval: Some(19000),
    };

    let env = mock_env("owner_addr", &[]);

    let res = handle(&mut deps, env, msg).unwrap();
    assert_eq!(res.log, vec![log("action", "update_config"),]);

    let res = query(&deps, QueryMsg::Config {}).unwrap();
    let config: ConfigResponse = from_binary(&res).unwrap();
    assert_eq!(
        ConfigResponse {
            owner_addr: HumanAddr::from("owner_addr1"),
            operator_addr: HumanAddr::from("operator_addr1"),
            treasury_addr: HumanAddr::from("treasury_addr1"),
            bet_asset: AssetInfo::NativeToken {
                denom: "sscrt".to_string(),
            },
            oracle_addr: HumanAddr::from("oracle_addr1"),
            oracle_code_hash: String::from("oracle_code_hash1"),
            fee_rate: Decimal::percent(4),
            interval: 20000,
            grace_interval: 19000,
        },
        config
    );
}

#[test]
fn test_start_genesis_round_failed_if_unauthorized() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    let msg = HandleMsg::StartGenesisRound {};

    let env = mock_env("addr", &[]);

    let res = handle(&mut deps, env, msg);
    match res {
        Err(StdError::Unauthorized { .. }) => {}
        _ => panic!("Must return unauthorized error"),
    }
}

#[test]
fn test_start_genesis_round() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    let msg = HandleMsg::StartGenesisRound {};

    let env = mock_env("owner_addr", &[]);

    let res = handle(&mut deps, env.clone(), msg).unwrap();

    assert_eq!(res.log, vec![log("action", "start_genesis_round"),]);

    let res = query(&deps, QueryMsg::State {}).unwrap();
    let state: State = from_binary(&res).unwrap();
    assert_eq!(
        State {
            epoch: Uint128(2),
            total_fee: Uint128::zero(),
            paused: false,
        },
        state
    );

    let res = query(&deps, QueryMsg::Round { epoch: Uint128(1) }).unwrap();
    let genesis_round: Round = from_binary(&res).unwrap();
    assert_eq!(
        Round {
            start_time: env.block.time - 18000,
            lock_time: env.block.time,
            end_time: env.block.time + 18000,
            open_price: None,
            close_price: None,
            total_amount: Uint128::zero(),
            reward_amount: Uint128::zero(),
            up_amount: Uint128::zero(),
            down_amount: Uint128::zero(),
            is_genesis: true,
        },
        genesis_round
    );

    let res = query(&deps, QueryMsg::Round { epoch: Uint128(2) }).unwrap();
    let genesis_round: Round = from_binary(&res).unwrap();
    assert_eq!(
        Round {
            start_time: env.block.time,
            lock_time: env.block.time + 18000,
            end_time: env.block.time + 36000,
            open_price: None,
            close_price: None,
            total_amount: Uint128::zero(),
            reward_amount: Uint128::zero(),
            up_amount: Uint128::zero(),
            down_amount: Uint128::zero(),
            is_genesis: false,
        },
        genesis_round
    );
}

#[test]
fn test_start_genesis_round_failed_if_already_started() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    start_genesis_round(&mut deps);

    let msg = HandleMsg::StartGenesisRound {};

    let env = mock_env("owner_addr", &[]);

    let res = handle(&mut deps, env.clone(), msg).unwrap_err();

    assert_eq!(StdError::generic_err("Running now"), res);
}

#[test]
fn test_pause_failed_if_already_paused() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    let msg = HandleMsg::Pause {};

    let env = mock_env("owner_addr", &[]);

    let res = handle(&mut deps, env.clone(), msg).unwrap_err();

    assert_eq!(StdError::generic_err("Paused"), res);
}

#[test]
fn test_pause_failed_if_unauthorized() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    start_genesis_round(&mut deps);

    let msg = HandleMsg::Pause {};

    let env = mock_env("addr", &[]);

    let res = handle(&mut deps, env, msg);
    match res {
        Err(StdError::Unauthorized { .. }) => {}
        _ => panic!("Must return unauthorized error"),
    }
}

#[test]
fn test_pause() {
    let mut deps = mock_dependencies(20, &[]);

    init_prediction(&mut deps);

    start_genesis_round(&mut deps);

    let msg = HandleMsg::Pause {};

    let env = mock_env("owner_addr", &[]);

    let res = handle(&mut deps, env.clone(), msg).unwrap();

    assert_eq!(res.log, vec![log("action", "pause"),]);

    let res = query(&deps, QueryMsg::State {}).unwrap();
    let state: State = from_binary(&res).unwrap();
    assert_eq!(
        State {
            epoch: Uint128(2),
            total_fee: Uint128::zero(),
            paused: true,
        },
        state
    );
}
