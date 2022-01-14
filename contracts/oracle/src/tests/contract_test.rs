use cosmwasm_std::testing::{mock_dependencies, mock_env};
use cosmwasm_std::{from_binary, log, Decimal, HumanAddr, StdError};
use std::str::FromStr;

use prediction::{
    asset::AssetInfo,
    oracle::{ConfigResponse, HandleMsg, InitMsg, PriceInfo, QueryMsg},
};

use crate::{
    contract::{handle, init, query},
    tests::test_utils::{init_oracle, register_test_assets},
};

#[test]
fn test_init() {
    let mut deps = mock_dependencies(20, &[]);

    let msg = InitMsg {
        owner: HumanAddr::from("owner"),
    };

    let env = mock_env("addr", &[]);

    init(&mut deps, env, msg).unwrap();

    let res = query(&deps, QueryMsg::Config {}).unwrap();
    let config: ConfigResponse = from_binary(&res).unwrap();
    assert_eq!(
        ConfigResponse {
            owner: HumanAddr::from("owner"),
        },
        config
    );
}

#[test]
fn test_update_config_failed_if_unauthorized() {
    let mut deps = mock_dependencies(20, &[]);

    init_oracle(&mut deps);

    let msg = HandleMsg::UpdateConfig {
        owner: Some(HumanAddr::from("owner1")),
    };

    let env = mock_env("addr", &[]);

    let res = handle(&mut deps, env, msg);
    match res {
        Err(StdError::Unauthorized { .. }) => {}
        _ => panic!("Must return unauthorized error"),
    }
}

#[test]
fn test_update_config() {
    let mut deps = mock_dependencies(20, &[]);

    init_oracle(&mut deps);

    let msg = HandleMsg::UpdateConfig {
        owner: Some(HumanAddr::from("owner1")),
    };

    let env = mock_env("owner", &[]);

    let res = handle(&mut deps, env, msg).unwrap();
    assert_eq!(res.log, vec![log("action", "update_config"),]);

    let res = query(&deps, QueryMsg::Config {}).unwrap();
    let config: ConfigResponse = from_binary(&res).unwrap();
    assert_eq!(
        ConfigResponse {
            owner: HumanAddr::from("owner1"),
        },
        config
    );
}

#[test]
fn test_register_asset_failed_if_unauthorized() {
    let mut deps = mock_dependencies(20, &[]);

    init_oracle(&mut deps);

    let msg = HandleMsg::RegisterAsset {
        asset_info: AssetInfo::NativeToken {
            denom: "sscrt".to_string(),
        },
        feeder: HumanAddr::from("feeder"),
    };

    let env = mock_env("addr", &[]);

    let res = handle(&mut deps, env, msg);
    match res {
        Err(StdError::Unauthorized { .. }) => {}
        _ => panic!("Must return unauthorized error"),
    }
}

#[test]
fn test_register_asset_native_token() {
    let mut deps = mock_dependencies(20, &[]);

    init_oracle(&mut deps);

    let msg = HandleMsg::RegisterAsset {
        asset_info: AssetInfo::NativeToken {
            denom: "sscrt".to_string(),
        },
        feeder: HumanAddr::from("feeder"),
    };

    let env = mock_env("owner", &[]);

    let res = handle(&mut deps, env, msg).unwrap();

    assert_eq!(
        res.log,
        vec![
            log("action", "register_asset"),
            log("asset_key", "native_token_sscrt"),
            log("feeder", "feeder")
        ]
    );

    let res = query(
        &deps,
        QueryMsg::Feeder {
            asset_info: AssetInfo::NativeToken {
                denom: "sscrt".to_string(),
            },
        },
    )
    .unwrap();

    let feeder: HumanAddr = from_binary(&res).unwrap();
    assert_eq!(HumanAddr::from("feeder"), feeder);
}

