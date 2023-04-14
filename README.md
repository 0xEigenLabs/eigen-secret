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
npm run deploy
npm run build && npx hardhat ci --network dev
```
