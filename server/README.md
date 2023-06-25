### Init DB

```
npm run init:db
```

### Create Model

Check out [Sequelize Migration](https://sequelize.org/docs/v6/other-topics/migrations/).

For example,
```
npx sequelize-cli model:generate --name User --attributes firstName:string,lastName:string,email:string
```
