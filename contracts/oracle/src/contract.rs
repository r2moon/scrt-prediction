use cosmwasm_std::{
    log, to_binary, Api, Binary, Decimal, Env, Extern, HandleResponse, HandleResult, HumanAddr,
    InitResponse, Querier, StdError, StdResult, Storage,
};

use crate::state::{
    read_config, read_feeder, read_price_info, store_config, store_feeder, store_price_info, Config,
};
use prediction::{
    asset::AssetInfo,
    oracle::{ConfigResponse, HandleMsg, InitMsg, PriceInfo, QueryMsg},
};

pub fn init<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    _env: Env,
    msg: InitMsg,
) -> StdResult<InitResponse> {
    let config = Config {
        owner: deps.api.canonical_address(&msg.owner)?,
    };

    store_config(&mut deps.storage, &config)?;

    Ok(InitResponse::default())
}

pub fn handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: HandleMsg,
) -> HandleResult {
    match msg {
        HandleMsg::FeedPrice { prices } => feed_price(deps, env, prices),
        msg => {
            assert_owner_privilege(deps, env)?;
            match msg {
                HandleMsg::UpdateConfig { owner } => update_config(deps, owner),
                HandleMsg::RegisterAsset { asset_info, feeder } => {
                    register_asset(deps, asset_info, feeder)
                }
                _ => panic!("do not enter here"),
            }
        }
    }
}

pub fn query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_binary(&query_config(deps)?),
        QueryMsg::Feeder { asset_info } => to_binary(&query_feeder(deps, asset_info)?),
        QueryMsg::LatestPrice { asset_info } => to_binary(&query_latest_price(deps, asset_info)?),
    }
}

fn query_config<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
) -> StdResult<ConfigResponse> {
    let config: Config = read_config(&deps.storage)?;

    Ok(ConfigResponse {
        owner: deps.api.human_address(&config.owner)?,
    })
}

fn query_feeder<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    asset_info: AssetInfo,
) -> StdResult<HumanAddr> {
    let feeder = read_feeder(&deps.storage, &get_asset_key(asset_info))?;

    Ok(deps.api.human_address(&feeder)?)
}

fn query_latest_price<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    asset_info: AssetInfo,
) -> StdResult<PriceInfo> {
    Ok(read_price_info(&deps.storage, get_asset_key(asset_info))?)
}

fn assert_owner_privilege<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    env: Env,
) -> StdResult<()> {
    if read_config(&deps.storage)?.owner != deps.api.canonical_address(&env.message.sender)? {
        return Err(StdError::unauthorized());
    }

    Ok(())
}

fn feed_price<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    prices: Vec<(AssetInfo, Decimal)>,
) -> HandleResult {
    let feeder_raw = deps.api.canonical_address(&env.message.sender)?;

    let mut logs = vec![log("action", "feed_price")];

    for price in prices {
        let asset_key = get_asset_key(price.0);
        if feeder_raw != read_feeder(&deps.storage, &asset_key)? {
            return Err(StdError::unauthorized());
        }

        logs.push(log("asset_key", asset_key.clone()));
        logs.push(log("price", price.1));

        store_price_info(
            &mut deps.storage,
            &asset_key,
            PriceInfo {
                price: price.1,
                last_updated_time: env.block.time,
            },
        )?;
    }

    Ok(HandleResponse {
        messages: vec![],
        log: logs,
        data: None,
    })
}

fn update_config<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    owner: Option<HumanAddr>,
) -> HandleResult {
    let mut config: Config = read_config(&deps.storage)?;

    if let Some(owner) = owner {
        config.owner = deps.api.canonical_address(&owner)?;
    }

    store_config(&mut deps.storage, &config)?;

    Ok(HandleResponse {
        messages: vec![],
        log: vec![log("action", "update_config")],
        data: None,
    })
}

fn register_asset<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    asset_info: AssetInfo,
    feeder: HumanAddr,
) -> HandleResult {
    let asset_key = get_asset_key(asset_info);

    store_feeder(
        &mut deps.storage,
        &asset_key,
        deps.api.canonical_address(&feeder)?,
    )?;

    Ok(HandleResponse {
        messages: vec![],
        log: vec![
            log("action", "register_asset"),
            log("asset_key", asset_key),
            log("feeder", feeder),
        ],
        data: None,
    })
}

fn get_asset_key(asset_info: AssetInfo) -> String {
    match asset_info {
        AssetInfo::NativeToken { denom } => format!("native_token_{}", denom),
        AssetInfo::Token { contract_addr, .. } => {
            format!("snip20_token_{}", contract_addr)
        }
    }
}
