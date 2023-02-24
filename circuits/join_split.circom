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
include "if_gadgets.circom";

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
    hash.inputs[7] <== public_owner;
    hash.inputs[6] <== public_value;

    out <== hash.out;
}

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
    signal input output_nc_1[2]; //(nc is short for note commitment)
    signal input output_nc_2[2];
    signal input nullifier_1;
    signal input nullifier_2;
    signal input data_tree_root;

    //private input
    signal input asset_id;
    signal input alias_hash;
    signal input input_note_val[2];
    signal input input_note_secret[2];
    signal input input_note_asset_id[2];
    signal input input_note_owner[2][2][4];
    signal input input_note_nullifier[2];
    signal input siblings[2][nLevel];
    signal input output_note_val[2];
    signal input output_note_secret[2];
    signal input output_note_owner[2][4];
    signal input output_note_asset_id[2];
    signal input output_note_nullifier[2];
    signal input account_note_npk[2][4]; // (npk=account public key, ECDSA)
    signal input account_note_nk[4]; // (nk = account private key, ECDSA)
    signal input account_note_spk[2]; // (spk=view public key, EdDSA)
    signal input siblings_ac[nLevel];
    signal input signature[2][4]; // ecdsa signature

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
    // true == (is_deposit || is_send || is_withdraw);
    //  true == (num_input_notes = 0 || 1 || 2);
    component validType = GreaterThan(252);
    validType.in[0] <== is_deposit.out + is_send.out + is_withdraw.out;
    validType.in[1] <== 0;
    validType.out === 1;
    component validType2 = LessThan(252);
    validType2.in[0] <== num_input_notes;
    validType2.in[1] <== 3;
    validType2.out === 1;

    // is_public_tx = is_withdraw || is_deposit
    component is_public_tx = XOR();
    is_public_tx.a <== is_deposit.out;
    is_public_tx.b <== is_withdraw.out;

    // public_asset_id = is_public_tx? asset_id: 0;
    var public_assert_id = is_public_tx.out * asset_id;
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

    component validPublic = XOR();
    validPublic.a <== is_public_yes.out;
    validPublic.b <== is_public_no.out;
    validPublic.out === 1;

    component inputNoteInUse[2];
    inputNoteInUse[0] = GreaterThan(252);
    inputNoteInUse[0].in[0] <== num_input_notes;
    inputNoteInUse[0].in[1] <== 0;

    inputNoteInUse[1] = GreaterThan(252);
    inputNoteInUse[1].in[0] <== num_input_notes;
    inputNoteInUse[1].in[1] <== 1;

    //note validity check
    component nc[2];
    component nf[2];
    component ms[2];
    for(var i = 0;  i < 2; i ++) {
        nc[i] = NoteCompressor();
        nc[i].val <== input_note_val[i];
        nc[i].asset_id <== input_note_asset_id[i];
        nc[i].owner <== input_note_owner[i][0]; // using point.x
        nc[i].secret <== input_note_secret[i];
        nc[i].input_nullifier <== input_note_nullifier[i];

        ms[i] = Membership(nLevel);
        ms[i].key <== nc[i].out;
        ms[i].value <== num_input_notes;
        ms[i].root <== data_tree_root;
        for (var j = 0; j < nLevel; j++) {
            ms[i].siblings[j] <== siblings[i][j];
        }

        nf[i] = NullifierFunction(nLevel);
        nf[i].nc <== nc[i].out;
        nf[i].nk <== account_note_nk;
        for (var j = 0; j < nLevel; j++) {
            nf[i].siblings[j] <== siblings[i][j];
        }

        inputNoteInUse[i].out * (nf[i].out - output_note_nullifier[i]) === 0;
    }

    // nc[0].out != nc[1].out
    component isSameNC = IsEqual();
    isSameNC.in[0] <== nc[0].out;
    isSameNC.in[1] <== nc[1].out;
    isSameNC.out === 0;

    //num_input_notes == 0 && is_deposit == true
    component isDepositC = AllLow(2);
    isDepositC.in[0] <== num_input_notes;
    isDepositC.in[1] <== is_deposit.out - 1;
    isDepositC.out === 1;

    component ac = AccountNoteCompressor();
    ac.npk <== account_note_npk;
    ac.spk <== account_note_spk;
    ac.alias_hash <== alias_hash;

    component ams = Membership(nLevel);
    ams.key <== ac.out;
    ams.value <== 1; // setup any
    for (var j = 0; j < nLevel; j++) {
        ams.siblings[j] <== siblings_ac[j];
    }

    // check private key to public key
    component pri2pub = ECDSAPrivToPub(64, 4);
    pri2pub.privkey <== account_note_nk;
    pri2pub.pubkey === account_note_npk;

    // check account_note_npk == input_note_1.owner && account_note_npk == input_note_2.owner
    account_note_npk === input_note_owner[0];
    account_note_npk === input_note_owner[1];


    //check signature
    component msghash = Digest(4);
    msghash.nc_1 <== nc[0].out;
    msghash.nc_2 <== nc[1].out;
    msghash.output_note_nc_1 <== output_nc_1;
    msghash.output_note_nc_2 <== output_nc_2;
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
    //  (asset_id == input_note_1.asset_id) &&
    //  (asset_id == output_note_1.asset_id) &&
    //  (asset_id == output_note_2.asset_id)
    input_note_asset_id[0] === asset_id;
    output_note_asset_id[0] === input_note_asset_id[0];
    output_note_asset_id[0] === output_note_asset_id[1];

    // if num_input_notes == 2 && input_note_1.asset_id == input_note_2.asset_id


    output_note_asset_id[0] === input_note_asset_id[1];

    //check: asset_id == input_note_1.asset_id <==> (public_input_ != 0 || public_output != 0)
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
    asset_id_eq.in[0] <== asset_id;
    asset_id_eq.in[1] <== input_note_asset_id[0];

    component and = AND();
    and.a <== xor.out;
    and.b <== asset_id_eq.out;
    and.out === 1;
}
