const { Contract, getAccountByName } = require('secret-polar');

async function run() {
  const owner = getAccountByName('account_0');
  const oracleContract = new Contract('oracle');
  await oracleContract.parseSchema();

  const deploy_response = await oracleContract.deploy(owner);
  console.log(deploy_response);

  const oracleContractInfo = await oracleContract.instantiate(
    { owner: owner.account.address },
    'oracle',
    owner,
  );
  console.log(oracleContractInfo);

  const ex_response = await oracleContract.tx.register_asset(
    { account: owner },
    {
      native_token: {
        denom: 'uscrt',
      },
    },
    owner.account.address,
  );
  console.log(ex_response);
}

module.exports = { default: run };
