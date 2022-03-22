use cosmwasm_std::{
    log, Api, Env, Extern, HandleResponse, HandleResult, HumanAddr, Querier, StdError, Storage,
    Uint128,
};

use crate::state::{
    read_bet, read_config, read_round, read_state, store_bet, store_round, store_viewing_key, Bet,
    Config, Round,
};
use prediction::{
    asset::Asset,
    prediction::{Position, State},
    viewing_key::ViewingKey,
};

pub fn bet<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    user: HumanAddr,
    position: Position,
    amount: Uint128,
) -> HandleResult {
    if amount.is_zero() {
        return Err(StdError::generic_err("Amount is zero"));
    }

    let state: State = read_state(&deps.storage)?;
    if state.paused {
        return Err(StdError::generic_err("Paused"));
    }

    let mut round: Round = read_round(&deps.storage, state.epoch)?;

    if round.bettable(env) == false {
        return Err(StdError::generic_err("Cannot bet"));
    }

    let user_bet = read_bet(
        &deps.storage,
        state.epoch,
        deps.api.canonical_address(&user)?,
    );

    if user_bet.is_ok() {
        return Err(StdError::generic_err("Already bet"));
    }

    round.total_amount = round.total_amount + amount;

    if position == Position::Up {
        round.up_amount = round.up_amount + amount;
    } else {
        round.down_amount = round.down_amount + amount;
    }

    store_round(&mut deps.storage, state.epoch, &round)?;

    store_bet(
        &mut deps.storage,
        state.epoch,
        deps.api.canonical_address(&user)?,
        &Bet {
            amount,
            position: position.clone(),
            claimed: false,
        },
    )?;

    Ok(HandleResponse {
        messages: vec![],
        log: vec![
            log("action", "bet"),
            log("amount", amount),
            log("position", position),
        ],
        data: None,
    })
}

pub fn claim<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    epoch: Uint128,
) -> HandleResult {
    let config: Config = read_config(&deps.storage)?;
    let round: Round = read_round(&deps.storage, epoch)?;

    if !round.claimable(env.clone()) && !round.refundable(env.clone(), config.grace_interval) {
        return Err(StdError::generic_err("Not able to claim"));
    }

    let mut user_bet = read_bet(
        &deps.storage,
        epoch,
        deps.api.canonical_address(&env.message.sender)?,
    )?;

    if user_bet.claimed {
        return Err(StdError::generic_err("Already claimed"));
    }

    user_bet.claimed = true;
    store_bet(
        &mut deps.storage,
        epoch,
        deps.api.canonical_address(&env.message.sender)?,
        &user_bet,
    )?;
    let claim_amount = round.claimable_amount(env.clone(), user_bet.clone(), config.grace_interval);

    if claim_amount.is_zero() {
        return Err(StdError::generic_err("Nothing to claim"));
    }

    let return_asset = Asset {
        amount: claim_amount,
        info: config.bet_asset.to_normal(deps)?,
    };

    Ok(HandleResponse {
        messages: vec![return_asset.into_msg(env.contract.address, env.message.sender)?],
        log: vec![
            log("action", "claim"),
            log("epoch", epoch),
            log("amount", user_bet.amount),
            log("claim_amount", claim_amount),
        ],
        data: None,
    })
}

pub fn create_viewing_key<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    entropy: String,
) -> HandleResult {
    let config = read_config(&deps.storage)?;
    let prng_seed = config.prng_seed;

    let key = ViewingKey::new(&env, &prng_seed, (&entropy).as_ref());

    let message_sender = deps.api.canonical_address(&env.message.sender)?;

    store_viewing_key(&mut deps.storage, &message_sender, &key)?;

    Ok(HandleResponse {
        messages: vec![],
        log: vec![log("action", "create_viewing_key"), log("key", key)],
        data: None,
    })
}

pub fn set_viewing_key<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    key: String,
) -> HandleResult {
    let vk = ViewingKey(key);

    let message_sender = deps.api.canonical_address(&env.message.sender)?;

    store_viewing_key(&mut deps.storage, &message_sender, &vk)?;

    Ok(HandleResponse {
        messages: vec![],
        log: vec![log("action", "set_viewing_key"), log("success", true)],
        data: None,
    })
}
