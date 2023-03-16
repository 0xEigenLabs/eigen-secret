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
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "TransactionModel" // We need to choose the model name
});

// add new key
export async function createTx(req: any, res: any) {
  consola.log("crate tx");
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

  const result = util.succ("");

  res.json(result);
}

// add new key
export async function getTxByAccountId(req: any, res: any) {
  const result = util.succ("");
  res.json(result);
}

