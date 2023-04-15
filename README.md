# Eigen Secret

Eigen Secret is a zk-zkRollup providing confidential transaction and selective exposure for users with low gas cost.

Building on Private State Model and zkSnark.

The circuits is written by Circom, proved by [eigen zkit](https://github.com/0xEigenLabs/eigen-zkvm/tree/main/zkit).


## Installation

```
cp .env.sample .env
## configure .env

npm install
npm run build
```

## Test

```
npm run test

# optional, which is used to generate the zkey
cd circuits && ./run.sh main_update_state
```

## Task

1. Start hardhat node
```
npx hardhat node
```

2. Start server in a new terminal

```
npm run server
```

3. Launch another terminal, and run the CI, which includes `create-account`, `deposit`, `send`, and `withdraw`

```
npm run deploy --network dev # npx run deploy:dev
npx hardhat ci --network dev
```

### More tasks

Common arguments:

```
--alias: account id, namely user's alias
--password: password for encrypting the signing key
```

1. deploy contracts
```
npm run deploy:dev
```

2. setup rollup coordinator
```
npx hardhat setup-rollup --network dev

```

set the current account as the coordinator of Rollup contract

3. register token

```
npx hardhat register-token --token 0x0165878A594ca255338adfa4d48449f69242Eb8F --network dev

```

4. create account, make sure that the server is on.

```
npx hardhat create-account --network dev
```

can use `npx hardhat get-account` to get the current account information.

5. deposit asset to L2

```
npx hardhat deposit --value 10 --asset-id 2 --network dev
```

6. send asset to L2

```
npx hardhat deposit --value 10 --asset-id 2 --network dev

```
TODO: specify receiver's public key.

7. withdraw

8. migrate account

9. update account

