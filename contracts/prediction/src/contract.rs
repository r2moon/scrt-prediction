use cosmwasm_std::{
    from_binary, to_binary, Api, Binary, Decimal, Env, Extern, HandleResult, HumanAddr,
    InitResponse, Querier, StdError, StdResult, Storage, Uint128,
};

use crate::handler::{bet, claim, create_viewing_key, set_viewing_key};
use crate::manage::{execute_round, pause, start_genesis_round, update_config, withdraw};
use crate::query::{query_bet, query_config, query_round, query_state};
use crate::state::{read_config, store_config, store_state, Config};
use prediction::{
    asset::AssetInfoRaw,
    prediction::{Cw20HookMsg, HandleMsg, InitMsg, Position, QueryMsg, State},
    rand::sha_256,
};

pub fn init<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: InitMsg,
) -> StdResult<InitResponse> {
    if msg.fee_rate > Decimal::one() {
        return Err(StdError::generic_err("Invalid fee rate"));
    }

    if msg.grace_interval > msg.interval {
        return Err(StdError::generic_err("Invalid grace interval"));
    }

    let prng_seed_hashed = sha_256(&msg.prng_seed.0);

    let config = Config {
        owner_addr: deps.api.canonical_address(&env.message.sender)?,
        operator_addr: deps.api.canonical_address(&msg.operator_addr)?,
        treasury_addr: deps.api.canonical_address(&msg.treasury_addr)?,
        bet_asset: msg.bet_asset.to_raw(deps)?,
        oracle_addr: deps.api.canonical_address(&msg.oracle_addr)?,
        oracle_code_hash: msg.oracle_code_hash,
        fee_rate: msg.fee_rate,
        interval: msg.interval,
        grace_interval: msg.grace_interval,
        prng_seed: prng_seed_hashed.to_vec(),
    };

    store_config(&mut deps.storage, &config)?;

    store_state(
        &mut deps.storage,
        &State {
            epoch: Uint128::zero(),
            total_fee: Uint128::zero(),
            paused: true,
        },
    )?;

    Ok(InitResponse::default())
}

pub fn handle<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    msg: HandleMsg,
) -> HandleResult {
    match msg {
        HandleMsg::Receive { amount, msg, from } => receive_cw20(deps, env, from, amount, msg),
        HandleMsg::Bet { position } => try_bet(deps, env, position),
        HandleMsg::UpdateConfig {
            owner_addr,
            operator_addr,
            treasury_addr,
            oracle_addr,
            oracle_code_hash,
            fee_rate,
            interval,
            grace_interval,
        } => update_config(
            deps,
            env,
            owner_addr,
            operator_addr,
            treasury_addr,
            oracle_addr,
            oracle_code_hash,
            fee_rate,
            interval,
            grace_interval,
        ),
        HandleMsg::Claim { epoch } => claim(deps, env, epoch),
        HandleMsg::Withdraw {} => withdraw(deps, env),
        HandleMsg::ExecuteRound {} => execute_round(deps, env),
        HandleMsg::Pause {} => pause(deps, env),
        HandleMsg::StartGenesisRound {} => start_genesis_round(deps, env),
        HandleMsg::CreateViewingKey { entropy, .. } => create_viewing_key(deps, env, entropy),
        HandleMsg::SetViewingKey { key, .. } => set_viewing_key(deps, env, key),
    }
}

fn receive_cw20<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    //todo: figure out if this is "from" or "sender"
    from: HumanAddr,
    amount: Uint128,
    msg: Option<Binary>,
) -> HandleResult {
    if let Some(bin_msg) = msg {
        match from_binary(&bin_msg)? {
            Cw20HookMsg::Bet { position } => {
                let config = read_config(&deps.storage)?;
                match config.bet_asset {
                    AssetInfoRaw::NativeToken { .. } => Err(StdError::generic_err("invalid asset")),
                    AssetInfoRaw::Token { contract_addr, .. } => {
                        if env.message.sender == deps.api.human_address(&contract_addr)? {
                            bet(deps, env, from, position, amount)
                        } else {
                            Err(StdError::generic_err("invalid asset"))
                        }
                    }
                }
            }
        }
    } else {
        Err(StdError::generic_err("data should be given"))
    }
}

fn try_bet<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    position: Position,
) -> HandleResult {
    let config = read_config(&deps.storage)?;

    match config.bet_asset {
        AssetInfoRaw::NativeToken { denom } => {
            let amount: Uint128 = env
                .message
                .sent_funds
                .iter()
                .find(|c| c.denom == denom)
                .map(|c| Uint128::from(c.amount))
                .unwrap_or_else(Uint128::zero);
            bet(deps, env.clone(), env.message.sender, position, amount)
        }
        AssetInfoRaw::Token { .. } => Err(StdError::generic_err("invalid asset")),
    }
}

pub fn query<S: Storage, A: Api, Q: Querier>(
    deps: &Extern<S, A, Q>,
    msg: QueryMsg,
) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_binary(&query_config(deps)?),
        QueryMsg::State {} => to_binary(&query_state(deps)?),
        QueryMsg::Round { epoch } => to_binary(&query_round(deps, epoch)?),
        QueryMsg::Bet { epoch, user } => to_binary(&query_bet(deps, epoch, user)?),
    }
}
