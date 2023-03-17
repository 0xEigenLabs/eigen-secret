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
        type: DataTypes.TEXT,
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

export enum TransactionModelStatus {
    UNKNOWN = 1,
    CREATED = 2,
    AGGREGATING = 3,
    SETTLED = 4,
}

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

  let transaction: any;

  try {
      transaction = await sequelize.transaction();
      let isAliasAvailable = await TransactionModel.findOne({ where: { alias: alias, pubKey: pubKey } } );
      console.log(isAliasAvailable);

      if (isAliasAvailable === null) {
          let result = await TransactionModel.create({
              alias: alias,
              pubKey: pubKey,
              content: content,
              proof: proof,
              publicInput: publicInput,
              status: TransactionModelStatus.CREATED
          }, { transaction });
          await transaction.commit();
          return res.json(util.succ(result))
      }
      return res.json(util.err(util.ErrCode.DBCreateError, "Duplicated transaction found"));
  } catch (err: any) {
      if (transaction) {
          transaction.rollback();
      }
      return res.json(util.err(util.ErrCode.DBCreateError, err.toString()));
  }
}

// add new key
export async function getTxByAccountId(req: any, res: any) {
    const alias = req.params.alias;
    console.log(alias);
    let result: any;
    try {
        result = await TransactionModel.findAll({ where: { alias: alias } });
    } catch (err: any) {
        console.log(err)
        return res.json(util.err(util.ErrCode.DBCreateError, err.toString()));
    }
    return res.json(util.succ(result));
}

