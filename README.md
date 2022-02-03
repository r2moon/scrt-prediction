# Price Prediction

This repo is a price prediction contracts on [Secret Network](https://scrt.network/).

## Deployed contracts

### Testnet

| Name            | Address                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oracle          | [secret19hd5ywtp9uqczw8e40vq0psgn9zefey02n806e](https://secretnodes.com/secret/chains/pulsar-2/contracts/secret19hd5ywtp9uqczw8e40vq0psgn9zefey02n806e) |
| SCRT prediction | [secret1aaxgtpzv8a3pdkznmwkyh4w99uylj4x4232lg7](https://secretnodes.com/secret/chains/pulsar-2/contracts/secret1aaxgtpzv8a3pdkznmwkyh4w99uylj4x4232lg7) |

## Development

### Environment Setup

1. Install npm dependencies by using `npm i` or `yarn add`
2. Run local node

```sh
docker run -it --rm \
 -p 26657:26657 -p 26656:26656 -p 1337:1337 \
 --name secretdev enigmampc/secret-network-sw-dev
```

3. Update `accounts/local.json` file with the seed accounts of local node.

### How to compile

`yarn compile`

### How to test

`yarn test`

### How to deploy oracle

1. Update `accounts/testnet.json` or `accounts/mainnet.json` with mnemonic.
2. `scripts/deployOracle.js` will deploy oracle contract, and register SCRT native token and set owner address as a feeder. So before run this, please update asset info, and feeder address.
3. Run the following commands
   ```polar run scripts/deployOracle.js --network testnet`

### How to deploy prediction

1. Update `accounts/testnet.json` or `accounts/mainnet.json` with mnemonic.
2. Update config in `scripts/deployPrediction.js`.
3. Run the following commands
   ```polar run scripts/deployPrediction.js --network testnet`
