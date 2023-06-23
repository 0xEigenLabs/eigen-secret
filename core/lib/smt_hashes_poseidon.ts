const { buildPoseidon } = require("circomlibjs");
const { getCurveFromName } = require("ffjavascript-browser");

export default async function getHashes() {
    const bn128 = await getCurveFromName("bn128", true);
    const poseidon = await buildPoseidon();
    return {
        hash0: function(left: any, right: any) {
            return poseidon([left, right]);
        },
        hash1: function(key: any, value: any) {
            return poseidon([key, value, bn128.Fr.one]);
        },
        F: bn128.Fr
    }
}
