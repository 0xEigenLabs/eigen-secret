pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/poseidon.circom";

template NullifierFunction(nLevel) {
    signal input nc;
    signal input input_note_in_use;
    signal input nk[4];
    signal output out;

    component hash = Poseidon(6);

    hash.inputs[0] <== nc;
    hash.inputs[1] <== input_note_in_use;
    for (var i = 0; i < 4; i ++) {
        hash.inputs[2 + i] <== nk[i];
    }

    hash.out ==> out;
}
