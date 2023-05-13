const { DataTypes, Model } = require("sequelize");
import sequelize from "./db";
import consola from "consola";
import { ErrCode, succResp, errResp } from "@eigen-secret/core/dist-node/error";
import { Context } from "@eigen-secret/core/dist-node/context";
import { Headers } from "node-fetch";
import fetch from "node-fetch";

class AssetModel extends Model {}

AssetModel.init({
    // Model attributes are defined here
    assetId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    contractAddress: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    // Other model options go here
    sequelize, // We need to pass the connection instance
    modelName: "AssetModel" // We need to choose the model name
});

// create registered asset
export async function createAsset(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    const code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }
    // FIXME: eth address must be coordinator
    let assetId = req.body.assetId
    let contractAddress = req.body.contractAddress

    let newItem = { assetId, contractAddress };

    let transaction: any;
    try {
        transaction = await sequelize.transaction();
        const item = await AssetModel.create(newItem, transaction);
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

export async function getAsset(req: any, res: any) {
    console.log("get asset");
    let ctx = Context.deserialize(req.body.context);
    const code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }
    let assetId = req.body.assetId;
    let contractAddress = req.body.contractAddress;
    console.log(assetId, contractAddress);

    let asset;
    if (assetId) {
        asset = await AssetModel.findAll({ where: { assetId: assetId } });
    } else if (contractAddress) {
        asset = await AssetModel.findAll({ where: { contractAddress: contractAddress } });
    } else {
        asset = []
    }
    return res.json(succResp(asset))
}

export async function getAssetInfo(req: any, res: any) {
    let ctx = Context.deserialize(req.body.context);
    const code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }
    let assetList = await AssetModel.findAll();

    // get price info from dune
    // https://dune.com/queries/2468396
    const DUNE_API_KEY = process.env.DUNE_API_KEY as string
    const DUNE_QUERY_ID = process.env.DUNE_QUERY_KEY as string
    const queryID = Number(DUNE_QUERY_ID) || 2468396;

    const meta = {
        "x-dune-api-key": DUNE_API_KEY
    };
    const header = new Headers(meta);
    let response = await fetch( `https://api.dune.com/api/v1/query/${queryID}/results?api_key=${DUNE_API_KEY}`, {
        method: "GET",
        headers: header
    });
    const body = JSON.parse(await response.text());
    console.log(body);
    if (body.state != "QUERY_STATE_COMPLETED") {
        return res.json(errResp(ErrCode.Unknown, "Fetch price from Dune error"));
    }
    const result: Array<any> = body.result?.rows;

    for (let priceInfo of result) {
        for (let ai of assetList) {
            if (ai.contractAddress == priceInfo.token_address) {
                priceInfo.assetId = ai.assetId;
            }
        }
    }

    return res.json(succResp(result));
}

export async function executeQuery(req: any, res: any) {
    // Add the API key to an header object
    let ctx = Context.deserialize(req.body.context);
    const code = ctx.check();
    if (code !== ErrCode.Success) {
        return res.json(errResp(code, ErrCode[code]));
    }
    let assetInfo = req.body.assetInfo || {}; // {id: val}
    let assetIdList = Object.keys(assetInfo);
    let assetList = await AssetModel.findAll({ where: { assetId: assetIdList } });
    let contractAddresses = assetList.map((x : any) => x.contractAddress);

    // get price info from dune
    // https://dune.com/queries/2468396
    const DUNE_API_KEY = process.env.DUNE_API_KEY as string

    // Add parameters we would pass to the query
    let params = { "query_parameters": { "contract_addresses": contractAddresses.join(",") } };
    let body = JSON.stringify(params);

    //  Call the Dune API
    let DUNE_QUERY_ID = process.env.DUNE_QUERY_KEY as string
    let queryID = Number(DUNE_QUERY_ID) || 2468396;
    const meta = {
        "x-dune-api-key": DUNE_API_KEY
    };
    const header = new Headers(meta);
    let response = await fetch(`https://api.dune.com/api/v1/query/${queryID}/execute`, {
        method: "POST",
        headers: header,
        body: body // This is where we pass the parameters
    });
    const response_object = await response.text();

    // Log the returned response
    console.log(response_object);
}
