use cosmwasm_std::{CanonicalAddr, Decimal, Env, StdResult, Storage, Uint128};
use cosmwasm_storage::{Bucket, ReadonlyBucket, ReadonlySingleton, Singleton};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use prediction::{
    asset::AssetInfoRaw,
    prediction::{Position, State},
    viewing_key::ViewingKey,
};

static KEY_CONFIG: &[u8] = b"config";
static KEY_STATE: &[u8] = b"state";
static PREFIX_ROUND: &[u8] = b"round";
pub const PREFIX_VIEW_KEY: &[u8] = b"viewingkey";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub owner_addr: CanonicalAddr,
    pub operator_addr: CanonicalAddr,
    pub treasury_addr: CanonicalAddr,
    pub bet_asset: AssetInfoRaw,
    pub oracle_addr: CanonicalAddr,
    pub oracle_code_hash: String,
    pub fee_rate: Decimal,
    pub interval: u64,
    pub grace_interval: u64,
    pub prng_seed: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Round {
    pub start_time: u64,
    pub lock_time: u64,
    pub end_time: u64,
    pub open_price: Option<Decimal>,
    pub close_price: Option<Decimal>,
    pub total_amount: Uint128,
    pub reward_amount: Uint128,
    pub up_amount: Uint128,
    pub down_amount: Uint128,
    pub is_genesis: bool,
}

impl Round {
    pub fn bettable(&self, env: Env) -> bool {
        !self.is_genesis
            && env.block.time >= self.start_time
            && env.block.time <= self.lock_time
            && self.open_price.is_none()
    }

    pub fn claimable(&self, env: Env) -> bool {
        env.block.time >= self.end_time
            && self.open_price.is_some()
            && self.close_price.is_some()
            && Some(self.open_price) != Some(self.close_price)
    }

    pub fn refundable(&self, env: Env, grace_interval: u64) -> bool {
        (env.block.time >= self.end_time
            && self.open_price.is_some()
            && self.close_price.is_some()
            && Some(self.open_price) == Some(self.close_price))
            || (self.close_price.is_none() && env.block.time > self.end_time + grace_interval)
            || (env.block.time > self.lock_time
                && (self.up_amount.is_zero() || self.down_amount.is_zero()))
    }

    pub fn claimable_amount(&self, env: Env, user_bet: Bet, grace_interval: u64) -> Uint128 {
        if self.claimable(env.clone()) {
            let win_bet_amount = if Some(self.close_price) > Some(self.open_price)
                && user_bet.position == Position::Up
            {
                self.up_amount
            } else if Some(self.close_price) < Some(self.open_price)
                && user_bet.position == Position::Down
            {
                self.down_amount
            } else {
                Uint128::zero()
            };

            if win_bet_amount.is_zero() {
                Uint128::zero()
            } else {
                self.reward_amount * Decimal::from_ratio(user_bet.amount, win_bet_amount)
            }
        } else if self.refundable(env, grace_interval) {
            user_bet.amount
        } else {
            Uint128::zero()
        }
    }

    pub fn executable(&self, env: Env) -> bool {
        env.block.time >= self.end_time
            && (self.is_genesis || self.open_price.is_some())
            && self.close_price.is_none()
    }

    pub fn expired(&self, env: Env, grace_interval: u64) -> bool {
        env.block.time > self.end_time + grace_interval && self.close_price.is_none()
    }

    // pub fn win_position(&self) -> Position {
    //     if Some(self.open_price) > Some(self.close_price) {
    //         Position::Down
    //     } else if Some(self.open_price) > Some(self.close_price) {
    //         Position::Up
    //     } else {
    //         Position::DRAW
    //     }
    // }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Bet {
    pub amount: Uint128,
    pub position: Position,
    pub claimed: bool,
}

pub fn store_config<S: Storage>(storage: &mut S, data: &Config) -> StdResult<()> {
    Singleton::new(storage, KEY_CONFIG).save(data)
}
pub fn read_config<S: Storage>(storage: &S) -> StdResult<Config> {
    ReadonlySingleton::new(storage, KEY_CONFIG).load()
}

pub fn store_state<S: Storage>(storage: &mut S, data: &State) -> StdResult<()> {
    Singleton::new(storage, KEY_STATE).save(data)
}
pub fn read_state<S: Storage>(storage: &S) -> StdResult<State> {
    ReadonlySingleton::new(storage, KEY_STATE).load()
}

pub fn store_round<S: Storage>(storage: &mut S, epoch: Uint128, data: &Round) -> StdResult<()> {
    Bucket::new(PREFIX_ROUND, storage).save(&epoch.u128().to_be_bytes(), data)
}
pub fn read_round<S: Storage>(storage: &S, epoch: Uint128) -> StdResult<Round> {
    ReadonlyBucket::new(PREFIX_ROUND, storage).load(&epoch.u128().to_be_bytes())
}

pub fn store_bet<S: Storage>(
    storage: &mut S,
    epoch: Uint128,
    user: CanonicalAddr,
    data: &Bet,
) -> StdResult<()> {
    Bucket::new(PREFIX_ROUND, storage).save(
        &[user.as_slice(), &epoch.u128().to_be_bytes()].concat(),
        data,
    )
}

pub fn read_bet<S: Storage>(storage: &S, epoch: Uint128, user: CanonicalAddr) -> StdResult<Bet> {
    ReadonlyBucket::new(PREFIX_ROUND, storage)
        .load(&[user.as_slice(), &epoch.u128().to_be_bytes()].concat())
}

pub fn store_viewing_key<S: Storage>(
    storage: &mut S,
    user: &CanonicalAddr,
    key: &ViewingKey,
) -> StdResult<()> {
    Bucket::new(PREFIX_VIEW_KEY, storage).save(&user.as_slice(), key)
}

pub fn read_viewing_key<S: Storage>(storage: &S, user: &CanonicalAddr) -> StdResult<ViewingKey> {
    ReadonlyBucket::new(PREFIX_VIEW_KEY, storage).load(&user.as_slice())
}
