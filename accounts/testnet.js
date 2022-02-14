const dotenv = require('dotenv');
dotenv.config();

const getAccounts = () => {
  const MNEMONIC = process.env.TESTNET_MNEMONIC;
  if (!MNEMONIC) {
    throw Error('No testnet mnemonic exists');
  }

  const ADDRESS = process.env.TESTNET_ADDRESS;
  if (!ADDRESS) {
    throw Error('No testnet address exists');
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
