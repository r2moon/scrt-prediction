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

const betSnip20 = async (
  snip20Contract,
  predictionContract,
  account,
  amount,
  position,
) => {
  const msgJson = {
    bet: {
      position,
    },
  };
  const msgBinary = Buffer.from(JSON.stringify(msgJson)).toString('base64');
  await snip20Contract.tx.send(
    {
      account,
    },
    amount, // amount
    null, // memo,
    msgBinary, // msg,
    null, // padding,
    predictionContract.contractAddress,
    predictionContract.contractCodeHash,
  );
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

const getScrtBalanceWithCustomClient = async (secretjs, account) => {
  const response = await secretjs.query.bank.balance({
    address: account.account.address,
    denom: 'uscrt',
  });

  if (response.balance) {
    return new BN(response.balance.amount);
  } else {
    return new BN(0);
  }
};

const sendDenom = async (secretjs, from, to, amount) => {
  for (let toAddress of to) {
    await secretjs.tx.bank.send(
      {
        fromAddress: from,
        toAddress,
        amount: [{ denom: 'uscrt', amount: amount }],
      },
      {
        gasLimit: 200_000,
      },
    );
  }
};

const getSnip20Balance = async (snip20Contract, account, viewingKey) => {
  const balanceRes = await snip20Contract.query.balance(
    account.account.address,
    viewingKey,
  );

  return new BN(balanceRes.balance.amount);
};

module.exports = {
  checkLogs,
  bet,
  betSnip20,
  sleep,
  sleepUntil,
  getScrtBalance,
  getScrtBalanceWithCustomClient,
  getSnip20Balance,
  sendDenom,
};
