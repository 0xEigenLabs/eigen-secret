#!/bin/bash
set -ex

NETWORK=${1-dev}

npm run deploy:$NETWORK
export TOKEN=$(cat .contract.json | jq -r .testToken)
npx hardhat create-account --alias Alice --index 0 --network $NETWORK
npx hardhat setup-rollup --network $NETWORK
npx hardhat register-token --token $TOKEN --network $NETWORK
npx hardhat update-assets --network $NETWORK
_ASSET_ID=$(cat .asset.json | jq -r .assetId)
ASSET_ID=${2-${_ASSET_ID}}
NUM_ACCOUNT=3
npx hardhat create-accounts --num-account ${NUM_ACCOUNT} --network $NETWORK
npx hardhat send-l1 --alias Alice --asset-id ${ASSET_ID} --num-account ${NUM_ACCOUNT} --value 100 --network $NETWORK
npx hardhat get-balances-multi --num-account ${NUM_ACCOUNT} --asset-id ${ASSET_ID}  --expected-l1-balance "100.0" --expected-l2-balance "" --network $NETWORK

npx hardhat deposit-multi --num-account ${NUM_ACCOUNT} --asset-id ${ASSET_ID} --value 40 --network $NETWORK
npx hardhat get-balances-multi --num-account ${NUM_ACCOUNT} --asset-id ${ASSET_ID} --expected-l1-balance "60.0" --expected-l2-balance "40.0" --network $NETWORK

npx hardhat deposit-multi --num-account ${NUM_ACCOUNT} --asset-id ${ASSET_ID} --value 50 --network $NETWORK
npx hardhat get-balances-multi --num-account ${NUM_ACCOUNT} --asset-id ${ASSET_ID} --expected-l1-balance "10.0" --expected-l2-balance "90.0" --network $NETWORK

npx hardhat send-multi --num-account ${NUM_ACCOUNT} --asset-id ${ASSET_ID} --value 10 --network $NETWORK
npx hardhat get-balances-multi --num-account ${NUM_ACCOUNT} --asset-id ${ASSET_ID} --expected-l1-balance "10.0" --expected-l2-balance "90.0" --network $NETWORK

npx hardhat execute-all --num-account ${NUM_ACCOUNT} --asset-id ${ASSET_ID} --value 10 --network $NETWORK
npx hardhat get-balances-multi --num-account ${NUM_ACCOUNT} --asset-id ${ASSET_ID} --network $NETWORK

npx hardhat get-balance --alias Alice --index 0 --asset-id ${ASSET_ID} --network $NETWORK
npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
npx hardhat get-transactions --alias Alice --index 0 --network $NETWORK
npx hardhat get-balance --alias Alice --index 0 --asset-id ${ASSET_ID} --network $NETWORK
npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
npx hardhat get-balance --alias Alice --index 0 --asset-id ${ASSET_ID} --network $NETWORK

npx hardhat deposit --alias Bob --index 1 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
npx hardhat deposit --alias Bob --index 1 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
npx hardhat get-balance --alias Bob --index 1 --asset-id ${ASSET_ID} --network $NETWORK

npx hardhat migrate-account --alias Alice --index 0 --network $NETWORK

npx hardhat get-balance --alias Alice --index 0 --asset-id ${ASSET_ID} --network $NETWORK
npx hardhat get-balance --alias Bob --index 1 --asset-id ${ASSET_ID} --network $NETWORK

npx hardhat deposit --alias Alice --index 0 --value 11 --asset-id ${ASSET_ID} --network $NETWORK

npx hardhat update-account --alias Alice --index 0 --network $NETWORK
npx hardhat deposit --alias Alice --index 0 --value 12 --asset-id ${ASSET_ID} --network $NETWORK

npx hardhat withdraw --alias Alice --index 0 --value 12 --asset-id ${ASSET_ID} --network $NETWORK
npx hardhat get-transactions --alias Alice --index 0 --network $NETWORK
