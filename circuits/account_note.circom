pragma circom 2.0.2;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

template AccountNoteCompressor() {
    signal input npk[2];
    signal input spk[2];
    signal input alias_hash;
    signal output out;

    component hash = Poseidon(5);
    hash.inputs[0] <== npk[0];
    hash.inputs[1] <== npk[1];
    hash.inputs[2] <== spk[0];
    hash.inputs[3] <== spk[1];
    hash.inputs[4] <== alias_hash;

    hash.out ==> out;
}
