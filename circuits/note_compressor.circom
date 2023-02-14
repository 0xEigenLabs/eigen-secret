pragma circom 2.0.0;
include "../node_modules/circomlib/circuits/poseidon.circom";

template NoteCompressor() {
    signal input val;
    signal input secret;
    signal input account_id;
    signal input nonce;
    signal input asset_id;
    signal output out;

    component hash = Poseidon(5);

    hash.inputs[0] <== val;
    hash.inputs[1] <== secret;
    hash.inputs[2] <== account_id;
    hash.inputs[3] <== nonce;
    hash.inputs[4] <== asset_id;

    hash.out ==> out;
}

