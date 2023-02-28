pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "../node_modules/circomlib/circuits/smt/smtprocessor.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/gates.circom";
include "state_tree.circom";
include "account_note.circom";
include "nullifier_function.circom";
include "note_compressor.circom";
include "if_gadgets.circom";
include "digest.circom";

template JoinSplit(nLevel) {
    //constant
    var TYPE_DEPOSIT = 1;
    var TYPE_WITHDRAW = 2;
    var TYPE_SEND = 3;
    var TYPE_CODE_VK = 4; // verification key of smart contract

    var NOTE_VALUE_BIT_LENGTH = 2**128;
    var NUM_ASSETS_BIT_LENGTH = 1000;

    // public input
    signal input proof_id;
    signal input public_value;
    signal input public_owner;
    signal input num_input_notes;
    signal input output_nc_1; //(nc is short for note commitment)
    signal input output_nc_2;
    signal input data_tree_root;
    signal input public_asset_id;

    //private input
    signal input asset_id;
    signal input alias_hash;
    signal input input_note_val[2];
    signal input input_note_secret[2];
    signal input input_note_asset_id[2];
    signal input input_note_owner[2][2];
    signal input input_note_nullifier[2];
    signal input siblings[2][nLevel];
    signal input output_note_val[2];
    signal input output_note_secret[2];
    signal input output_note_owner[2][2];
    signal input output_note_asset_id[2];
    signal input output_note_nullifier[2];
    signal input account_note_npk[2]; // (npk=account public key)
    signal input account_note_nk; // (nk = account private key)
    signal input account_note_spk[2]; // (spk=signing public key)
    signal input siblings_ac[nLevel];
    signal input signatureR8[2]; // eddsa signature
    signal input signatureS; // eddsa signature

    //range check
    component is_less_than[2][2];
    for(var i = 0;  i < 2; i ++) {
        is_less_than[i][0] = LessEqThan(252);
        is_less_than[i][0].in[0] <== input_note_val[i];
        is_less_than[i][0].in[1] <== NOTE_VALUE_BIT_LENGTH;

        is_less_than[i][1] = LessEqThan(252);
        is_less_than[i][1].in[0] <== input_note_asset_id[i];
        is_less_than[i][1].in[1] <== NUM_ASSETS_BIT_LENGTH;
    }

    component is_deposit = IsEqual();
    is_deposit.in[0] <== proof_id;
    is_deposit.in[1] <== TYPE_DEPOSIT;

    component is_withdraw = IsEqual();
    is_withdraw.in[0] <== proof_id;
    is_withdraw.in[1] <== TYPE_WITHDRAW;

    component is_send = IsEqual();
    is_send.in[0] <== proof_id;
    is_send.in[1] <== TYPE_SEND;

    // Data validity checks:
    // true == (is_deposit || is_send || is_withdraw); // TODO: one or more true? Can a tx include both a `send to L1` and a `send to L2`?
    //  true == (num_input_notes = 0 || 1 || 2);
    component valid_type = GreaterThan(252);
    valid_type.in[0] <== is_deposit.out + is_send.out + is_withdraw.out;
    valid_type.in[1] <== 0;
    valid_type.out === 1;
    component valid_type2 = LessThan(252);
    valid_type2.in[0] <== num_input_notes;
    valid_type2.in[1] <== 3;
    valid_type2.out === 1;

    // is_public_tx = is_withdraw || is_deposit
    component is_public_tx = XOR();
    is_public_tx.a <== is_deposit.out;
    is_public_tx.b <== is_withdraw.out;

    var public_input_ = public_value * is_deposit.out;
    var public_output_ = public_value * is_withdraw.out;

    // if is_public_tx { public_value > 0 && public_owner > 0 } else { public_value == 0 && public_owner == 0 }
    component is_public_yes = AllHigh(3);
    is_public_yes.in[0] <== is_public_tx.out;
    is_public_yes.in[1] <== public_value;
    is_public_yes.in[2] <== public_owner;

    component is_public_no = AllLow(3);
    is_public_no.in[0] <== is_public_tx.out;
    is_public_no.in[1] <== public_value;
    is_public_no.in[2] <== public_owner;

    component valid_public = XOR();
    valid_public.a <== is_public_yes.out;
    valid_public.b <== is_public_no.out;
    valid_public.out === 1;

    // num_input_notes == 0 => is_deposit == true
    component is_deposit_c = GreaterThan(252);
    is_deposit_c.in[0] <== num_input_notes + is_deposit.out;
    is_deposit_c.in[1] <== 0;
    is_deposit_c.out === 1;

    component input_note_in_use[2];
    input_note_in_use[0] = GreaterThan(252);
    input_note_in_use[0].in[0] <== num_input_notes;
    input_note_in_use[0].in[1] <== 0;

    input_note_in_use[1] = GreaterThan(252);
    input_note_in_use[1].in[0] <== num_input_notes;
    input_note_in_use[1].in[1] <== 1;

    //note validity check
    component inc[2]; //note commitment input
    component onc[2];
    component nf[2];
    component ms[2];
    for(var i = 0;  i < 2; i ++) {
        onc[i] = NoteCompressor();
        onc[i].val <== output_note_val[i];
        onc[i].asset_id <== output_note_asset_id[i];
        onc[i].owner <== output_note_owner[i];
        onc[i].secret <== output_note_secret[i];
        onc[i].input_nullifier <== output_note_nullifier[i];

        ms[i] = Membership(nLevel);
        ms[i].key <== onc[i].out;
        ms[i].value <== num_input_notes;
        ms[i].root <== data_tree_root;
        ms[i].enabled <== input_note_in_use[i].out;
        for (var j = 0; j < nLevel; j++) {
            ms[i].siblings[j] <== siblings[i][j];
        }

        inc[i] = NoteCompressor();
        inc[i].val <== input_note_val[i];
        inc[i].asset_id <== input_note_asset_id[i];
        inc[i].owner <== input_note_owner[i];
        inc[i].secret <== input_note_secret[i];
        inc[i].input_nullifier <== input_note_nullifier[i];

        nf[i] = NullifierFunction(nLevel);
        nf[i].nc <== inc[i].out;
        nf[i].nk <== account_note_nk;
        nf[i].input_note_in_use <== input_note_in_use[i].out;

        // TODO push input notes into nullifier tree

        input_note_in_use[i].out * (nf[i].out - output_note_nullifier[i]) === 0;
    }

    // onc[0].out != onc[1].out
    component nc_not_same = IsEqual();
    nc_not_same.in[0] <== onc[0].out;
    nc_not_same.in[1] <== onc[1].out;
    nc_not_same.out === 0;

    component ac = AccountNoteCompressor();
    ac.npk <== account_note_npk;
    ac.spk <== account_note_spk;
    ac.alias_hash <== alias_hash;

    component ams = Membership(nLevel);
    ams.enabled <== 1;
    ams.key <== ac.out;
    ams.value <== 1; // setup any
    ams.root <== data_tree_root;
    for (var j = 0; j < nLevel; j++) {
        ams.siblings[j] <== siblings_ac[j];
    }

    // check private key to public key
    component pri2pub = BabyPbk();
    pri2pub.in <== account_note_nk;
    pri2pub.Ax === account_note_npk[0];
    pri2pub.Ay === account_note_npk[1];

    // check account_note_npk == input_note_1.owner && account_note_npk == input_note_2.owner
    account_note_npk === input_note_owner[0];
    account_note_npk === input_note_owner[1];

    // check signature
    component msghash = Digest();
    msghash.nc_1 <== nf[0].out;
    msghash.nc_2 <== nf[1].out;
    msghash.output_note_nc_1 <== output_nc_1;
    msghash.output_note_nc_2 <== output_nc_2;
    msghash.public_value <== public_value;
    msghash.public_owner <== public_owner;

    component sig_verifier = EdDSAPoseidonVerifier();
    sig_verifier.enabled <== 1;
    sig_verifier.R8x <== signatureR8[0];
    sig_verifier.R8y <== signatureR8[1];
    sig_verifier.S <== signatureS;
    sig_verifier.M <== msghash.out;
    sig_verifier.Ax <== account_note_npk[0];
    sig_verifier.Ay <== account_note_npk[1];

    // transfer balance check
    var total_in_value = public_input_ + input_note_val[0] + input_note_val[1];
    var total_out_value = public_output_ + output_note_val[0] + output_note_val[1];
    component balance_check = IsEqual();
    balance_check.in[0] <== total_in_value;
    balance_check.in[1] <== total_out_value;
    1 === balance_check.out;

    // output note type check
    //  (asset_id == input_note_1.asset_id) &&
    //  (asset_id == output_note_1.asset_id) &&
    //  (asset_id == output_note_2.asset_id)
    asset_id === input_note_asset_id[0];
    asset_id === output_note_asset_id[0];
    asset_id === output_note_asset_id[1];

    // num_input_notes == 2 (input_note_in_use[1].out == 1) => input_note_1.asset_id == input_note_2.asset_id
    input_note_in_use[1].out * (input_note_asset_id[0] - input_note_asset_id[1]) === 0;

    //check: public_asset_id == input_note_1.asset_id <==> (public_input_ != 0 || public_output != 0)
    //aka. public_asset_id == input_note_1.asset_id <==> public_value > 0
    public_asset_id === is_public_tx.out * asset_id;
}
