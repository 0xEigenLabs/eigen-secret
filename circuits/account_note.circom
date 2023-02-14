pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

template AccountNoteCompressor() {
    signal input npk[2];
    signal input spk[2];
    signal input account_id;
    signal output out;

    component hash = Poseidon(5);

    hash.inputs[0] <== npk[0];
    hash.inputs[1] <== npk[1];
    hash.inputs[2] <== spk[0];
    hash.inputs[3] <== spk[1];
    hash.inputs[4] <== account_id;

    hash.out ==> out;
}

template AccountNote(nLevel) {
    //constant
    var TYPE_CREATE = 1;
    var TYPE_UPDATE = 2;
    var TYPE_MIGRATE = 3;

    var NOTE_VALUE_BIT_LENGTH = 2**252;
    var NUM_ASSETS_BIT_LENGTH = 1000;

    // public input
    signal input proof_id;
    signal input public_input; // alias: acccount_pubkey_x
    signal input public_ouput; // alias: acccount_pubkey_y
    signal input public_asset_id; // alias: account_id
    signal input output_nc_1_x;
    signal input output_nc_1_y;
    signal input output_nc_2_x;
    signal input output_nc_2_y;
    signal input nullifier_1;
    signal input nullifier_2;
    signal input input_owner;
    signal input output_owner;
    signal input data_tree_root;

    //private input
    signal input input_note_val[2];
    signal input input_note_nonce[2];
    signal input input_note_secret[2];
    signal input input_note_account_id[2];
    signal input input_note_asset_id[2];
    signal input siblings[2][nLevel];
    signal input output_note_val[2];
    signal input output_note_secret[2];
    signal input output_note_account_id[2];
    signal input output_note_asset_id[2];
    signal input output_note_nonce[2];
    signal input account_note_account_id;
    signal input account_note_npk[2]; // (npk=account public key)
    signal input account_note_spk; // (spk=spending public key)
    signal input siblings_ac[nLevel];
    signal input note_num;
    signal input nk; // (account private key)
    signal input signature[2]; // ecdsa signature

    var alias_hash = public_asset_id >> 32; // account_id.slice(0, 28);
    var nonce = public_asset_id & 0xFFFFFFFF  ;//account_id.slice(28, 4)
    output_nonce = migrate + nonce
    output_account_id = alias_hash + (output_nonce * 2^224)
    assert_account_exists = nonce != 0
    signer = nonce == 0 ? account_public_key : signing_public_key
    message = Poseidon(account_public_key, account_id, spending_public_key_1.x, spending_public_key_2.x)
    account_note_data = Poseidon(account_id, account_public_key.x, signer.x)
    is_nullifier_fake = migrate == 0

    output_note_1_x/y = Poseidon(output_account_id, account_public_key.x, account_public_key.y, spending_public_key_1.x, spending_public_key_1.y)
    output_note_2_x/y = Poseidon(output_account_id, account_public_key.x, account_public_key.y, spending_public_key_2.x, spending_public_key_2.y)
    nullifier_1 = Poseidon(proof_id + (is_nullifier_fake * 2^250), account_id, !migrate * gibberish)
    nullifier_2 = Poseidon(proof_id + (1 * 2^250), gibberish)

    //constraints
    migrate == 1 || migrate == 0
    verify_signature(message, signer, signature) == 1
    membership_check(account_note_data, account_note_index, account_note_path, data_tree_root) == assert_account_exists
}
