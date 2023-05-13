const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import consola from "consola";
const tisdk = require("api")("@tokeninsight-api/v1.2.2#457nalf1vname");
const INSIGHT_KEY = process.env.INSIGHT_KEY as string
import { ErrCode, succResp, errResp } from "@eigen-secret/core/dist-node/error";

class TokenModel extends Model {}

TokenModel.init({
    // Model attributes are defined here
    assetId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    tokenAddress: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "TokenModel" // We need to choose the model name
});

// create registered token
export async function createToken(req: any, res: any) {
    let assetId =  req.body.assetId
    let tokenAddress =  req.body.tokenAddress

    let newItem = { assetId, tokenAddress };

    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        const item = await TokenModel.create(newItem, transaction);
        await transaction.commit();
        return res.json(succResp(item));
    } catch (err: any) {
        consola.log(err)
        if (transaction) {
            await transaction.rollback();
        }
        return res.json(errResp(ErrCode.DBCreateError, err.toString()));
    }
}

export async function getToken(req: any, res: any) {
    let assetId = req.body.assetId
    let token = await TokenModel.findOne({ where: { assetId } });
    return res.json(succResp(token))
}

// TODO: convert all assetId to coinId
function getAllCoinIds() {
    return "bitcoin,ethereum,daidai"
}

export async function getTokenPrices(req: any, res: any) {
    let idsStr = getAllCoinIds();

    let result: any;
    try {
        tisdk.auth(INSIGHT_KEY);
        result = await tisdk.getSimplePrice({ ids: idsStr })
    } catch (err: any) {
        console.error(err)
        return res.json(errResp(ErrCode.Unknown, err));
    }
    let tokenPrices = []
    for (const token of result.data.data) {
        tokenPrices.push({ "coinId": token.id, "tokenPrice:": token.price[0].price_latest })
    }

    return res.json(succResp(tokenPrices));
}
