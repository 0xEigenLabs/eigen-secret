const tisdk = require("api")("@tokeninsight-api/v1.2.2#457nalf1vname");
const INSIGHT_KEY = process.env.INSIGHT_KEY as string
import { ErrCode, succResp, errResp } from "@eigen-secret/core/dist-node/error";

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
