use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::asset::AssetInfo;
use cosmwasm_std::{Binary, Decimal, HumanAddr, Uint128};
use secret_toolkit::permit::Permit;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InitMsg {
    /// Operator address
    pub operator_addr: HumanAddr,
    /// Treasury address
    pub treasury_addr: HumanAddr,
    /// Asset to bet
    pub bet_asset: AssetInfo,
    /// Price oracle address
    pub oracle_addr: HumanAddr,
    /// Price oracle code hash
    pub oracle_code_hash: String,
    /// Fee rate
    pub fee_rate: Decimal,
    /// Interval of each round in seconds
    pub interval: u64,
    /// Grace interval to execute round
    pub grace_interval: u64,
    /// PRNG seed
    pub prng_seed: Binary,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum HandleMsg {
    Receive {
        from: HumanAddr,
        msg: Option<Binary>,
        amount: Uint128,
    },
    /// Update configuration
    UpdateConfig {
        owner_addr: Option<HumanAddr>,
        operator_addr: Option<HumanAddr>,
        treasury_addr: Option<HumanAddr>,
        oracle_addr: Option<HumanAddr>,
        oracle_code_hash: Option<String>,
        fee_rate: Option<Decimal>,
        interval: Option<u64>,
        grace_interval: Option<u64>,
    },
    /// Bet
    Bet { position: Position },
    /// Claim winner reward
    Claim { epoch: Uint128 },
    /// Finish ongoing round, lock betting round and start new round
    ExecuteRound {},
    /// Withdraw performance fee to treasury
    Withdraw {},
    /// Pause
    Pause {},
    /// Start genesis round
    StartGenesisRound {},
    /// Create viewing key
    CreateViewingKey {
        entropy: String,
        padding: Option<String>,
    },
    /// Set viewing key
    SetViewingKey {
        key: String,
        padding: Option<String>,
    },
    /// Revoke Permit
    RevokePermit {
        permit_name: String,
        padding: Option<String>,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Cw20HookMsg {
    Bet { position: Position },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    /// Query current configuration
    Config {},
    /// Query current state
    State {},
    /// Query round by epoch
    Round { epoch: Uint128 },
    /// Query bet by user and epoch
    Bet {
        epoch: Uint128,
        user: HumanAddr,
        key: String,
    },
    /// Query with permit
    WithPermit {
        permit: Permit,
        query: QueryWithPermit,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryWithPermit {
    Bet { epoch: Uint128 },
}

// We define a custom struct for each query response
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ConfigResponse {
    pub contract_addr: HumanAddr,
    pub owner_addr: HumanAddr,
    pub operator_addr: HumanAddr,
    pub treasury_addr: HumanAddr,
    pub bet_asset: AssetInfo,
    pub oracle_addr: HumanAddr,
    pub oracle_code_hash: String,
    pub fee_rate: Decimal,
    pub interval: u64,
    pub grace_interval: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Position {
    Up,
    Down,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct State {
    pub epoch: Uint128,
    pub total_fee: Uint128,
    pub paused: bool,
}

impl ToString for Position {
    fn to_string(&self) -> String {
        if self == &Position::Up {
            String::from("up")
        } else {
            String::from("down")
        }
    }
}
