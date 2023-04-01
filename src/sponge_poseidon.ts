const buildPoseidon = require("circomlibjs").buildPoseidon;

function getValueByIndex(
    arr: bigint[],
    idx: number,
    length: number
) {
    if (idx < length) {
        return arr[idx];
    }
    return 0n;
}

export async function poseidonSponge(
    values: bigint[]
) {
    let poseidon = await buildPoseidon();
    const HASH_FN_BATCH_SIZE = 6;
    const BATCH_SIZE = 5;

    let iterationCount = 0;
    let length = values.length;
    let fullHash = poseidon(
        [
            getValueByIndex(values, 0, length),
            getValueByIndex(values, 1, length),
            getValueByIndex(values, 2, length),
            getValueByIndex(values, 3, length),
            getValueByIndex(values, 4, length),
            getValueByIndex(values, 5, length)
        ]
    );

    let restLength = length - HASH_FN_BATCH_SIZE;
    if (restLength > 0) {
        let r = restLength % BATCH_SIZE;
        let diff = 0;
        if (r != 0) {
            diff = BATCH_SIZE - r;
        }
        iterationCount = (restLength + diff) / BATCH_SIZE;
    }

    for (let i = 0; i < iterationCount; i++) {
        let elemIdx = i * BATCH_SIZE + HASH_FN_BATCH_SIZE;
        fullHash = poseidon(
            [
                fullHash,
                getValueByIndex(values, elemIdx, length),
                getValueByIndex(values, elemIdx + 1, length),
                getValueByIndex(values, elemIdx + 2, length),
                getValueByIndex(values, elemIdx + 3, length),
                getValueByIndex(values, elemIdx + 4, length)
            ]
        );
    }

    return poseidon.F.toObject(fullHash);
}
