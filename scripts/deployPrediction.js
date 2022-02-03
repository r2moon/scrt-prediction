const { Contract, getAccountByName } = require('secret-polar');

const feeRate = 0.03;
const oracle = 'secret19hd5ywtp9uqczw8e40vq0psgn9zefey02n806e';
const oracleCodeHash =
  'dbb7831c90a5d1ea5dfeb82268f763ff682ca805564b2489f1311980038877ed';
const operator = 'secret1dd369u6er80ntdnk75a8hn0g5f92u8z2mszj34';
const treasury = 'secret1dd369u6er80ntdnk75a8hn0g5f92u8z2mszj34';
const assetInfo = {
  native_token: {
    denom: 'uscrt',
  },
};
const interval = 300;
const graceInterval = 300;

async function run() {
  const owner = getAccountByName('account_0');
  const predictionContract = new Contract('price_prediction');
  await predictionContract.parseSchema();

  const deploy_response = await predictionContract.deploy(owner, {
    amount: [{ amount: '750000', denom: 'uscrt' }],
    gas: '3000000',
  });
  console.log(deploy_response);

  const predictionContractInfo = await predictionContract.instantiate(
    {
      operator_addr: operator,
      treasury_addr: treasury,
      bet_asset: assetInfo,
      oracle_addr: oracle,
      oracle_code_hash: oracleCodeHash,
      fee_rate: feeRate.toString(),
      interval,
      grace_interval: graceInterval,
    },
    'scrt prediction',
    owner,
  );
  console.log(predictionContractInfo);
}

module.exports = { default: run };
