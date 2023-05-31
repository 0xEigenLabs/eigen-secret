## Deploy

1. Clone [eigen-secret](https://github.com/0xEigenLabs/eigen-secret) and [eigen-secret-ui](https://github.com/0xEigenLabs/eigen-secret-ui);

2. Generate the docker-compose.yml
```
python script/deploy.py --NODE_ENV "development" --PORT_OFFSET 1
```
The default env is `development`.

3. Initialize DB

```
npm run init:db
npm run server

```

Open another console and register the token with commands below.

```

NETWORK=mumbai

npm run deploy:$NETWORK
export TOKEN=$(cat .contract.json | jq -r .testToken)
npx hardhat create-account --alias Alice --index 0 --network $NETWORK

npx hardhat setup-rollup --network $NETWORK
npx hardhat register-token --token $TOKEN --network $NETWORK
npx hardhat update-assets --network $NETWORK
```


Update the contract information for UI.

```
cd ..
cp eigen-secret/.contract.json eigen-secret-ui/src/artifacts/contract.json

```

4. Build and launch service

```
 docker-compose up -d --build
```
