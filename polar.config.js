const getAccounts = require('./accounts/getAccounts');

module.exports = {
  defaultNetwork: 'development',
  networks: {
    default: {
      endpoint: 'tcp://0.0.0.0:1337',
      nodeId: '115aa0a629f5d70dd1d464bc7e42799e00f4edae',
      chainId: 'secretdev-1',
      trustNode: true,
      keyringBackend: 'test',
      accounts: getAccounts('local'),
      types: {},
    },
    testnet: {
      endpoint: 'http://testnet.securesecrets.org:1317',
      chainId: 'pulsar-2',
      trustNode: true,
      keyringBackend: 'test',
      accounts: getAccounts('testnet'),
      types: {},
      fees: {
        upload: {
          amount: [{ amount: '500000', denom: 'uscrt' }],
          gas: '2000000',
        },
        init: {
          amount: [{ amount: '125000', denom: 'uscrt' }],
          gas: '500000',
        },
      },
    },
    mainnet: {
      endpoint: 'mainnet rpc',
      chainId: 'mainnet chain id',
      trustNode: true,
      accounts: getAccounts('mainnet'),
      types: {},
      fees: {
        upload: {
          amount: [{ amount: '500000', denom: 'uscrt' }],
          gas: '2000000',
        },
        init: {
          amount: [{ amount: '125000', denom: 'uscrt' }],
          gas: '500000',
        },
      },
    },
  },
  mocha: {
    timeout: 1000000,
  },
};
