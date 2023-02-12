include "../node_modules/circomlib/circuits/poseidon.circom";

template NullifierFunction(nLevel) {
    signal input nc;
    signal input siblings[nLevel];
    signal input nk;

    component hash = Poseidon(2 + nLevel, 6, 8, 57);

    hash.inputs[0] <== nc;
    for (var i = 0; i < nLevel; i ++) {
        hash.inputs[1 + i] <== siblings[i];
    }
    hash.inputs[1+nLevel] <== nk;

    hash.out ==> out;
}
