pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "digest.circom";
include "state_tree.circom";

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

template Account(nLevel) {
    // public input
    signal input proof_id;
    signal input public_value;
    signal input public_owner;
    signal input num_input_notes;
    signal input output_nc_1; //(nc is short for note commitment)
    signal input output_nc_2;
    signal input data_tree_root;
    signal input public_asset_id;

    // private input
    signal input asset_id;
    signal input alias_hash;

    signal input account_note_npk[2]; // (npk=account public key)
    signal input new_account_note_npk[2]; // (npk=account public key)
    signal input account_note_spk[2]; // (spk=signing public key)
    signal input new_account_note_spk1[2]; // (spk=signing public key)
    signal input new_account_note_spk2[2]; // (spk=signing public key)
    signal input signatureR8[2];
    signal input signatureS;
    signal input is_create;
    signal input is_migrate;
    signal input siblings_ac;

    // check signature
    component msghash = AccountDigest();
    msghash.alias_hash <== alias_hash;
    msghash.account_note_npk_x <== account_note_npk[0];
    msghash.new_account_note_npk_x <== new_account_note_npk[0];
    msghash.account_note_spk_x <== account_note_spk[0];


    component account_note_commitment = AccountNoteCompressor();
    account_note_commitment.npk <== account_note_npk;
    account_note_commitment.spk <== account_note_spk;
    account_note_commitment.alias_hash <== alias_hash;

    component output_note_commitment1 = AccountNoteCompressor();
    output_note_commitment1.npk <== new_account_note_npk;
    output_note_commitment1.spk <== new_account_note_spk1;
    output_note_commitment1.alias_hash <== alias_hash;
    output_note_commitment1 === output_nc_1;

    component output_note_commitment2 = AccountNoteCompressor();
    output_note_commitment2.npk <== new_account_note_npk;
    output_note_commitment2.spk <== new_account_note_spk2;
    output_note_commitment2.alias_hash <== alias_hash;
    output_note_commitment2 === output_nc_2;

    var nullifier1 = is_create * alias_hash;  // TODO: compress alias_hash
    var nullifier2 = (is_create + is_migrate) * new_account_note_npk; // TODO: compress pk

    // is_create = 0 or 1
    component one_or_zero = LessThan(252);
    one_or_zero.in[0] <== is_create;
    one_or_zero.in[0] <== 2;
    one_or_zero.out ===  1;

    // is_migrate = 0 or 1
    component one_or_zero2 = LessThan(252);
    one_or_zero2.in[0] <== is_migrate;
    one_or_zero2.in[0] <== 2;
    one_or_zero2.out ===  1;

    // is_create && is_migrate == 1
    component sum_1 = IsEqual();
    sum_1.in[0] <== is_create + is_migrate;
    sum_1.in[1] <== 1;
    sum_1.out === 1;

    // (new_account_public_key != spending_public_key_1) &&
    // (new_account_public_key != spending_public_key_2)
    component new_key_not_equal = AllHigh(4);
    new_key_not_equal.in[0] <== new_account_note_npk[0] - new_account_note_spk1[0];
    new_key_not_equal.in[1] <== new_account_note_npk[1] - new_account_note_spk1[1];
    new_key_not_equal.in[2] <== new_account_note_npk[0] - new_account_note_spk2[0];
    new_key_not_equal.in[3] <== new_account_note_npk[1] - new_account_note_spk2[1];
    new_key_not_equal.out === 1;

    // if (is_migrate == 0) { require(account_public_key == new_account_public_key) }
    (1 - is_migrate) * (account_note_npk[0] - new_account_note_npk[0] + account_note_npk[1] - new_account_note_npk[1]) === 0;

    component sig_verifier = EdDSAPoseidonVerifier();
    sig_verifier.enabled <== 1;
    sig_verifier.R8x <== signatureR8[0];
    sig_verifier.R8y <== signatureR8[1];
    sig_verifier.S <== signatureS;
    sig_verifier.M <== msghash.out;
    sig_verifier.Ax <== account_note_npk[0]; // FIXME: signing key
    sig_verifier.Ay <== account_note_npk[1];

    //if (is_create == 0) { require(membership_check(account_note_data, account_note_index, account_note_path, data_tree_root) == true) }

    component ms = Membership(nLevel);
    ms.key <== account_note_commitment.out;
    ms.value <== 1; // TODO
    ms.root <== data_tree_root;
    ms.enabled <== is_create;
    for (var j = 0; j < nLevel; j++) {
        ms.siblings[j] <== siblings_ac[j];
    }
}
