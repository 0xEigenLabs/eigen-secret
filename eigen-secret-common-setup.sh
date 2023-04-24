#!/bin/bash
set -ex

npm run deploy:dev
export TOKEN=0x0165878A594ca255338adfa4d48449f69242Eb8F
npx hardhat create-account --alias Alice --index 0 --network dev

npx hardhat setup-rollup --network dev
npx hardhat register-token --token $TOKEN --network dev

npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id 2 --network dev
npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id 2 --network dev
npx hardhat deposit --alias Alice --index 0 --value 10 --asset-id 2 --network dev

npx hardhat create-account --alias Bob --index 1 --network dev
npx hardhat send-l1 --alias Alice --asset-id 2 --receiver 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 --value 100 --network dev

npx hardhat deposit --alias Bob --index 1 --value 10 --asset-id 2 --network dev
npx hardhat deposit --alias Bob --index 1 --value 10 --asset-id 2 --network dev

npx hardhat get-balance --alias Alice --index 0 --asset-id 2 --network dev
npx hardhat get-balance --alias Bob --index 1 --asset-id 2 --network dev
