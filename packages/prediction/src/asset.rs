use cosmwasm_std::{
    to_binary, Api, BankMsg, CanonicalAddr, Coin, CosmosMsg, Env, Extern, HumanAddr, Querier,
    StdError, StdResult, Storage, Uint128, WasmMsg,
};
use schemars::JsonSchema;
use secret_toolkit::snip20::HandleMsg;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Asset {
    pub info: AssetInfo,
    pub amount: Uint128,
}

impl Asset {
    pub fn is_native_token(&self) -> bool {
        self.info.is_native_token()
    }

    pub fn into_msg(self, sender: HumanAddr, recipient: HumanAddr) -> StdResult<CosmosMsg> {
        let amount = self.amount;

        match &self.info {
            AssetInfo::Token {
                contract_addr,
                token_code_hash,
                ..
            } => Ok(CosmosMsg::Wasm(WasmMsg::Execute {
                contract_addr: contract_addr.clone(),

                callback_code_hash: token_code_hash.clone(),

                msg: to_binary(&HandleMsg::Send {
                    recipient,
                    amount,
                    padding: None,
                    msg: None,
                })?,
                send: vec![],
            })),
            AssetInfo::NativeToken { denom } => Ok(CosmosMsg::Bank(BankMsg::Send {
                from_address: sender,
                to_address: recipient,
                amount: vec![Coin {
                    denom: denom.into(),
                    amount,
                }],
            })),
        }
    }

    pub fn assert_sent_native_token_balance(&self, env: &Env) -> StdResult<()> {
        if let AssetInfo::NativeToken { denom } = &self.info {
            match env.message.sent_funds.iter().find(|x| x.denom == *denom) {
                Some(coin) => {
                    if self.amount == coin.amount {
                        Ok(())
                    } else {
                        Err(StdError::generic_err("Native token balance mismatch between the argument and the transferred"))
                    }
                }
                None => {
                    if self.amount.is_zero() {
                        Ok(())
                    } else {
                        Err(StdError::generic_err("Native token balance mismatch between the argument and the transferred"))
                    }
                }
            }
        } else {
            Ok(())
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum AssetInfo {
    Token {
        contract_addr: HumanAddr,
        token_code_hash: String,
        viewing_key: String,
    },
    NativeToken {
        denom: String,
    },
}

impl AssetInfo {
    pub fn is_native_token(&self) -> bool {
        match self {
            AssetInfo::NativeToken { .. } => true,
            AssetInfo::Token { .. } => false,
        }
    }

    pub fn to_raw<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &Extern<S, A, Q>,
    ) -> StdResult<AssetInfoRaw> {
        match self {
            AssetInfo::NativeToken { denom } => Ok(AssetInfoRaw::NativeToken {
                denom: denom.to_string(),
            }),
            AssetInfo::Token {
                contract_addr,
                viewing_key,
                token_code_hash,
            } => Ok(AssetInfoRaw::Token {
                contract_addr: deps.api.canonical_address(&contract_addr)?,
                viewing_key: viewing_key.clone(),
                token_code_hash: token_code_hash.clone(),
            }),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub enum AssetInfoRaw {
    Token {
        contract_addr: CanonicalAddr,
        token_code_hash: String,
        viewing_key: String,
    },
    NativeToken {
        denom: String,
    },
}

impl AssetInfoRaw {
    pub fn is_native_token(&self) -> bool {
        match self {
            AssetInfoRaw::NativeToken { .. } => true,
            AssetInfoRaw::Token { .. } => false,
        }
    }

    pub fn to_normal<S: Storage, A: Api, Q: Querier>(
        &self,
        deps: &Extern<S, A, Q>,
    ) -> StdResult<AssetInfo> {
        match self {
            AssetInfoRaw::NativeToken { denom } => Ok(AssetInfo::NativeToken {
                denom: denom.to_string(),
            }),
            AssetInfoRaw::Token {
                contract_addr,
                viewing_key,
                token_code_hash,
            } => Ok(AssetInfo::Token {
                contract_addr: deps.api.human_address(&contract_addr)?,
                viewing_key: viewing_key.clone(),
                token_code_hash: token_code_hash.clone(),
            }),
        }
    }

    pub fn as_bytes(&self) -> &[u8] {
        match self {
            AssetInfoRaw::NativeToken { denom } => denom.as_bytes(),
            AssetInfoRaw::Token { contract_addr, .. } => contract_addr.as_slice(),
        }
    }
}
