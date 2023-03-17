const { Sequelize, DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import consola from "consola";
import * as util from "./util";

class TransactionModel extends Model {}

TransactionModel.init({
    // Model attributes are defined here
    alias: {
        type: DataTypes.STRING,
        allowNull: false
    },
    pubKey: {
        type: DataTypes.STRING,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    proof: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    publicInput: {
        type: DataTypes.JSON,
        allowNull: false
    },
    status: {
        type: DataTypes.INTEGER, // 1: UNKNOWN; 2. CREATED, 3: AGGREGATING, 4. SETTLED
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "TransactionModel" // We need to choose the model name
});

// add new key
export async function createTx(req: any, res: any) {
  consola.log("create tx");
  const alias = req.body.alias;
  const pubKey = req.body.pubKey;
  const content = req.body.content;
  const proof = req.body.proof;
  const publicInput = req.body.publicInput;

  if (!util.hasValue(alias) ||
      !util.hasValue(pubKey) ||
      !util.hasValue(content) ||
      !util.hasValue(proof) ||
      !util.hasValue(publicInput)
  ) {
    consola.error("missing one or more arguments");
    return res.json(util.err(util.ErrCode.InvalidInput, "missing input"));
  }

  let isAliasAvailable = await TransactionModel.findOne({ where: { alias: alias, pubKey: pubKey } } );
  if (isAliasAvailable === null) {
      let result = await TransactionModel.create({
          alias: alias,
          pubKey: pubKey,
          content: content,
          proof: proof,
          publicInput: publicInput
      });
      return res.json(result)
  }
  res.json(util.err(util.ErrCode.DBCreateError, "Duplicated transaction found"));
}

// add new key
export async function getTxByAccountId(req: any, res: any) {
  const alias = req.params.alias;
  let result = await TransactionModel.findAll({ where: {alias: alias} });
  return res.json(result);
}

