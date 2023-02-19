pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/poseidon.circom";

template NullifierFunction(nLevel) {
    signal input nc;
    signal input siblings[nLevel];
    signal input nk[4];
    signal output out;

    component hash = Poseidon(6);

    hash.inputs[0] <== nc;

    // FIXME
    var base = 0;
    for (var i = 0; i < nLevel; i ++) {
        base = base + siblings[i] * (2**i);
    }
    hash.inputs[1] <== base;
    for (var i = 0; i < 4; i ++) {
        hash.inputs[2 + i] <== nk[i];
    }

    hash.out ==> out;
}
