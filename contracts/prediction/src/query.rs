use cosmwasm_std::{
    to_binary, Api, Extern, HumanAddr, Querier, QueryRequest, StdError, StdResult, Storage,
    Uint128, WasmQuery,
};

use crate::state::{
    read_bet, read_config, read_round, read_state, read_viewing_key, Bet, Config, Round,
};
use prediction::{
    oracle::{PriceInfo, QueryMsg as OracleQueryMsg},
    prediction::{ConfigResponse, State},
    viewing_key::ViewingKey,
};

pub fn query_config<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
) -> StdResult<ConfigResponse> {
    let config: Config = read_config(&deps.storage)?;
    let resp = ConfigResponse {
        owner_addr: deps.api.human_address(&config.owner_addr)?,
        operator_addr: deps.api.human_address(&config.operator_addr)?,
        treasury_addr: deps.api.human_address(&config.treasury_addr)?,
        bet_asset: config.bet_asset.to_normal(deps)?,
        oracle_addr: deps.api.human_address(&config.oracle_addr)?,
        oracle_code_hash: config.oracle_code_hash,
        fee_rate: config.fee_rate,
        interval: config.interval,
        grace_interval: config.grace_interval,
    };

    Ok(resp)
}

pub fn query_state<S: Storage, A: Api, Q: Querier>(deps: &Extern<S, A, Q>) -> StdResult<State> {
    let state: State = read_state(&deps.storage)?;
    Ok(state)
}

pub fn query_round<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    epoch: Uint128,
) -> StdResult<Round> {
    let round: Round = read_round(&deps.storage, epoch)?;
    Ok(round)
}

pub fn query_bet<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    epoch: Uint128,
    user: HumanAddr,
    key: String,
) -> StdResult<Bet> {
    let is_valid = validate_viewing_key(deps, user.clone(), key)?;
    if is_valid {
        let bet: Bet = read_bet(&deps.storage, epoch, deps.api.canonical_address(&user)?)?;
        Ok(bet)
    } else {
        Err(StdError::generic_err("Invalid viewing key"))
    }
}

pub fn query_price<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    config: Config,
) -> StdResult<PriceInfo> {
    let price_data: PriceInfo = deps.querier.query(&QueryRequest::Wasm(WasmQuery::Smart {
        contract_addr: deps.api.human_address(&config.oracle_addr)?,
        callback_code_hash: config.oracle_code_hash,
        msg: to_binary(&OracleQueryMsg::LatestPrice {
            asset_info: config.bet_asset.to_normal(&deps)?,
        })?,
    }))?;

    Ok(price_data)
}

fn validate_viewing_key<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    user: HumanAddr,
    key: String,
) -> StdResult<bool> {
    let vk = ViewingKey(key);
    let canonical_addr = deps.api.canonical_address(&user)?;
    let expected_key = read_viewing_key(&deps.storage, &canonical_addr)?;

    Ok(vk.check_viewing_key(&expected_key.to_hashed()))
}
