pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/poseidon.circom";

template NoteCompressor() {
    signal input val;
    signal input secret;
    signal input owner; // public key x
    signal input asset_id;
    signal input input_nullfier;

    signal output out;

    component hash = Poseidon(5);

    hash.inputs[0] <== val;
    hash.inputs[1] <== secret;
    hash.inputs[2] <== owner;
    hash.inputs[3] <== asset_id;
    hash.inputs[6] <== input_nullfier;

    hash.out ==> out;
}

