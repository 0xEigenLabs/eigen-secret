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

The network dev is hardhat node, which is used to debug locally. And the hermez is Polygon zkEVMand .

1. deploy contracts
```
npm run deploy:dev
```

2. setup rollup coordinator
```
npx hardhat setup-rollup --contract-file $PWD/.contract.json --network dev

```

set the current account as the coordinator of Rollup contract

3. register token

```
npx hardhat register-token --contract-file $PWD/.contract.json --token 0x0165878A594ca255338adfa4d48449f69242Eb8F --network dev

```

4. create account, make sure that the server is on.

```
npx hardhat create-account --alias Alice --index 0 --network dev
 // accountKey:  eig:b82a1b55d3d2becbbb25e75286c4eaa87ba380b46e4dc3f197d3826d5fe69618
```   
can use `npx hardhat get-account` to get the current account information.

5. deposit asset to L2

```
npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id 2 --network dev
```
6. create another account and deposit

```
npx hardhat create-account --alias Bob --index 1 --network dev
npx hardhat deposit --alias Bob --index 1 --value 10 --asset-id 2 --network dev
```
7. send asset to L2

```
npx hardhat send --alias Bob --value 5 --index 1 --asset-id 2 --receiver eig:b82a1b55d3d2becbbb25e75286c4eaa87ba380b46e4dc3f197d3826d5fe69618 --network dev
// using Alice's accountKey as the receiver.
```

8. withdraw

```
npx hardhat withdraw --alias Bob --index 1 --value 5 --asset-id 2 --network dev
```

9. migrate account

```
npx hardhat migrate-account --network dev
```

10. update account

```
npx hardhat update-account --network dev
```