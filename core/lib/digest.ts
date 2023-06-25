const createBlakeHash = require("blake-hash");
import { uint8Array2Bigint } from "./utils";

export const calcAliasHash = async (eddsa: any, alias: string) => {
    const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(alias).digest().slice(0, 32));
    const aliasHash = await uint8Array2Bigint(aliasHashBuffer);
    return aliasHash;
}
