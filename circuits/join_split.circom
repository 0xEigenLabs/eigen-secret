include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "./state_tree.circom";
include "../third-party/circom-ecdsa/circuits/ecdsa.circom";

template Hasher() {
    signal input nc_1;
    signal input nc_2;
    signal input output_note_nc_1[2];
    signal input output_note_nc_2[2];
    signal input output_owner;
    signal output out;

    component hash = Poseidon(7, 6, 8, 57);

    hash.inputs[0] <== nc_1;
    hash.inputs[1] <== nc_2;
    hash.inputs[2] <== output_note_nc_1[0];
    hash.inputs[3] <== output_note_nc_1[1];
    hash.inputs[4] <== output_note_nc_2[0];
    hash.inputs[5] <== output_note_nc_2[1];
    hash.inputs[6] <== output_owner;

    hash.out ==> out;
}

template JoinSplit(nLevel) {
    //constant
    var TYPE_DEPOSIT = 1;
    var TYPE_WITHDRAW = 2;
    var TYPE_SEND = 3;

    var NOTE_VALUE_BIT_LENGTH = 2**252;
    var NUM_ASSETS_BIT_LENGTH = 1000;

    // public input
    signal input proof_id;
    signal input public_input;
    signal input public_ouput;
    signal input public_asset_id;
    signal input output_nc_1_x; //(nc is short for note commitment)
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

    component is_deposit = IsEqual();
    is_deposit.in[0] <== proof_id;
    is_deposit.in[0] <== TYPE_DEPOSIT;

    var is_withdraw = IsEqual();
    is_withdraw.in[0] <== proof_id;
    is_withdraw.in[0] <== TYPE_WITHDRAW;

    var public_input = public_input * is_deposit.out;
    var public_output = public_input * is_withdraw.out;

    //range check
    for(var i = 0;  i < 2; i ++) {
        component is_same_asset = IsEqual();
        is_same_asset.in[0] <== input_note_account_id[i];
        is_same_asset.in[1] <== account_note_account_id;
        is_same_asset.out === 1;

        component is_less_than[2];
        is_less_than[0] = LessEqThan(252);
        is_less_than[0].in[0] <== input_note_val[i];
        is_less_than[0].in[1] <== NOTE_VALUE_BIT_LENGTH;

        is_less_than[1] = LessEqThan(252);
        is_less_than[1].in[0] <== input_note_asset_id[i];
        is_less_than[1].in[1] <== NUM_ASSETS_BIT_LENGTH;
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
        ms[i].value <== note_num;
        ms[i].root <== data_tree_root;
        for (var j = 0; j < nLevels; j++) {
            ms[i].siblings[j] <== siblings[i][j];
        }

        nf[i] = NullifierFunction(nLevel);
        nf[i].nc <== nc.out;
        nf[i].nk <== nk;
        for (var j = 0; j < nLevels; j++) {
            nf[i].siblings[j] <== siblings[i][j];
        }

        nf[i].out === 0;
    }

    component ac = AccountNoteCompressor();
    ac.npk <== account_note_npk;
    ac.nsk <== account_note_spk;
    ac.account_id <== account_note_account_id;

    component ams = Membership(nLevel);
    ams.key <== ac.out;
    ams.value <== 1; //TODO
    for (var j = 0; j < nLevels; j++) {
        ams.siblings[j] <== siblings_ac[j];
    }

    // check private key to public key
    component pri2pub = ECDSAPrivToPub(64, 4);
    pri2pub.privkey <== nk;
    pri2pub.pubkey === account_note_npk;

    //check signature
    component hasher = Hasher();
    hasher.nc_1 <== nc[0].out;
    hasher.nc_2 <== nc[1].out;
    hasher.output_note_nc_1[0] <== output_nc_1_x;
    hasher.output_note_nc_1[1] <== output_nc_1_y;
    hasher.output_note_nc_2[0] <== output_nc_2_x;
    hasher.output_note_nc_2[1] <== output_nc_2_y;
    component sig_verifier = ECDSAVerifyNoPubkeyCheck(64, 4);
    sig_verifier.r <== signature[0];
    sig_verifier.s <== signature[1];
    sig_verifier.msghash <== hasher,out;
    sig_verifier.pubkey <== account_note_npk;
    sig_verifier.result === 1;

    // check value
    //case 1: note_num < 1 && input_note_1.value == 0
    component note_num_less[2];
    note_num_less[0] = LessThan(252);
    note_num_less[0].in[0] <== note_num;
    note_num_less[0].in[1] <== 1;
    note_num_less[0].out * input_note_val[0] === 0;

    //case 2: note_num < 2 && input_note_2.value == 0
    note_num_less[1] = LessThan(252);
    note_num_less[1].in[0] <== note_num;
    note_num_less[1].in[1] <== 2;
    note_num_less[1].out * input_note_val[1] === 0;

    // transfer balance check
    var total_in_value = public_input + input_note_val[0].val + input_note_val[1].val;
    var total_out_value = public_output + output_note_val[0].val + output_note_val[1].val;
    total_in_value === total_out_value;

    // asset type check
    input_note_asset_id[0] === input_note_asset_id[1];
    output_note_asset_id[0] === input_note_asset_id[1];
    output_note_asset_id[0] === output_note_asset_id[1];
    //check: public_asset_id == input_note_1.asset_id <==> (public_input != 0 || public_output != 0)
    (public_input + public_ouput - public_ouput * public_input) * (public_asset_id - input_note_asset_id[0]) === 0;
}
