## Deploy

1. Generate the docker-compose.yml
```
python script/deploy.py --NODE_ENV "dev" --PORT_OFFSET 1
```
The default env is preview. 

2. Build and launch service

```
 docker-compose up -d --build
```
