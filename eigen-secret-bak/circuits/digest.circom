pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/poseidon.circom";

template JoinSplitDigest() {
    signal input nc_1;
    signal input nc_2;
    signal input output_note_nc_1;
    signal input output_note_nc_2;
    signal input public_owner;
    signal input public_value;
    signal output out;

    component hash = Poseidon(6);
    hash.inputs[0] <== nc_1;
    hash.inputs[1] <== nc_2;
    hash.inputs[2] <== output_note_nc_1;
    hash.inputs[3] <== output_note_nc_2;
    hash.inputs[4] <== public_owner;
    hash.inputs[5] <== public_value;

    out <== hash.out;
}

template AccountDigest() {
    signal input alias_hash;
    signal input account_note_npk_x;
    signal input new_account_note_npk_x;
    signal input new_account_note_spk1_x;
    signal input new_account_note_spk2_x;
    signal input nullifier1;
    signal input nullifier2;
    signal output out;

    component hash = Poseidon(7);
    hash.inputs[0] <== alias_hash;
    hash.inputs[1] <== account_note_npk_x;
    hash.inputs[2] <== new_account_note_npk_x;
    hash.inputs[3] <== new_account_note_spk1_x;
    hash.inputs[4] <== new_account_note_spk2_x;
    hash.inputs[5] <== nullifier1;
    hash.inputs[6] <== nullifier2;

    out <== hash.out;
}

template NullifierFunction() {
    signal input nc;
    signal input input_note_in_use;
    signal input nk;
    signal output out;

    component hash = Poseidon(3);
    //log("NullifierFunction");
    //log(nc);
    //log(input_note_in_use);
    //log(nk);
    hash.inputs[0] <== nc;
    hash.inputs[1] <== input_note_in_use;
    hash.inputs[2] <== nk;

    hash.out ==> out;
}
