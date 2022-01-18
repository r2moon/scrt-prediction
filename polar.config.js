const localAccounts = [
  {
    name: 'account_0',
    address: 'secret1ndh9hcrpvltt2pwxr69vdekqasshdfpgy49ej8',
    mnemonic:
      'vanish famous project trick night cute regular mutual tuna spider apple coin broken nominee media news maximum owner main field october flat hero hedgehog',
  },
  {
    name: 'account_1',
    address: 'secret1j47muhva94dy9g48kde0q06hrlkzceepcnnqw0',
    mnemonic:
      'bunker crumble path divide library fiscal logic beach media loud draw antenna shield flush life account marriage test add merit trumpet lion april inch',
  },
];

const testnetAccounts = [
  {
    name: 'account_0',
    address: 'secret1wngv9zrf32f5tyknczkzydrvw2jl485ndns8qn',
    mnemonic:
      'invest soul deal obey energy asset face chicken comic surround river effort twice asthma runway hover leave fortune pole eternal admit obey error pitch',
  },
  {
    name: 'account_1',
    address: 'secret1hyjq30eq00m8x0q4ea3xrg2lrapdmnpzt876qw',
    mnemonic:
      'adult never knock giggle depart ensure tide rude kingdom foster diagram soon girl bleak caught put shoot large client citizen rib stove unhappy fatigue',
  },
];

module.exports = {
  defaultNetwork: 'development',
  networks: {
    development: {
      endpoint: 'tcp://127.0.0.1:1337',
      nodeId: '115aa0a629f5d70dd1d464bc7e42799e00f4edae',
      chainId: 'secretdev-1',
      trustNode: true,
      keyringBackend: 'test',
      accounts: localAccounts,
      types: {},
    },
    default: {
      endpoint: 'tcp://0.0.0.0:1337',
      nodeId: '115aa0a629f5d70dd1d464bc7e42799e00f4edae',
      chainId: 'secretdev-1',
      trustNode: true,
      keyringBackend: 'test',
      accounts: localAccounts,
      types: {},
    },
    // Supernova Testnet
    testnet: {
      endpoint: 'http://bootstrap.supernova.enigma.co:1317',
      chainId: 'supernova-2',
      trustNode: true,
      keyringBackend: 'test',
      accounts: testnetAccounts,
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
    timeout: 60000,
  },
};
