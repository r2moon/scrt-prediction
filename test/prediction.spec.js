const { expect, use } = require('chai');
const BN = require('bn.js');
const {
  Contract,
  getAccountByName,
  polarChai,
  createAccounts,
} = require('secret-polar');
const { UserAccountI } = require('secret-polar/dist/src/lib/account');
const {
  EnigmaUtils,
  SigningCosmWasmClient,
  Secp256k1Pen,
  Wallet,
} = require('secretjs');
const {
  checkLogs,
  bet,
  sleep,
  sleepUntil,
  getScrtBalance,
  getScrtBalanceWithCustomClient,
} = require('./utils');

use(polarChai);

describe.only('prediction', () => {
  let owner, alice, bob, carol, operator, treasury;
  let oracleContract;
  let predictionContract;
  let feeRate = 0.03;
  let interval = 20;
  let graceInterval = 15;
  let assetInfo = {
    native_token: {
      denom: 'uscrt',
    },
  };
  const txFee = new BN(50000);
  let signingClient;
  let aliceViewingKey = 'aliceViewingKey';

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

    [bob, carol, operator, treasury] = (await createAccounts(5)).map(
      (account) => new UserAccountI(account, oracleContract.env),
    );

    // const signingPen = await Secp256k1Pen.fromMnemonic(owner.account.mnemonic);
    // signingClient = new SigningCosmWasmClient(
    //   network.config.endpoint,
    //   owner.account.address,
    //   (signBytes) => signingPen.sign(signBytes),
    //   network.config.seed ?? EnigmaUtils.GenerateNewSeed(),
    //   network.config.fees,
    //   network.config.broadCastMode,
    // );

    // await signingClient.sendTokens(bob.account.address, [
    //   { amount: '100000000', denom: 'uscrt' },
    // ]);
    // await signingClient.sendTokens(carol.account.address, [
    //   { amount: '100000000', denom: 'uscrt' },
    // ]);
    // await signingClient.sendTokens(operator.account.address, [
    //   { amount: '100000000', denom: 'uscrt' },
    // ]);

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

  describe('init contract', () => {
    it('fail if fee rate is higher than 100%', async () => {
      await expect(
        predictionContract.instantiate(
          {
            operator_addr: operator.account.address,
            treasury_addr: treasury.account.address,
            bet_asset: assetInfo,
            oracle_addr: oracleContract.contractAddress,
            oracle_code_hash: oracleContract.contractCodeHash,
            fee_rate: '1.01',
            interval,
            grace_interval: graceInterval,
          },
          'init test',
          owner,
        ),
      ).to.be.revertedWith('Invalid fee rate');
    });

    it('fail if grace interval is greater than interval', async () => {
      await expect(
        predictionContract.instantiate(
          {
            operator_addr: operator.account.address,
            treasury_addr: treasury.account.address,
            bet_asset: assetInfo,
            oracle_addr: oracleContract.contractAddress,
            oracle_code_hash: oracleContract.contractCodeHash,
            fee_rate: feeRate.toString(),
            interval,
            grace_interval: interval + 1,
          },
          'init test',
          owner,
        ),
      ).to.be.revertedWith('Invalid grace interval');
    });

    it('init contract and check config', async () => {
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
        },
        'init test',
        owner,
      );

      await expect(predictionContract.query.config()).to.respondWith({
        owner_addr: owner.account.address,
        operator_addr: operator.account.address,
        treasury_addr: treasury.account.address,
        bet_asset: assetInfo,
        oracle_addr: oracleContract.contractAddress,
        oracle_code_hash: oracleContract.contractCodeHash,
        fee_rate: feeRate.toString(),
        interval,
        grace_interval: graceInterval,
      });

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '0',
        total_fee: '0',
        paused: true,
      });
    });
  });

  describe('update_config', () => {
    it('fail if msg.sender is not owner', async () => {
      await expect(
        predictionContract.tx.update_config(
          { account: alice },
          '1.0',
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ),
      ).to.be.revertedWith('unauthorized');
    });

    it('fail if fee rate is higher than 100%', async () => {
      await expect(
        predictionContract.tx.update_config(
          { account: owner },
          '1.01',
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ),
      ).to.be.revertedWith('Invalid fee rate');
    });

    it('fail if grace interval is greater than interval', async () => {
      await expect(
        predictionContract.tx.update_config(
          { account: owner },
          null,
          interval + 1,
          null,
          null,
          null,
          null,
          null,
          null,
        ),
      ).to.be.revertedWith('Invalid grace interval');

      await expect(
        predictionContract.tx.update_config(
          { account: owner },
          null,
          2,
          1,
          null,
          null,
          null,
          null,
          null,
        ),
      ).to.be.revertedWith('Invalid grace interval');
    });

    it('update config by owner', async () => {
      const ex_response = await predictionContract.tx.update_config(
        { account: owner },
        '0.5',
        18,
        25,
        carol.account.address, // new operator addr
        alice.account.address, // new oracle addr
        'oracle_new_code_hash',
        bob.account.address, // new owner addr
        owner.account.address, // new treasury addr
      );

      await expect(predictionContract.query.config()).to.respondWith({
        owner_addr: bob.account.address,
        operator_addr: carol.account.address,
        treasury_addr: owner.account.address,
        bet_asset: assetInfo,
        oracle_addr: alice.account.address,
        oracle_code_hash: 'oracle_new_code_hash',
        fee_rate: '0.5',
        interval: 25,
        grace_interval: 18,
      });

      checkLogs(ex_response, {
        action: 'update_config',
      });
    });
  });

  describe('start_genesis_round', () => {
    const price = '3';

    beforeEach(async () => {
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, price],
      ]);
    });

    it('fail if msg.sender is not owner', async () => {
      await expect(
        predictionContract.tx.start_genesis_round({ account: alice }),
      ).to.be.revertedWith('unauthorized');
    });

    it('start genesis round by owner', async () => {
      const currentTime = Date.now() / 1000;

      const ex_response = await predictionContract.tx.start_genesis_round({
        account: owner,
      });

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '2',
        total_fee: '0',
        paused: false,
      });

      const genesisRound = await predictionContract.query.round('1');
      const currentRound = await predictionContract.query.round('2');

      expect(genesisRound.start_time)
        .to.be.greaterThanOrEqual(currentTime - 2 - interval)
        .to.be.lessThanOrEqual(currentTime + 2 - interval);
      expect(genesisRound.lock_time).to.be.equal(
        genesisRound.start_time + interval,
      );
      expect(genesisRound.end_time).to.be.equal(
        genesisRound.lock_time + interval,
      );
      expect(genesisRound.open_price).to.be.equal(null);
      expect(genesisRound.close_price).to.be.equal(null);
      expect(genesisRound.total_amount).to.be.equal('0');
      expect(genesisRound.reward_amount).to.be.equal('0');
      expect(genesisRound.up_amount).to.be.equal('0');
      expect(genesisRound.down_amount).to.be.equal('0');
      expect(genesisRound.is_genesis).to.be.equal(true);

      expect(currentRound.start_time).to.be.equal(genesisRound.lock_time);
      expect(currentRound.lock_time).to.be.equal(
        currentRound.start_time + interval,
      );
      expect(currentRound.end_time).to.be.equal(
        currentRound.lock_time + interval,
      );
      expect(currentRound.open_price).to.be.equal(null);
      expect(currentRound.close_price).to.be.equal(null);
      expect(currentRound.total_amount).to.be.equal('0');
      expect(currentRound.reward_amount).to.be.equal('0');
      expect(currentRound.up_amount).to.be.equal('0');
      expect(currentRound.down_amount).to.be.equal('0');
      expect(currentRound.is_genesis).to.be.equal(false);

      checkLogs(ex_response, {
        action: 'start_genesis_round',
      });
    });

    it('fail if already started', async () => {
      await predictionContract.tx.start_genesis_round({
        account: owner,
      });

      await expect(
        predictionContract.tx.start_genesis_round({ account: owner }),
      ).to.be.revertedWith('Running now');
    });
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

    it('fail if amount is zero', async () => {
      await expect(
        predictionContract.tx.bet(
          {
            account: alice,
          },
          'up',
        ),
      ).to.be.revertedWith('Amount is zero');
    });

    // TODO test with snip20 token

    it('fail if paused', async () => {
      await predictionContract.tx.pause({
        account: owner,
      });

      await expect(
        predictionContract.tx.bet(
          {
            account: alice,
            transferAmount: [
              {
                amount: '1000',
                denom: 'uscrt',
              },
            ],
          },
          'up',
        ),
      ).to.be.revertedWith('Paused');
    });

    it('fails to query bet with invalid viewing key', async () => {
      const amount = '1000';
      await predictionContract.tx.bet(
        {
          account: alice,
          transferAmount: [
            {
              amount,
              denom: 'uscrt',
            },
          ],
        },
        'up',
      );

      const invalidViewingKey = 'invalidViewingKey';

      await expect(
        predictionContract.query.bet(
          '2',
          invalidViewingKey,
          alice.account.address,
        ),
      ).to.be.revertedWith('Invalid viewing key');
    });

    it('bet up with native token', async () => {
      const amount = '1000';
      const ex_response = await predictionContract.tx.bet(
        {
          account: alice,
          transferAmount: [
            {
              amount,
              denom: 'uscrt',
            },
          ],
        },
        'up',
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

      checkLogs(ex_response, {
        action: 'bet',
        amount,
        position: 'up',
      });
    });

    it('bet down with native token', async () => {
      const amount = '1000';
      const ex_response = await predictionContract.tx.bet(
        {
          account: alice,
          transferAmount: [
            {
              amount,
              denom: 'uscrt',
            },
          ],
        },
        'down',
      );

      await expect(
        predictionContract.query.bet(
          '2',
          aliceViewingKey,
          alice.account.address,
        ),
      ).to.respondWith({
        amount,
        position: 'down',
        claimed: false,
      });

      const currentRound = await predictionContract.query.round('2');

      expect(currentRound.total_amount).to.be.equal(amount);
      expect(currentRound.reward_amount).to.be.equal('0');
      expect(currentRound.up_amount).to.be.equal('0');
      expect(currentRound.down_amount).to.be.equal(amount);

      checkLogs(ex_response, {
        action: 'bet',
        amount,
        position: 'down',
      });
    });

    it('fail if already bet', async () => {
      await bet(predictionContract, alice, '1000', 'down', assetInfo);

      await expect(
        predictionContract.tx.bet(
          {
            account: alice,
            transferAmount: [
              {
                amount: '100',
                denom: 'uscrt',
              },
            ],
          },
          'up',
        ),
      ).to.be.revertedWith('Already bet');

      await expect(
        predictionContract.tx.bet(
          {
            account: alice,
            transferAmount: [
              {
                amount: '100',
                denom: 'uscrt',
              },
            ],
          },
          'down',
        ),
      ).to.be.revertedWith('Already bet');
    });

    it('bet by several users', async () => {
      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);
      await bet(predictionContract, carol, '500', 'down', assetInfo);

      const currentRound = await predictionContract.query.round('2');

      expect(currentRound.total_amount).to.be.equal('1600');
      expect(currentRound.reward_amount).to.be.equal('0');
      expect(currentRound.up_amount).to.be.equal('1000');
      expect(currentRound.down_amount).to.be.equal('600');
    });

    // TODO review if bettable check enough

    it('fail after lock time', async () => {
      await sleep(interval);
      await expect(
        predictionContract.tx.bet(
          {
            account: alice,
            transferAmount: [
              {
                amount: '1000',
                denom: 'uscrt',
              },
            ],
          },
          'up',
        ),
      ).to.be.revertedWith('Cannot bet');
    });
  });

  describe('execute_round', () => {
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

    it('fail if msg.sender is not operator', async () => {
      await expect(
        predictionContract.tx.execute_round({
          account: owner,
        }),
      ).to.be.revertedWith('unauthorized');
    });

    // TODO check paused and how can claim

    it('fail if paused', async () => {
      await predictionContract.tx.pause({
        account: owner,
      });

      await expect(
        predictionContract.tx.execute_round({
          account: operator,
        }),
      ).to.be.revertedWith('Paused');
    });

    it('fail if expired', async () => {
      await sleep(interval + graceInterval);

      await expect(
        predictionContract.tx.execute_round({
          account: operator,
        }),
      ).to.be.revertedWith('Expired');
    });

    // TODO check executable enough
    it('fail if not ended', async () => {
      await expect(
        predictionContract.tx.execute_round({
          account: operator,
        }),
      ).to.be.revertedWith('Cannot execute');
    });

    it('fail if price is not udpated after start time', async () => {
      await sleep(interval);
      await predictionContract.tx.execute_round({
        account: operator,
      });

      await sleep(interval);

      await expect(
        predictionContract.tx.execute_round({
          account: operator,
        }),
      ).to.be.revertedWith('Price not updated');
    });

    it('execute genesis round', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);
      await bet(predictionContract, carol, '500', 'down', assetInfo);

      await sleepUntil(genesisRound.end_time);

      const closePrice = '5';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      const currentTime = Date.now() / 1000;
      const ex_response = await predictionContract.tx.execute_round({
        account: operator,
      });

      genesisRound = await predictionContract.query.round('1');
      expect(genesisRound.close_price).to.be.equal(closePrice);
      const currentRound = await predictionContract.query.round('2');
      expect(currentRound.open_price).to.be.equal(closePrice);
      expect(currentRound.close_price).to.be.equal(null);
      expect(currentRound.total_amount).to.be.equal('1600');
      expect(currentRound.reward_amount).to.be.equal('0');
      expect(currentRound.up_amount).to.be.equal('1000');
      expect(currentRound.down_amount).to.be.equal('600');
      expect(currentRound.is_genesis).to.be.equal(false);

      const newRound = await predictionContract.query.round('3');
      expect(newRound.start_time)
        .to.be.greaterThanOrEqual(currentTime - 2)
        .to.be.lessThanOrEqual(currentTime + 2);
      expect(newRound.lock_time).to.be.equal(newRound.start_time + interval);
      expect(newRound.end_time).to.be.equal(newRound.lock_time + interval);
      expect(newRound.open_price).to.be.equal(null);
      expect(newRound.close_price).to.be.equal(null);
      expect(newRound.total_amount).to.be.equal('0');
      expect(newRound.reward_amount).to.be.equal('0');
      expect(newRound.up_amount).to.be.equal('0');
      expect(newRound.down_amount).to.be.equal('0');
      expect(newRound.is_genesis).to.be.equal(false);

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '3',
        total_fee: '0',
        paused: false,
      });

      checkLogs(ex_response, {
        action: 'execute',
        epoch_finish: '1',
        epoch_lock: '2',
        close_price: closePrice,
      });
    });

    it('execute general round and win up position', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);
      await bet(predictionContract, carol, '500', 'down', assetInfo);

      await sleepUntil(genesisRound.end_time);

      let closePrice = '2';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      let currentRound = await predictionContract.query.round('2');

      await sleepUntil(currentRound.end_time);

      closePrice = '4';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      const ex_response = await predictionContract.tx.execute_round({
        account: operator,
      });

      const finishedRound = await predictionContract.query.round('2');
      expect(finishedRound.open_price).to.be.equal('2');
      expect(finishedRound.close_price).to.be.equal(closePrice);
      expect(finishedRound.total_amount).to.be.equal('1600');
      const fee = '48';
      expect(finishedRound.reward_amount).to.be.equal('1552');
      expect(finishedRound.up_amount).to.be.equal('1000');
      expect(finishedRound.down_amount).to.be.equal('600');
      expect(finishedRound.is_genesis).to.be.equal(false);

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '4',
        total_fee: fee,
        paused: false,
      });

      checkLogs(ex_response, {
        action: 'execute',
        epoch_finish: '2',
        epoch_lock: '3',
        close_price: closePrice,
      });
    });

    it('execute general round and win down position', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);
      await bet(predictionContract, carol, '500', 'down', assetInfo);

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

      closePrice = '4';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      const ex_response = await predictionContract.tx.execute_round({
        account: operator,
      });

      const finishedRound = await predictionContract.query.round('2');
      expect(finishedRound.open_price).to.be.equal('5');
      expect(finishedRound.close_price).to.be.equal(closePrice);
      expect(finishedRound.total_amount).to.be.equal('1600');
      const fee = '48';
      expect(finishedRound.reward_amount).to.be.equal('1552');
      expect(finishedRound.up_amount).to.be.equal('1000');
      expect(finishedRound.down_amount).to.be.equal('600');
      expect(finishedRound.is_genesis).to.be.equal(false);

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '4',
        total_fee: fee,
        paused: false,
      });

      checkLogs(ex_response, {
        action: 'execute',
        epoch_finish: '2',
        epoch_lock: '3',
        close_price: closePrice,
      });
    });

    it('update fee to save user bet amount when no enough bet for losers (up position win)', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '20', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);

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

      closePrice = '6';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      const ex_response = await predictionContract.tx.execute_round({
        account: operator,
      });

      const finishedRound = await predictionContract.query.round('2');
      expect(finishedRound.open_price).to.be.equal('5');
      expect(finishedRound.close_price).to.be.equal(closePrice);
      expect(finishedRound.total_amount).to.be.equal('1020');
      const fee = '20';
      expect(finishedRound.reward_amount).to.be.equal('1000');
      expect(finishedRound.up_amount).to.be.equal('1000');
      expect(finishedRound.down_amount).to.be.equal('20');
      expect(finishedRound.is_genesis).to.be.equal(false);

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '4',
        total_fee: fee,
        paused: false,
      });

      checkLogs(ex_response, {
        action: 'execute',
        epoch_finish: '2',
        epoch_lock: '3',
        close_price: closePrice,
      });
    });

    it('update fee to save user bet amount when no enough bet for losers (down position win)', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '20', 'up', assetInfo);
      await bet(predictionContract, bob, '1000', 'down', assetInfo);

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

      closePrice = '2';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      const ex_response = await predictionContract.tx.execute_round({
        account: operator,
      });

      const finishedRound = await predictionContract.query.round('2');
      expect(finishedRound.open_price).to.be.equal('5');
      expect(finishedRound.close_price).to.be.equal(closePrice);
      expect(finishedRound.total_amount).to.be.equal('1020');
      const fee = '20';
      expect(finishedRound.reward_amount).to.be.equal('1000');
      expect(finishedRound.up_amount).to.be.equal('20');
      expect(finishedRound.down_amount).to.be.equal('1000');
      expect(finishedRound.is_genesis).to.be.equal(false);

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '4',
        total_fee: fee,
        paused: false,
      });

      checkLogs(ex_response, {
        action: 'execute',
        epoch_finish: '2',
        epoch_lock: '3',
        close_price: closePrice,
      });
    });

    it('ignore if close and open price are same', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '20', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);

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

      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      const ex_response = await predictionContract.tx.execute_round({
        account: operator,
      });

      const finishedRound = await predictionContract.query.round('2');
      expect(finishedRound.open_price).to.be.equal('5');
      expect(finishedRound.close_price).to.be.equal(closePrice);
      expect(finishedRound.total_amount).to.be.equal('1020');
      expect(finishedRound.reward_amount).to.be.equal('0');
      expect(finishedRound.up_amount).to.be.equal('1000');
      expect(finishedRound.down_amount).to.be.equal('20');
      expect(finishedRound.is_genesis).to.be.equal(false);

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '4',
        total_fee: '0',
        paused: false,
      });

      checkLogs(ex_response, {
        action: 'execute',
        epoch_finish: '2',
        epoch_lock: '3',
        close_price: closePrice,
      });
    });

    it('ignore round if one position bet amount is zero (down position is zero)', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, bob, '1000', 'up', assetInfo);

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

      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      const ex_response = await predictionContract.tx.execute_round({
        account: operator,
      });

      const finishedRound = await predictionContract.query.round('2');
      expect(finishedRound.open_price).to.be.equal('5');
      expect(finishedRound.close_price).to.be.equal(closePrice);
      expect(finishedRound.total_amount).to.be.equal('1000');
      expect(finishedRound.reward_amount).to.be.equal('0');
      expect(finishedRound.up_amount).to.be.equal('1000');
      expect(finishedRound.down_amount).to.be.equal('0');
      expect(finishedRound.is_genesis).to.be.equal(false);

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '4',
        total_fee: '0',
        paused: false,
      });

      checkLogs(ex_response, {
        action: 'execute',
        epoch_finish: '2',
        epoch_lock: '3',
        close_price: closePrice,
      });
    });

    it('ignore round if one position bet amount is zero (up position is zero)', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, bob, '1000', 'down', assetInfo);

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

      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      const ex_response = await predictionContract.tx.execute_round({
        account: operator,
      });

      const finishedRound = await predictionContract.query.round('2');
      expect(finishedRound.open_price).to.be.equal('5');
      expect(finishedRound.close_price).to.be.equal(closePrice);
      expect(finishedRound.total_amount).to.be.equal('1000');
      expect(finishedRound.reward_amount).to.be.equal('0');
      expect(finishedRound.up_amount).to.be.equal('0');
      expect(finishedRound.down_amount).to.be.equal('1000');
      expect(finishedRound.is_genesis).to.be.equal(false);

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '4',
        total_fee: '0',
        paused: false,
      });

      checkLogs(ex_response, {
        action: 'execute',
        epoch_finish: '2',
        epoch_lock: '3',
        close_price: closePrice,
      });
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
    });

    it('fail if round is not ended', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);

      await sleepUntil(genesisRound.end_time);

      let closePrice = '2';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      await expect(
        predictionContract.tx.claim(
          {
            account: alice,
          },
          '2',
        ),
      ).to.be.revertedWith('Not able to claim');
    });

    it('fail if close price is not set', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);

      await sleepUntil(genesisRound.end_time);

      let closePrice = '2';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      let currentRound = await predictionContract.query.round('2');
      await sleepUntil(currentRound.end_time);

      await expect(
        predictionContract.tx.claim(
          {
            account: alice,
          },
          '2',
        ),
      ).to.be.revertedWith('Not able to claim');
    });

    it('fail to claim reward by loser', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);

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

      closePrice = '4';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      await expect(
        predictionContract.tx.claim(
          {
            account: bob,
          },
          '2',
        ),
      ).to.be.revertedWith('Nothing to claim');
    });

    it('claim by winner', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);
      await bet(predictionContract, carol, '400', 'down', assetInfo);

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

      let claim_before_bal = await getScrtBalance(alice);

      let ex_response = await predictionContract.tx.claim(
        {
          account: alice,
        },
        '2',
      );

      expect((await getScrtBalance(alice)).toString()).to.be.equal(
        claim_before_bal.add(new BN(291)).sub(txFee).toString(),
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

    it('failed to claim again', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);
      await bet(predictionContract, carol, '400', 'down', assetInfo);

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

      await predictionContract.tx.claim(
        {
          account: alice,
        },
        '2',
      );

      await expect(
        predictionContract.tx.claim(
          {
            account: alice,
          },
          '2',
        ),
      ).to.be.revertedWith('Already claimed');
    });

    it('claim refunded amount after grace period if round was not ended', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);
      await bet(predictionContract, carol, '400', 'down', assetInfo);

      await sleepUntil(genesisRound.end_time);

      let closePrice = '5';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      let currentRound = await predictionContract.query.round('2');

      await sleepUntil(currentRound.end_time + graceInterval + 5);

      let claim_before_bal = await getScrtBalance(alice);
      let ex_response = await predictionContract.tx.claim(
        {
          account: alice,
        },
        '2',
      );

      expect((await getScrtBalance(alice)).toString()).to.be.equal(
        claim_before_bal.add(new BN(100)).sub(txFee).toString(),
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
        claim_amount: '100',
      });
    });

    it('claim refunded amount after end time if open price is same as close price', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);
      await bet(predictionContract, carol, '400', 'down', assetInfo);

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

      closePrice = '5';
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, closePrice],
      ]);

      await predictionContract.tx.execute_round({
        account: operator,
      });

      let claim_before_bal = await getScrtBalance(alice);
      let ex_response = await predictionContract.tx.claim(
        {
          account: alice,
        },
        '2',
      );

      expect((await getScrtBalance(alice)).toString()).to.be.equal(
        claim_before_bal.add(new BN(100)).sub(txFee).toString(),
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
        claim_amount: '100',
      });
    });

    it('claim refunded amount after lock period one position bet amount is zero', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, carol, '400', 'down', assetInfo);

      await sleepUntil(genesisRound.end_time + 4);

      let claim_before_bal = await getScrtBalance(alice);
      let ex_response = await predictionContract.tx.claim(
        {
          account: alice,
        },
        '2',
      );

      expect((await getScrtBalance(alice)).toString()).to.be.equal(
        claim_before_bal.add(new BN(100)).sub(txFee).toString(),
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
        claim_amount: '100',
      });
    });
  });

  describe('pause', () => {
    const price = '3';

    beforeEach(async () => {
      await oracleContract.tx.feed_price({ account: owner }, [
        [assetInfo, price],
      ]);

      await predictionContract.tx.start_genesis_round({
        account: owner,
      });
    });

    it('fail if msg.sender is not owner', async () => {
      await expect(
        predictionContract.tx.pause({ account: alice }),
      ).to.be.revertedWith('unauthorized');
    });

    it('pause by owner', async () => {
      const ex_response = await predictionContract.tx.pause({
        account: owner,
      });

      await expect(predictionContract.query.state()).to.respondWith({
        epoch: '2',
        total_fee: '0',
        paused: true,
      });

      checkLogs(ex_response, {
        action: 'pause',
      });
    });

    it('fail if it is paused', async () => {
      await predictionContract.tx.pause({
        account: owner,
      });

      await expect(
        predictionContract.tx.pause({ account: owner }),
      ).to.be.revertedWith('Paused');
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
    });

    it('fail if msg.sender is not owner', async () => {
      await expect(
        predictionContract.tx.withdraw({ account: alice }),
      ).to.be.revertedWith('unauthorized');
    });

    it('fail if no stacked fee', async () => {
      await expect(
        predictionContract.tx.withdraw({ account: owner }),
      ).to.be.revertedWith('No stacked fee');
    });

    it('withdraw to treasury address', async () => {
      let genesisRound = await predictionContract.query.round('1');

      await bet(predictionContract, alice, '100', 'down', assetInfo);
      await bet(predictionContract, bob, '1000', 'up', assetInfo);
      await bet(predictionContract, carol, '400', 'down', assetInfo);

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

      let claim_before_bal = await getScrtBalanceWithCustomClient(
        signingClient,
        treasury,
      );

      let ex_response = await predictionContract.tx.withdraw({
        account: owner,
      });

      expect(
        (
          await getScrtBalanceWithCustomClient(signingClient, treasury)
        ).toString(),
      ).to.be.equal(claim_before_bal.add(new BN(45)).toString());

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

  describe.only('permit query', () => {
    const PERMIT_NAME = 'scrt_prediction';
    const allowedTokens = ['secret18vd8fpwxzck93qlwghaj6arh4p7c5n8978vsyg'];
    const PERMISSIONS = ['owner'];
    const CHAIN_ID = 'secretdev-1';
    const amount = '1000';

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
      await predictionContract.tx.bet(
        {
          account: alice,
          transferAmount: [
            {
              amount,
              denom: 'uscrt',
            },
          ],
        },
        'up',
      );
    });

    it('query permit', async () => {
      const wallet = new Wallet(alice.account.mnemonic);

      const { signature } = await wallet.signAmino(alice.account.address, {
        chain_id: CHAIN_ID,
        account_number: '0',
        sequence: '0',
        fee: {
          amount: [{ denom: 'uscrt', amount: '0' }], // Must be 0 uscrt
          gas: '1', // Must be 1
        },
        msgs: [
          {
            type: 'query_permit', // Must be "query_permit"
            value: {
              permit_name: PERMIT_NAME,
              allowed_tokens: [predictionContract.contractAddress],
              permissions: PERMISSIONS,
            },
          },
        ],
        memo: '',
      });

      console.log(signature);

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

      console.log('#$#');

      const genesisRound = await predictionContract.query.with_permit(
        {
          params: {
            permit_name: PERMIT_NAME,
            allowed_tokens: allowedTokens,
            chain_id: CHAIN_ID,
            permissions: PERMISSIONS,
          },
          signature,
        },
        { bet: { epoch: '2' } },
      );

      console.log(genesisRound);
    });
  });
});
