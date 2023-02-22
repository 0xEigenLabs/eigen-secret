pragma circom 2.0.2;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

template AccountNoteCompressor() {
    signal input npk[2][4];
    signal input spk[2];
    signal input alias_hash;
    signal output out;

    component hash = Poseidon(7);
    for (var i = 0; i < 2; i ++) {
        var low = npk[i][0] * (2**64) + npk[i][1];
        var high = npk[i][2] * (2**64) + npk[i][3];
        hash.inputs[i*2] <== low;
        hash.inputs[i*2+1] <== high;
    }
    hash.inputs[4] <== spk[0];
    hash.inputs[5] <== spk[1];
    hash.inputs[6] <== alias_hash;

    hash.out ==> out;
}
