const { expect } = require('chai');
const BN = require('bn.js');

const checkLogs = (response, logs) => {
  const event = response.logs[0].events.find((item) => item.type === 'wasm');
  for (let i = 0; i < Object.keys(logs).length; i += 1) {
    let key = Object.keys(logs)[i];
    expect(event.attributes[i + 1].key).to.be.equal(key);
    expect(event.attributes[i + 1].value).to.be.equal(logs[key]);
  }
};

const bet = async (
  predictionContract,
  account,
  amount,
  position,
  assetInfo,
) => {
  if (assetInfo.native_token) {
    await predictionContract.tx.bet(
      {
        account,
        transferAmount: [
          {
            amount,
            denom: assetInfo.native_token.denom,
          },
        ],
      },
      position,
    );
  }
};

const sleep = (s) => new Promise((res) => setTimeout(res, s * 1000));

const sleepUntil = async (until) => {
  if (Date.now() / 1000 < until) {
    await sleep(until - Math.ceil(Date.now() / 1000) + 3);
  }
};

const getScrtBalance = async (account) => {
  const balances = await account.getBalance();
  const coin = balances.find((item) => item.denom === 'uscrt');
  if (coin) {
    return new BN(coin.amount);
  }
  return new BN(0);
};

const getScrtBalanceWithCustomClient = async (client, account) => {
  const info = await client.getAccount(account.account.address);
  console.log(info);
  if (info === undefined || info.balance === undefined) {
    return new BN(0);
  }

  const coin = info.balance.find((item) => item.denom === 'uscrt');
  if (coin) {
    return new BN(coin.amount);
  }
  return new BN(0);
};

module.exports = {
  checkLogs,
  bet,
  sleep,
  sleepUntil,
  getScrtBalance,
  getScrtBalanceWithCustomClient,
};
