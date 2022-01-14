const { expect, use } = require('chai');
const { Contract, getAccountByName, polarChai } = require('secret-polar');

use(polarChai);

describe('oracle', () => {
  let owner, alice;
  let oracleContract;

  before(async () => {
    owner = getAccountByName('account_0');
    alice = getAccountByName('account_1');
    oracleContract = new Contract('oracle');
    await oracleContract.parseSchema();
    await oracleContract.deploy(owner);
  });

  describe('init contract', () => {
    it('init contract and check config', async () => {
      await oracleContract.instantiate(
        { owner: owner.account.address },
        'init test',
        owner,
      );

      await expect(oracleContract.query.config()).to.respondWith({
        owner: owner.account.address,
      });
    });
  });

  describe('update_config', () => {
    it('fail if msg.sender is not owner', async () => {
      await expect(
        oracleContract.tx.update_config(
          { account: alice },
          alice.account.address,
        ),
      ).to.be.revertedWith('unauthorized');
    });

    it('update config by owner', async () => {
      const ex_response = await oracleContract.tx.update_config(
        { account: owner },
        alice.account.address,
      );

      await expect(oracleContract.query.config()).to.respondWith({
        owner: alice.account.address,
      });

      expect(ex_response.logs[0].events[1].attributes[1].key).to.be.equal(
        'action',
      );
      expect(ex_response.logs[0].events[1].attributes[1].value).to.be.equal(
        'update_config',
      );
    });

    after(async () => {
      // Restore config back
      await oracleContract.tx.update_config(
        { account: alice },
        owner.account.address,
      );
    });
  });

  describe('register_asset', () => {
    it('fail if msg.sender is not owner', async () => {
      await expect(
        oracleContract.tx.register_asset(
          { account: alice },
          {
            native_token: {
              denom: 'uscrt',
            },
          },
          alice.account.address,
        ),
      ).to.be.revertedWith('unauthorized');
    });

    it('register native asset by owner', async () => {
      const ex_response = await oracleContract.tx.register_asset(
        { account: owner },
        {
          native_token: {
            denom: 'uscrt',
          },
        },
        alice.account.address,
      );

      await expect(
        oracleContract.query.feeder({
          native_token: {
            denom: 'uscrt',
          },
        }),
      ).to.respondWith(alice.account.address);

      expect(ex_response.logs[0].events[1].attributes[1].key).to.be.equal(
        'action',
      );
      expect(ex_response.logs[0].events[1].attributes[1].value).to.be.equal(
        'register_asset',
      );

      expect(ex_response.logs[0].events[1].attributes[2].key).to.be.equal(
        'asset_key',
      );
      expect(ex_response.logs[0].events[1].attributes[2].value).to.be.equal(
        'native_token_uscrt',
      );

      expect(ex_response.logs[0].events[1].attributes[3].key).to.be.equal(
        'feeder',
      );
      expect(ex_response.logs[0].events[1].attributes[3].value).to.be.equal(
        alice.account.address,
      );
    });

    it('register snip20 asset by owner', async () => {
      const ex_response = await oracleContract.tx.register_asset(
        { account: owner },
        {
          token: {
            contract_addr: 'test_token',
            token_code_hash: 'test_token_code_hash',
            viewing_key: 'test_viewing_key',
          },
        },
        alice.account.address,
      );

      await expect(
        oracleContract.query.feeder({
          token: {
            contract_addr: 'test_token',
            token_code_hash: 'test_token_code_hash',
            viewing_key: 'test_viewing_key',
          },
        }),
      ).to.respondWith(alice.account.address);

      expect(ex_response.logs[0].events[1].attributes[1].key).to.be.equal(
        'action',
      );
      expect(ex_response.logs[0].events[1].attributes[1].value).to.be.equal(
        'register_asset',
      );

      expect(ex_response.logs[0].events[1].attributes[2].key).to.be.equal(
        'asset_key',
      );
      expect(ex_response.logs[0].events[1].attributes[2].value).to.be.equal(
        'snip20_token_test_token',
      );

      expect(ex_response.logs[0].events[1].attributes[3].key).to.be.equal(
        'feeder',
      );
      expect(ex_response.logs[0].events[1].attributes[3].value).to.be.equal(
        alice.account.address,
      );
    });
  });

  describe('feed_price', () => {
    it('fail if msg.sender is not feeder', async () => {
      await expect(
        oracleContract.tx.feed_price({ account: owner }, [
          [
            {
              native_token: {
                denom: 'uscrt',
              },
            },
            '10.3',
          ],
        ]),
      ).to.be.revertedWith('unauthorized');
    });

    it('fail if asset is not registered', async () => {
      await expect(
        oracleContract.tx.feed_price({ account: alice }, [
          [
            {
              native_token: {
                denom: 'uscrt1',
              },
            },
            '10.3',
          ],
        ]),
      ).to.be.revertedWith('not_found');
    });

    it('feed price by feeder', async () => {
      const currentTime = Date.now() / 1000;
      const ex_response = await oracleContract.tx.feed_price(
        { account: alice },
        [
          [
            {
              native_token: {
                denom: 'uscrt',
              },
            },
            '10.3',
          ],
        ],
      );

      const latestPrice = await oracleContract.query.latest_price({
        native_token: {
          denom: 'uscrt',
        },
      });
      expect(latestPrice.price).to.be.equal('10.3');
      expect(latestPrice.last_updated_time)
        .to.be.greaterThanOrEqual(currentTime - 2)
        .to.be.lessThanOrEqual(currentTime + 2);

      expect(ex_response.logs[0].events[1].attributes[1].key).to.be.equal(
        'action',
      );
      expect(ex_response.logs[0].events[1].attributes[1].value).to.be.equal(
        'feed_price',
      );

      expect(ex_response.logs[0].events[1].attributes[2].key).to.be.equal(
        'asset_key',
      );
      expect(ex_response.logs[0].events[1].attributes[2].value).to.be.equal(
        'native_token_uscrt',
      );

      expect(ex_response.logs[0].events[1].attributes[3].key).to.be.equal(
        'price',
      );
      expect(ex_response.logs[0].events[1].attributes[3].value).to.be.equal(
        '10.3',
      );
    });
  });
});