#[test]
fn test_register_asset_snip20_token() {
    let mut deps = mock_dependencies(20, &[]);

    init_oracle(&mut deps);

    let msg = HandleMsg::RegisterAsset {
        asset_info: AssetInfo::Token {
            contract_addr: HumanAddr::from("usdt"),
            token_code_hash: String::from("token_code_hash"),
            viewing_key: String::from("viewing_key"),
        },
        feeder: HumanAddr::from("feeder"),
    };

    let env = mock_env("owner", &[]);

    let res = handle(&mut deps, env, msg).unwrap();

    assert_eq!(
        res.log,
        vec![
            log("action", "register_asset"),
            log("asset_key", "snip20_token_usdt"),
            log("feeder", "feeder")
        ]
    );

    let res = query(
        &deps,
        QueryMsg::Feeder {
            asset_info: AssetInfo::Token {
                contract_addr: HumanAddr::from("usdt"),
                token_code_hash: String::from("token_code_hash"),
                viewing_key: String::from("viewing_key"),
            },
        },
    )
    .unwrap();

    let feeder: HumanAddr = from_binary(&res).unwrap();
    assert_eq!(HumanAddr::from("feeder"), feeder);
}

#[test]
fn test_feed_price_failed_if_unauthorized() {
    let mut deps = mock_dependencies(20, &[]);

    init_oracle(&mut deps);

    register_test_assets(&mut deps);

    let msg = HandleMsg::FeedPrice {
        prices: vec![(
            AssetInfo::NativeToken {
                denom: "sscrt".to_string(),
            },
            Decimal::from_str("0.1").unwrap(),
        )],
    };

    let env = mock_env("addr", &[]);

    let res = handle(&mut deps, env, msg);
    match res {
        Err(StdError::Unauthorized { .. }) => {}
        _ => panic!("Must return unauthorized error"),
    }

    let msg = HandleMsg::FeedPrice {
        prices: vec![
            (
                AssetInfo::NativeToken {
                    denom: "sscrt".to_string(),
                },
                Decimal::from_str("0.1").unwrap(),
            ),
            (
                AssetInfo::NativeToken {
                    denom: "sscrt2".to_string(),
                },
                Decimal::from_str("0.1").unwrap(),
            ),
        ],
    };

    let env = mock_env("feeder1", &[]);

    let res = handle(&mut deps, env, msg);
    match res {
        Err(StdError::Unauthorized { .. }) => {}
        _ => panic!("Must return unauthorized error"),
    }
}

#[test]
fn test_feed_price() {
    let mut deps = mock_dependencies(20, &[]);

    init_oracle(&mut deps);

    register_test_assets(&mut deps);

    let msg = HandleMsg::FeedPrice {
        prices: vec![
            (
                AssetInfo::NativeToken {
                    denom: "sscrt".to_string(),
                },
                Decimal::from_str("0.1").unwrap(),
            ),
            (
                AssetInfo::Token {
                    contract_addr: HumanAddr::from("snip20_test1".to_string()),
                    token_code_hash: String::from("token_code_hash"),
                    viewing_key: String::from("viewing_key"),
                },
                Decimal::from_str("0.3").unwrap(),
            ),
        ],
    };

    let env = mock_env("feeder1", &[]);

    let res = handle(&mut deps, env.clone(), msg).unwrap();
    assert_eq!(
        res.log,
        vec![
            log("action", "feed_price"),
            log("asset_key", "native_token_sscrt"),
            log("price", "0.1"),
            log("asset_key", "snip20_token_snip20_test1"),
            log("price", "0.3")
        ]
    );

    let res = query(
        &deps,
        QueryMsg::LatestPrice {
            asset_info: AssetInfo::NativeToken {
                denom: "sscrt".to_string(),
            },
        },
    )
    .unwrap();

    let price: PriceInfo = from_binary(&res).unwrap();
    assert_eq!(
        PriceInfo {
            price: Decimal::from_str("0.1").unwrap(),
            last_updated_time: env.block.time
        },
        price
    );

    let res = query(
        &deps,
        QueryMsg::LatestPrice {
            asset_info: AssetInfo::Token {
                contract_addr: HumanAddr::from("snip20_test1".to_string()),
                token_code_hash: String::from("token_code_hash"),
                viewing_key: String::from("viewing_key"),
            },
        },
    )
    .unwrap();

    let price: PriceInfo = from_binary(&res).unwrap();
    assert_eq!(
        PriceInfo {
            price: Decimal::from_str("0.3").unwrap(),
            last_updated_time: env.block.time
        },
        price
    );
}
