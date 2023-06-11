const { buildPoseidon } = require("circomlibjs");
const createBlakeHash = require("blake-hash");
import { uint8Array2Bigint } from "./utils";

let poseidon: any;

export async function getPoseidon (){
    if (poseidon == undefined) {
        poseidon = await buildPoseidon();
    }
    return poseidon;
}

export function alias2Bigint(eddsa: any, alias: string) {
    const aliasHashBuffer = eddsa.pruneBuffer(
        createBlakeHash("blake512")
        .update(alias).digest().slice(0, 32)
    );
    return uint8Array2Bigint(aliasHashBuffer);
}
