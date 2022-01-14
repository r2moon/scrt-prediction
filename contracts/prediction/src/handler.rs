use cosmwasm_std::{
    log, Api, Env, Extern, HandleResponse, HandleResult, HumanAddr, Querier, StdError, Storage,
    Uint128,
};

use crate::state::{
    read_bet, read_config, read_round, read_state, store_bet, store_round, Bet, Config, Round,
};
use prediction::{
    asset::Asset,
    prediction::{Position, State},
};

pub fn bet<S: Storage, A: Api, Q: Querier>(
    deps: &mut Extern<S, A, Q>,
    env: Env,
    user: HumanAddr,
    position: Position,
    amount: Uint128,
) -> HandleResult {
    let state: State = read_state(&deps.storage)?;
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

    if position == Position::UP {
        round.up_amount = round.up_amount + amount;
    } else if position == Position::DOWN {
        round.down_amount = round.down_amount + amount;
    } else {
        return Err(StdError::generic_err("Cannot bet DRAW"));
    }

    store_round(&mut deps.storage, state.epoch, &round)?;

    store_bet(
        &mut deps.storage,
        state.epoch,
        deps.api.canonical_address(&user)?,
        &Bet {
            amount,
            position,
            claimed: false,
        },
    )?;

    Ok(HandleResponse {
        messages: vec![],
        log: vec![log("action", "bet"), log("amount", amount)],
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
        return Err(StdError::generic_err("Round is not closed"));
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
    let claim_amount = round.claimable_amount(env.clone(), user_bet, config.grace_interval);

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
            log("amount", claim_amount),
        ],
        data: None,
    })
}
