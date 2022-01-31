use cosmwasm_std::{CanonicalAddr, StdResult, Storage};
use cosmwasm_storage::{Bucket, ReadonlyBucket, ReadonlySingleton, Singleton};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use prediction::asset::AssetInfoRaw;
use prediction::oracle::PriceInfo;

static KEY_CONFIG: &[u8] = b"config";
static PREFIX_FEEDER: &[u8] = b"prefix_feeder";
static PREFIX_PRICE_INFO: &[u8] = b"prefix_price_info";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub owner: CanonicalAddr,
}

pub fn store_config<S: Storage>(storage: &mut S, data: &Config) -> StdResult<()> {
    Singleton::new(storage, KEY_CONFIG).save(data)
}
pub fn read_config<S: Storage>(storage: &S) -> StdResult<Config> {
    ReadonlySingleton::new(storage, KEY_CONFIG).load()
}

pub fn store_feeder<S: Storage>(
    storage: &mut S,
    asset_info: &AssetInfoRaw,
    feeder: CanonicalAddr,
) -> StdResult<()> {
    Bucket::new(PREFIX_FEEDER, storage).save(asset_info.as_bytes(), &feeder)
}
pub fn read_feeder<S: Storage>(storage: &S, asset_info: &AssetInfoRaw) -> StdResult<CanonicalAddr> {
    ReadonlyBucket::new(PREFIX_FEEDER, storage).load(asset_info.as_bytes())
}

pub fn store_price_info<S: Storage>(
    storage: &mut S,
    asset_info: &AssetInfoRaw,
    price_info: PriceInfo,
) -> StdResult<()> {
    Bucket::new(PREFIX_PRICE_INFO, storage).save(&asset_info.as_bytes(), &price_info)
}
pub fn read_price_info<S: Storage>(storage: &S, asset_info: AssetInfoRaw) -> StdResult<PriceInfo> {
    ReadonlyBucket::new(PREFIX_PRICE_INFO, storage).load(&asset_info.as_bytes())
}
