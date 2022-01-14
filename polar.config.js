const localAccounts = [
  {
    name: 'account_0',
    address: 'secret1757nphmczgw5drzds0sq88qwdrkqga95crwd22',
    mnemonic: 'viable refuse virtual barrel wasp gravity distance junk asset roast brief prize bench motion approve pause level wolf mystery weekend noodle abuse faith coast'
  },
  {
    name: 'account_1',
    address: 'secret18s6jtdqg6k7vvsy3j32ad2pm7jxdj9xs4xcjsq',
    mnemonic: 'sponsor meat swear churn carbon equal magnet code vault valid auction ugly flip grit bus danger issue scrub snake budget awesome main music scatter'
  }
];

const testnetAccounts = [
  {
    name: 'account_0',
    address: 'secret1wngv9zrf32f5tyknczkzydrvw2jl485ndns8qn',
    mnemonic: 'invest soul deal obey energy asset face chicken comic surround river effort twice asthma runway hover leave fortune pole eternal admit obey error pitch'
  },
  {
    name: 'account_1',
    address: 'secret1hyjq30eq00m8x0q4ea3xrg2lrapdmnpzt876qw',
    mnemonic: 'adult never knock giggle depart ensure tide rude kingdom foster diagram soon girl bleak caught put shoot large client citizen rib stove unhappy fatigue'
  }
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
      types: {}
    },
    default: {
      endpoint: 'tcp://0.0.0.0:1337',
      nodeId: '115aa0a629f5d70dd1d464bc7e42799e00f4edae',
      chainId: 'secretdev-1',
      trustNode: true,
      keyringBackend: 'test',
      accounts: localAccounts,
      types: {}
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
            amount: [{ amount: "500000", denom: "uscrt" }],
            gas: "2000000",
        },
        init: {
            amount: [{ amount: "125000", denom: "uscrt" }],
            gas: "500000",
        },
      }
    }
  },
  mocha: {
    timeout: 60000
  }
};