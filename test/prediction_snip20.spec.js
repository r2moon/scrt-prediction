const { expect, use } = require('chai');
const BN = require('bn.js');
const {
  Contract,
  getAccountByName,
  polarChai,
  createAccounts,
} = require('secret-polar');
const { UserAccountI } = require('secret-polar/dist/src/lib/account');
const { SecretNetworkClient, Wallet } = require('secretjs');
const {
  checkLogs,
  betSnip20,
  sleepUntil,
  getSnip20Balance,
  sendDenom,
} = require('./utils');

use(polarChai);

describe.only('prediction with snip20', () => {
  let owner, alice, bob, carol, operator, treasury;
  let oracleContract;
  let snip20Contract;
  let predictionContract;
  let feeRate = 0.03;
  let interval = 30;
  let graceInterval = 15;
  let assetInfo;
  let secretjs;
  let aliceViewingKey = 'aliceViewingKey';
  const CHAIN_ID = 'secretdev-1';

  before(async () => {
    owner = getAccountByName('account_0');
    alice = getAccountByName('account_1');

    oracleContract = new Contract('oracle');
    await oracleContract.parseSchema();
    await oracleContract.deploy(owner, {
      // custom fees
      amount: [{ amount: '750000', denom: 'uscrt' }],
      gas: '3000000',
    });

    snip20Contract = new Contract('snip20-reference-impl');

    await snip20Contract.parseSchema();
    await snip20Contract.deploy(owner, {
      // custom fees
      amount: [{ amount: '750000', denom: 'uscrt' }],
      gas: '3000000',
    });

    [bob, carol, operator, treasury] = (await createAccounts(5)).map(
      (account) => new UserAccountI(account, oracleContract.env),
    );

    const ownerWallet = new Wallet(owner.account.mnemonic);
    secretjs = await SecretNetworkClient.create({
      grpcWebUrl: 'http://localhost:9091',
      chainId: CHAIN_ID,
      wallet: ownerWallet,
      walletAddress: owner.account.address,
    });

    await sendDenom(
      secretjs,
      owner.account.address,
      [
        bob.account.address,
        carol.account.address,
        operator.account.address,
        treasury.account.address,
      ],
      '100000000',
    );

    await snip20Contract.instantiate(
      {
        name: 'SEFI',
        admin: owner.account.address,
        symbol: 'SEFI',
        decimals: 6,
        initial_balances: [
          {
            address: alice.account.address,
            amount: '1000000000000',
          },
          {
            address: bob.account.address,
            amount: '1000000000000',
          },
          {
            address: carol.account.address,
            amount: '1000000000000',
          },
        ],
        prng_seed: 'eyJkZXBvc2l0Ijp7fX0K',
        config: null,
      },
      'init test',
      owner,
    );

    assetInfo = {
      token: {
        contract_addr: snip20Contract.contractAddress,
        token_code_hash: snip20Contract.contractCodeHash,
        viewing_key: 'empty',
      },
    };

    await oracleContract.instantiate(
      { owner: owner.account.address },
      'init test',
      owner,
    );

    await oracleContract.tx.register_asset(
      { account: owner },
      assetInfo,
      owner.account.address,
    );

    predictionContract = new Contract('price_prediction');
    await predictionContract.parseSchema();
    await predictionContract.deploy(owner, {
      // custom fees
      amount: [{ amount: '750000', denom: 'uscrt' }],
      gas: '3000000',
    });
  });

  beforeEach(async () => {
    await predictionContract.instantiate(
      {
        operator_addr: operator.account.address,
        treasury_addr: treasury.account.address,
        bet_asset: assetInfo,
        oracle_addr: oracleContract.contractAddress,
        oracle_code_hash: oracleContract.contractCodeHash,
        fee_rate: feeRate.toString(),
        interval,
        grace_interval: graceInterval,
        prng_seed: 'eyJkZXBvc2l0Ijp7fX0K',
      },
      'init test',
      owner,
    );
  });

  describe('bet', () => {
    beforeEach(async () => {
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, '3'],
      ]);
      await predictionContract.tx.start_genesis_round({
        account: owner,
      });
      await predictionContract.tx.set_viewing_key(
        {
          account: alice,
        },
        aliceViewingKey,
        null,
      );
    });

    it('bet up with snip20', async () => {
      const amount = '1000';
      const msgJson = {
        bet: {
          position: 'up',
        },
      };
      const msgBinary = Buffer.from(JSON.stringify(msgJson)).toString('base64');
      await snip20Contract.tx.send(
        {
          account: alice,
        },
        amount, // amount
        null, // memo,
        msgBinary, // msg,
        null, // padding,
        predictionContract.contractAddress,
        predictionContract.contractCodeHash,
      );

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '2',
        total_fee: '0',
        paused: false,
      });

      await expect(
        predictionContract.query.bet(
          '2',
          aliceViewingKey,
          alice.account.address,
        ),
      ).to.respondWith({
        amount,
        position: 'up',
        claimed: false,
      });

      const currentRound = await predictionContract.query.round('2');

      expect(currentRound.total_amount).to.be.equal(amount);
      expect(currentRound.reward_amount).to.be.equal('0');
      expect(currentRound.up_amount).to.be.equal(amount);
      expect(currentRound.down_amount).to.be.equal('0');
    });
  });

  describe('claim', () => {
    beforeEach(async () => {
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, '3'],
      ]);
      await predictionContract.tx.start_genesis_round({
        account: owner,
      });
      await predictionContract.tx.set_viewing_key(
        {
          account: alice,
        },
        aliceViewingKey,
        null,
      );
      await snip20Contract.tx.set_viewing_key(
        {
          account: alice,
        },
        aliceViewingKey,
        null,
      );
    });

    it('claim by winner', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await betSnip20(
        snip20Contract,
        predictionContract,
        alice,
        '100',
        'down',
        assetInfo,
      );
      await betSnip20(
        snip20Contract,
        predictionContract,
        bob,
        '1000',
        'up',
        assetInfo,
      );
      await betSnip20(
        snip20Contract,
        predictionContract,
        carol,
        '400',
        'down',
        assetInfo,
      );

      await sleepUntil(genesisRound.end_time);

      let closePrice = '5';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      let currentRound = await predictionContract.query.round('2');

      await sleepUntil(currentRound.end_time);

      closePrice = '3';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      let claim_before_bal = await getSnip20Balance(
        snip20Contract,
        alice,
        aliceViewingKey,
      );

      let ex_response = await predictionContract.tx.claim(
        {
          account: alice,
        },
        '2',
      );

      let claim_after_bal = await getSnip20Balance(
        snip20Contract,
        alice,
        aliceViewingKey,
      );
      expect(claim_after_bal.toString()).to.be.equal(
        claim_before_bal.add(new BN(291)).toString(),
      );

      await expect(
        predictionContract.query.bet(
          '2',
          aliceViewingKey,
          alice.account.address,
        ),
      ).to.respondWith({
        amount: '100',
        position: 'down',
        claimed: true,
      });

      checkLogs(ex_response, {
        action: 'claim',
        epoch: '2',
        amount: '100',
        claim_amount: '291',
      });
    });
  });

  describe('withdraw', () => {
    beforeEach(async () => {
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, '3'],
      ]);
      await predictionContract.tx.start_genesis_round({
        account: owner,
      });
      await snip20Contract.tx.set_viewing_key(
        {
          account: treasury,
        },
        aliceViewingKey,
        null,
      );
    });

    it('withdraw to treasury address', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await betSnip20(
        snip20Contract,
        predictionContract,
        alice,
        '100',
        'down',
        assetInfo,
      );
      await betSnip20(
        snip20Contract,
        predictionContract,
        bob,
        '1000',
        'up',
        assetInfo,
      );
      await betSnip20(
        snip20Contract,
        predictionContract,
        carol,
        '400',
        'down',
        assetInfo,
      );

      await sleepUntil(genesisRound.end_time);

      let closePrice = '5';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      let currentRound = await predictionContract.query.round('2');

      await sleepUntil(currentRound.end_time);

      closePrice = '3';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      let claim_before_bal = await getSnip20Balance(
        snip20Contract,
        treasury,
        aliceViewingKey,
      );

      let ex_response = await predictionContract.tx.withdraw({
        account: owner,
      });

      let claim_after_bal = await getSnip20Balance(
        snip20Contract,
        treasury,
        aliceViewingKey,
      );

      expect(claim_after_bal.toString()).to.be.equal(
        claim_before_bal.add(new BN(45)).toString(),
      );

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '4',
        total_fee: '0',
        paused: false,
      });

      checkLogs(ex_response, {
        action: 'withdraw',
        amount: '45',
      });
    });
  });
});
