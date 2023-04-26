pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "digest.circom";
include "if_gadgets.circom";
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
    var TYPE_CREATE = 11;
    var TYPE_MIGRATE = 12;
    var TYPE_UPDATE = 13;

    // private selector
    signal input enabled;

    // public input
    signal input proof_id;
    signal input public_value; // 0
    signal input public_owner; // 0
    signal input num_input_notes; // 0
    signal input output_nc_1; //(nc is short for note commitment)
    signal input output_nc_2;
    signal input data_tree_root;
    signal input public_asset_id; // 0

    // private input
    signal input alias_hash;
    signal input account_note_npk[2]; // (npk=account public key)
    signal input account_note_spk[2]; // (spk=signing public key)
    signal input new_account_note_npk[2]; // (npk=account public key)
    signal input new_account_note_spk1[2]; // (spk=signing public key)
    signal input new_account_note_spk2[2]; // (spk=signing public key)
    signal input signatureR8[2];
    signal input signatureS;
    signal input siblings_ac[nLevel];

    //log("proof_id account");
    //log(proof_id);
    //log(enabled);
    enabled * public_owner === 0;
    enabled * public_value === 0;
    enabled * num_input_notes === 0;
    enabled * public_asset_id === 0;
    component is_create_c = IsEqual();
    is_create_c.in[0] <== TYPE_CREATE;
    is_create_c.in[1] <== proof_id;
    var is_create = is_create_c.out;

    component is_migrate_c = IsEqual();
    is_migrate_c.in[0] <== TYPE_MIGRATE;
    is_migrate_c.in[1] <== proof_id;
    var is_migrate = is_migrate_c.out;

    component is_update_c = IsEqual();
    is_update_c.in[0] <== TYPE_UPDATE;
    is_update_c.in[1] <== proof_id;
    var is_update = is_update_c.out;

    // is_create = 0 or 1
    signal aux0;
    aux0 <== is_create * (1 - is_create);
    aux0 * enabled === 0;

    // is_migrate = 0 or 1
    signal aux1;
    aux1 <== is_migrate * (1 - is_migrate);
    aux1 * enabled === 0;

    // is_update = 0 or 1
    signal aux2;
    aux2 <== is_update * (1 - is_update);
    aux2 * enabled === 0;

    // is_create + is_migrate + is_update == 1
    component sum_1 = IsEqual();
    sum_1.in[0] <== is_create + is_migrate + is_update;
    sum_1.in[1] <== 1;
    enabled * (sum_1.out - 1) === 0;

    component account_note_commitment = AccountNoteCompressor();
    account_note_commitment.npk <== new_account_note_npk;
    account_note_commitment.spk <== account_note_spk;
    account_note_commitment.alias_hash <== alias_hash;

    component output_note_commitment1 = AccountNoteCompressor();
    output_note_commitment1.npk <== new_account_note_npk;
    output_note_commitment1.spk <== new_account_note_spk1;
    output_note_commitment1.alias_hash <== alias_hash;
    enabled * (output_note_commitment1.out - output_nc_1) === 0;

    component output_note_commitment2 = AccountNoteCompressor();
    output_note_commitment2.npk <== new_account_note_npk;
    output_note_commitment2.spk <== new_account_note_spk2;
    output_note_commitment2.alias_hash <== alias_hash;
    enabled * (output_note_commitment2.out - output_nc_2) === 0;

    component alias_hash_c = Poseidon(1);
    alias_hash_c.inputs[0] <== alias_hash;
    var nullifier1 = is_create * alias_hash_c.out;

    component new_account_c = Poseidon(2);
    new_account_c.inputs[0] <== new_account_note_npk[0];
    new_account_c.inputs[1] <== new_account_note_npk[1];

    component create_or_migrate = OR();
    create_or_migrate.a <== is_create;
    create_or_migrate.b <== is_migrate;
    var nullifier2 = create_or_migrate.out * new_account_c.out;

    // (new_account_public_key != spending_public_key_1) &&
    // (new_account_public_key != spending_public_key_2)
    component new_key_not_equal = AllHigh(4);
    new_key_not_equal.in[0] <== new_account_note_npk[0] - new_account_note_spk1[0];
    new_key_not_equal.in[1] <== new_account_note_npk[1] - new_account_note_spk1[1];
    new_key_not_equal.in[2] <== new_account_note_npk[0] - new_account_note_spk2[0];
    new_key_not_equal.in[3] <== new_account_note_npk[1] - new_account_note_spk2[1];
    enabled * (new_key_not_equal.out - 1) === 0;

    // if (is_migrate == 0) { require(account_public_key == new_account_public_key) }
    // enabled * (1 - is_migrate) * (account_note_npk[0] - new_account_note_npk[0]) === 0;
    signal aux3;
    aux3 <== (1 - is_migrate) * (account_note_npk[0] - new_account_note_npk[0]);
    enabled * aux3 === 0;

    signal aux4;
    aux4 <== (1 - is_migrate) * (account_note_npk[1] - new_account_note_npk[1]);
    enabled * aux4 === 0;

    // check signature
    component msghash = AccountDigest();
    msghash.alias_hash <== alias_hash;
    msghash.account_note_npk_x <== account_note_npk[0];
    msghash.new_account_note_npk_x <== new_account_note_npk[0];
    msghash.new_account_note_spk1_x <== new_account_note_spk1[0];
    msghash.new_account_note_spk2_x <== new_account_note_spk2[0];
    msghash.nullifier1 <== nullifier1;
    msghash.nullifier2 <== nullifier2;
    //log("message");
    //log(alias_hash);
    //log(account_note_npk[0]);
    //log(new_account_note_npk[0]);
    //log(new_account_note_spk1[0]);
    //log(new_account_note_spk2[0]);
    //log(nullifier1);
    //log(nullifier2);

    component sig_verifier = EdDSAPoseidonVerifier();
    sig_verifier.enabled <== enabled;
    sig_verifier.R8x <== signatureR8[0];
    sig_verifier.R8y <== signatureR8[1];
    sig_verifier.S <== signatureS;
    sig_verifier.M <== msghash.out;
    //log("msghash");
    //log(msghash.out);
    sig_verifier.Ax <== account_note_spk[0];
    sig_verifier.Ay <== account_note_spk[1];

    //if (is_create == 0) { require(membership_check(account_note_data, account_note_index, account_note_path, data_tree_root) == true) }
    // FIXME: the key is the merkle path, and the value is is commitment
    // https://wiki.polygon.technology/docs/zkEVM/zkProver/detailed-smt-concepts
    component ms = Membership(nLevel);
    ms.key <== account_note_commitment.out;
    ms.value <== 1; 
    ms.root <== data_tree_root;
    ms.enabled <== (1 - is_create) * enabled;

    //log(account_note_commitment.out);
    //log(data_tree_root);
    for (var j = 0; j < nLevel; j++) {
        ms.siblings[j] <== siblings_ac[j];
        //log(siblings_ac[j]);
    }
}
