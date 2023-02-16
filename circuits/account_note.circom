pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

template AccountNoteCompressor() {
    signal input npk[2][4];
    signal input spk[2][4];
    signal input account_id;
    signal output out;

    component hash = Poseidon(9);
    for (var i = 0; i < 2; i ++) {
        var low = npk[i][0] * (2**64) + npk[i][1];
        var high = npk[i][2] * (2**64) + npk[i][3];
        hash.inputs[i*2] <== low;
        hash.inputs[i*2+1] <== high;
    }
    for (var i = 0; i < 2; i ++) {
        var low = spk[i][0] * (2**64) + spk[i][1];
        var high = spk[i][2] * (2**64) + spk[i][3];
        hash.inputs[4 + i*2] <== low;
        hash.inputs[4 + i*2+1] <== high;
    }
    hash.inputs[8] <== account_id;

    hash.out ==> out;
}

/*
template AccountNote(nLevel) {
    //constant
    var TYPE_CREATE = 1;
    var TYPE_UPDATE = 2;
    var TYPE_MIGRATE = 3;

    var NOTE_VALUE_BIT_LENGTH = 2**252;
    var NUM_ASSETS_BIT_LENGTH = 1000;
    var gibberish = 0x1234;

    // public input
    siganl input migrate;

    // public input
    signal input proof_id;
    signal input public_input; // alias: account_public_key_x
    signal input public_ouput; // alias: account_public_key_y
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
    var output_nonce = migrate + nonce
    var output_account_id = alias_hash + (output_nonce * (2**224))

    component nonce_is_zero = IsEqual();
    nonce_is_zero.in[0] <== nonce;
    nonce_is_zero.in[1] <== 0;
    var assert_account_exists = nonce_is_zero.out;

    component mux_signer = Mux1();
    mux_signer.in[0] <== account_public_key;
    mux_signer.in[1] <== signing_public_key;
    mux_signer.s <== nonce_is_zero.out;
    var signer = mux_signer.out;

    component msg_compressor = Poseidon(4);
    message = Poseidon(account_public_key, account_id, spending_public_key_1.x, spending_public_key_2.x)
    account_note_data = Poseidon(account_id, account_public_key.x, signer.x)

    component migrate_is_zero = IsEqual();
    migrate_is_zero.in[0] <== migrate;
    migrate_is_zero.in[1] <== 0;
    var is_nullifier_fake = migrate_is_zero.out;

    output_note_1_x/y = Poseidon(output_account_id, account_public_key.x, account_public_key.y, spending_public_key_1.x, spending_public_key_1.y)
    output_note_2_x/y = Poseidon(output_account_id, account_public_key.x, account_public_key.y, spending_public_key_2.x, spending_public_key_2.y)
    nullifier_1 = Poseidon(proof_id + (is_nullifier_fake * (2**250)), account_id, !migrate * gibberish)
    nullifier_2 = Poseidon(proof_id + (1 * 2^250), gibberish)

    //constraints
    //migrate == 1 || migrate == 0
    (migrate - 1) * migrate === 0;
    // TODO: verify_signature(message, signer, signature) == 1
    // TODO: membership_check(account_note_data, account_note_index, account_note_path, data_tree_root) == assert_account_exists
}
*/
