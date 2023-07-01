#!/bin/bash
set -ex

NETWORK=${1-dev}

npm run deploy:$NETWORK
export TOKEN=$(cat .contract.json | jq -r .testToken)
npx hardhat create-account --alias Alice --index 0 --network $NETWORK
npx hardhat setup-rollup --network $NETWORK
npx hardhat register-token --token $TOKEN --network $NETWORK
npx hardhat update-assets --network $NETWORK
ASSET_ID=$(cat .asset.json | jq -r .assetId)
ACCOUNT_NUM=3

npx hardhat create-accounts --account-num ${ACCOUNT_NUM} --network $NETWORK
npx hardhat send-l1 --alias Alice --asset-id ${ASSET_ID} --account-num ${ACCOUNT_NUM} --value 100 --network $NETWORK
npx hardhat get-balances-multi --account-num ${ACCOUNT_NUM} --asset-id 2 --network $NETWORK

npx hardhat deposit-multi --account-num ${ACCOUNT_NUM} --asset-id ${ASSET_ID} --value 50 --network $NETWORK
npx hardhat get-balances-multi --account-num ${ACCOUNT_NUM} --asset-id 2 --network $NETWORK

npx hardhat deposit-multi --account-num ${ACCOUNT_NUM} --asset-id ${ASSET_ID} --value 50 --network $NETWORK
npx hardhat get-balances-multi --account-num ${ACCOUNT_NUM} --asset-id 2 --network $NETWORK

npx hardhat send-multi --account-num ${ACCOUNT_NUM} --asset-id ${ASSET_ID} --value 10 --network $NETWORK
npx hardhat get-balances-multi --account-num ${ACCOUNT_NUM} --asset-id 2 --network $NETWORK

npx hardhat withdraw-multi --account-num ${ACCOUNT_NUM} --asset-id ${ASSET_ID} --value 20 --network $NETWORK
npx hardhat get-balances-multi --account-num ${ACCOUNT_NUM} --asset-id 2 --network $NETWORK

# npx hardhat get-balance --alias Alice --index 0 --asset-id ${ASSET_ID} --network $NETWORK
# npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
# npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
# npx hardhat get-transactions --alias Alice --index 0 --network $NETWORK
# npx hardhat get-balance --alias Alice --index 0 --asset-id ${ASSET_ID} --network $NETWORK
# npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
# npx hardhat get-balance --alias Alice --index 0 --asset-id ${ASSET_ID} --network $NETWORK

# npx hardhat deposit --alias Bob --index 1 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
# npx hardhat deposit --alias Bob --index 1 --value 10 --asset-id ${ASSET_ID} --network $NETWORK
# npx hardhat get-balance --alias Bob --index 1 --asset-id ${ASSET_ID} --network $NETWORK

# npx hardhat migrate-account --alias Alice --index 0 --network $NETWORK

# npx hardhat get-balance --alias Alice --index 0 --asset-id ${ASSET_ID} --network $NETWORK
# npx hardhat get-balance --alias Bob --index 1 --asset-id ${ASSET_ID} --network $NETWORK

# npx hardhat deposit --alias Alice --index 0 --value 11 --asset-id ${ASSET_ID} --network $NETWORK

# npx hardhat update-account --alias Alice --index 0 --network $NETWORK
# npx hardhat deposit --alias Alice --index 0 --value 12 --asset-id ${ASSET_ID} --network $NETWORK

# # TODO: test send
# npx hardhat withdraw --alias Alice --index 0 --value 12 --asset-id ${ASSET_ID} --network $NETWORK
# npx hardhat get-transactions --alias Alice --index 0 --network $NETWORK
