use cosmwasm_std::testing::{mock_env, MockApi, MockQuerier, MockStorage};
use cosmwasm_std::{Extern, HumanAddr};

use prediction::{
    asset::AssetInfo,
    oracle::{HandleMsg, InitMsg},
};

use crate::contract::{handle, init};

pub fn init_oracle(deps: &mut Extern<MockStorage, MockApi, MockQuerier>) {
    let msg = InitMsg {
        owner: HumanAddr::from("owner"),
    };

    let env = mock_env("owner_addr", &[]);

    init(deps, env, msg).unwrap();
}

fn register_native_token(
    deps: &mut Extern<MockStorage, MockApi, MockQuerier>,
    denom: String,
    feeder: HumanAddr,
) {
    let msg = HandleMsg::RegisterAsset {
        asset_info: AssetInfo::NativeToken { denom },
        feeder,
    };

    let env = mock_env("owner", &[]);

    handle(deps, env, msg).unwrap();
}

fn register_snip20_token(
    deps: &mut Extern<MockStorage, MockApi, MockQuerier>,
    contract_addr: HumanAddr,
    feeder: HumanAddr,
) {
    let msg = HandleMsg::RegisterAsset {
        asset_info: AssetInfo::Token {
            contract_addr,
            token_code_hash: String::from("token_code_hash"),
            viewing_key: String::from("viewing_key"),
        },
        feeder,
    };

    let env = mock_env("owner", &[]);

    handle(deps, env, msg).unwrap();
}

pub fn register_test_assets(deps: &mut Extern<MockStorage, MockApi, MockQuerier>) {
    register_native_token(deps, "sscrt".to_string(), HumanAddr::from("feeder1"));
    register_native_token(deps, "sscrt2".to_string(), HumanAddr::from("feeder2"));
    register_snip20_token(
        deps,
        HumanAddr::from("snip20_test1".to_string()),
        HumanAddr::from("feeder1"),
    );
    register_snip20_token(
        deps,
        HumanAddr::from("snip20_test2".to_string()),
        HumanAddr::from("feeder2"),
    );
}
