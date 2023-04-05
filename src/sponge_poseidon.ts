const buildPoseidon = require("circomlibjs").buildPoseidon;

export async function poseidonSponge(
    values: bigint[]
) {
    let poseidon = await buildPoseidon();
    const BATCH_SIZE = 6;

    let frame = new Array(6).fill(0n);
    let dirty = false;
    let fullHash = 0n;
    let k = 0;
    for (let i = 0; i < values.length; i++) {
        dirty = true;
        frame[k] = values[i];
        if (k == BATCH_SIZE - 1) {
            fullHash = poseidon(frame);
            dirty = false;
            frame = frame.fill(0n);
            frame[0] = fullHash;
            k = 1;
        } else {
            k++;
        }
    }
    if (dirty) {
        // we haven't hashed something in the main sponge loop and need to do hash here
        fullHash = poseidon(frame);
    }

    return poseidon.F.toObject(fullHash);
}
