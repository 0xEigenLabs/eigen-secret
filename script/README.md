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
```

4. Build and launch service

```
 docker-compose up -d --build
```