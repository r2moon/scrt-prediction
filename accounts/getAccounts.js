const getTestnetAccounts = require('./testnet');
const getMainnetAccounts = require('./mainnet');
const localAccounts = require('./local');

const getAccounts = (network) => {
  if (network === 'testnet') {
    return getTestnetAccounts();
  } else if (network === 'mainnet') {
    return getMainnetAccounts();
  } else if (network === 'local') {
    return localAccounts;
  } else {
    throw Error('Unsupported network');
  }
};

module.exports = getAccounts;
