## Init DB

```
npx sequelize-cli model:generate --name AssetModel --attributes assetId:string,contractAddress:string
npx sequelize-cli model:generate --name AccountModel --attributes alias:string,ethAddress:string,accountKeyPubKey:string,secretAccount:text
npx sequelize-cli model:generate --name NoteModel --attributes alias:string,index:string,pubKey:string,content:text,state:integer
npx sequelize-cli model:generate --name ProofModel --attributes alias:string,proof:text,state:integer
npx sequelize-cli model:generate --name SMTModel --attributes key:string,value:text
npx sequelize-cli model:generate --name TransactionModel --attributes alias:string,txData:text,proof:text,operation:string,publicInput:text,status:integer
```
