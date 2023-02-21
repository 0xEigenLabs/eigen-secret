pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../third-party/circom-ecdsa/circuits/ecdsa.circom";
include "state_tree.circom";
include "account_note.circom";
include "nullifier_function.circom";
include "note_compressor.circom";

template Digest(k) {
    assert(k < 7);
    signal input nc_1;
    signal input nc_2;
    signal input output_note_nc_1[2];
    signal input output_note_nc_2[2];
    signal input public_owner;
    signal input public_value;
    signal output out[k];

    component hash = PoseidonEx(8, k);
    hash.initialState <== 0;
    hash.inputs[0] <== nc_1;
    hash.inputs[1] <== nc_2;
    hash.inputs[2] <== output_note_nc_1[0];
    hash.inputs[3] <== output_note_nc_1[1];
    hash.inputs[4] <== output_note_nc_2[0];
    hash.inputs[5] <== output_note_nc_2[1];
    hash.inputs[6] <== public_value;
    hash.inputs[7] <== public_owner;

    out <== hash.out;
}

template JoinSplit(nLevel) {
    //constant
    var TYPE_DEPOSIT = 1;
    var TYPE_WITHDRAW = 2;
    var TYPE_SEND = 3;

    var NOTE_VALUE_BIT_LENGTH = 2**128;
    var NUM_ASSETS_BIT_LENGTH = 1000;

    // public input
    signal input proof_id;
    signal input public_value;
    signal input public_owner;
    signal input public_asset_id;
    signal input num_input_notes;
    signal input output_nc_1_x; //(nc is short for note commitment)
    signal input output_nc_1_y;
    signal input output_nc_2_x;
    signal input output_nc_2_y;
    signal input nullifier_1;
    signal input nullifier_2;
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
    signal input account_note_npk[2][4]; // (npk=account public key, ECDSA)
    signal input account_note_spk[2]; // (spk=view public key, EdDSA)
    signal input siblings_ac[nLevel];
    signal input nk[4]; // (nk = account private key, ECDSA)
    signal input signature[2][4]; // ecdsa signature

    component is_deposit = IsEqual();
    is_deposit.in[0] <== proof_id;
    is_deposit.in[1] <== TYPE_DEPOSIT;

    component is_withdraw = IsEqual();
    is_withdraw.in[0] <== proof_id;
    is_withdraw.in[1] <== TYPE_WITHDRAW;

    var public_input_ = public_value * is_deposit.out;
    var public_output_ = public_value * is_withdraw.out;

    //range check
    component is_same_asset[2];
    component is_less_than[2][2];
    for(var i = 0;  i < 2; i ++) {
        is_same_asset[i] = IsEqual();
        is_same_asset[i].in[0] <== input_note_account_id[i];
        is_same_asset[i].in[1] <== account_note_account_id;
        is_same_asset[i].out === 1;

        is_less_than[i][0] = LessEqThan(252);
        is_less_than[i][0].in[0] <== input_note_val[i];
        is_less_than[i][0].in[1] <== NOTE_VALUE_BIT_LENGTH;

        is_less_than[i][1] = LessEqThan(252);
        is_less_than[i][1].in[0] <== input_note_asset_id[i];
        is_less_than[i][1].in[1] <== NUM_ASSETS_BIT_LENGTH;
    }

    //note validity check
    component nc[2];
    component nf[2];
    component ms[2];
    for(var i = 0;  i < 2; i ++) {
        nc[i] = NoteCompressor();
        nc[i].val <== input_note_val[i];
        nc[i].asset_id <== input_note_asset_id[i];
        nc[i].secret <== input_note_secret[i];
        nc[i].account_id <== input_note_account_id[i];
        nc[i].nonce <== input_note_nonce[i];

        ms[i] = Membership(nLevel);
        ms[i].key <== nc[i].out;
        ms[i].value <== num_input_notes;
        ms[i].root <== data_tree_root;
        for (var j = 0; j < nLevel; j++) {
            ms[i].siblings[j] <== siblings[i][j];
        }

        nf[i] = NullifierFunction(nLevel);
        nf[i].nc <== nc[i].out;
        nf[i].nk <== nk;
        for (var j = 0; j < nLevel; j++) {
            nf[i].siblings[j] <== siblings[i][j];
        }

        nf[i].out === 0;
    }

    component ac = AccountNoteCompressor();
    ac.npk <== account_note_npk;
    ac.spk <== account_note_spk;
    ac.account_id <== account_note_account_id;

    component ams = Membership(nLevel);
    ams.key <== ac.out;
    ams.value <== 1; //TODO
    for (var j = 0; j < nLevel; j++) {
        ams.siblings[j] <== siblings_ac[j];
    }

    // check private key to public key
    component pri2pub = ECDSAPrivToPub(64, 4);
    pri2pub.privkey <== nk;
    pri2pub.pubkey === account_note_npk;

    //check signature
    component msghash = Digest(4);
    msghash.nc_1 <== nc[0].out;
    msghash.nc_2 <== nc[1].out;
    msghash.output_note_nc_1[0] <== output_nc_1_x;
    msghash.output_note_nc_1[1] <== output_nc_1_y;
    msghash.output_note_nc_2[0] <== output_nc_2_x;
    msghash.output_note_nc_2[1] <== output_nc_2_y;
    msghash.public_value <== public_value;
    msghash.public_owner <== public_owner;

    component sig_verifier = ECDSAVerifyNoPubkeyCheck(64, 4);
    sig_verifier.r <== signature[0];
    sig_verifier.s <== signature[1];
    sig_verifier.msghash <== msghash.out;
    sig_verifier.pubkey <== account_note_npk;
    sig_verifier.result === 1;

    // check value
    //case 1: num_input_notes < 1 && input_note_1.value == 0
    component note_num_less[2];
    note_num_less[0] = LessThan(252);
    note_num_less[0].in[0] <== num_input_notes;
    note_num_less[0].in[1] <== 1;
    note_num_less[0].out * input_note_val[0] === 0;

    //case 2: num_input_notes < 2 && input_note_2.value == 0
    note_num_less[1] = LessThan(252);
    note_num_less[1].in[0] <== num_input_notes;
    note_num_less[1].in[1] <== 2;
    note_num_less[1].out * input_note_val[1] === 0;

    // transfer balance check
    var total_in_value = public_input_ + input_note_val[0] + input_note_val[1];
    var total_out_value = public_output_ + output_note_val[0] + output_note_val[1];
    component balanceEqual = IsEqual();
    balanceEqual.in[0] <== total_in_value;
    balanceEqual.in[1] <== total_out_value;
    1 === balanceEqual.out;

    // asset type check
    input_note_asset_id[0] === input_note_asset_id[1];
    output_note_asset_id[0] === input_note_asset_id[1];
    output_note_asset_id[0] === output_note_asset_id[1];
    //check: public_asset_id == input_note_1.asset_id <==> (public_input_ != 0 || public_output != 0)
    component public_input_1 = IsEqual();
    public_input_1.in[0] <== public_input_;
    public_input_1.in[1] <== 0;
    component public_output_1 = IsEqual();
    public_output_1.in[0] <== public_output_;
    public_output_1.in[1] <== 0;

    component xor = XOR();
    xor.a <== public_input_1.out;
    xor.b <== public_output_1.out;

    component asset_id_eq = IsEqual();
    asset_id_eq.in[0] <== public_asset_id;
    asset_id_eq.in[1] <== input_note_asset_id[0];

    component and = AND();
    and.a <== xor.out;
    and.b <== asset_id_eq.out;
    and.out === 1;
}
