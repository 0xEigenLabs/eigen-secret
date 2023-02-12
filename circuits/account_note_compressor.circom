include "../node_modules/circomlib/circuits/poseidon.circom";

template AccountNoteCompressor() {
    signal input npk;
    signal input spk;
    signal input account_id;
    signal output out;

    component hash = Poseidon(3, 6, 8, 57);

    hash.inputs[0] <== npk;
    hash.inputs[1] <== spk;
    hash.inputs[2] <== account_id;

    hash.out ==> out;
}
