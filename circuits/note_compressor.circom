pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/poseidon.circom";

template NoteCompressor() {
    signal input val;
    signal input secret;
    signal input owner[4]; // public key x
    signal input asset_id;
    signal input input_nullifier;

    signal output out;

    component hash = Poseidon(6);

    hash.inputs[0] <== val;
    hash.inputs[1] <== secret;
    hash.inputs[2] <== owner[0];
    hash.inputs[3] <== owner[1];
    hash.inputs[4] <== asset_id;
    hash.inputs[5] <== input_nullifier;

    hash.out ==> out;
}

