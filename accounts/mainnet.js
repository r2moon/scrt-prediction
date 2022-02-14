const dotenv = require('dotenv');
dotenv.config();

const getAccounts = () => {
  const MNEMONIC = process.env.MAINNET_MNEMONIC;
  if (!MNEMONIC) {
    throw Error('No mainnet mnemonic exists');
  }

  const ADDRESS = process.env.MAINNET_ADDRESS;
  if (!ADDRESS) {
    throw Error('No mainnet address exists');
  }

  return [
    {
      name: 'account_0',
      address: ADDRESS,
      mnemonic: MNEMONIC,
    },
  ];
};

module.exports = getAccounts;
