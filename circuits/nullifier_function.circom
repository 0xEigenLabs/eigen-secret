pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/poseidon.circom";

template NullifierFunction(nLevel) {
    signal input nc;
    signal input input_note_in_use;
    signal input nk;
    signal output out;

    component hash = Poseidon(3);
    hash.inputs[0] <== nc;
    hash.inputs[1] <== input_note_in_use;
    hash.inputs[2] <== nk;

    hash.out ==> out;
}
