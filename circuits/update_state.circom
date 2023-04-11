pragma circom 2.0.2;
include "./join_split.circom";
include "./account.circom";

template UpdateState(nLevel) {
    // public input
    signal input proof_id;
    signal input public_value;
    signal input public_owner;
    signal input num_input_notes;
    signal input output_nc_1; //(nc is short for note commitment)
    signal input output_nc_2;
    signal input data_tree_root;
    signal input public_asset_id;

    // private
    /// account
    signal input account_note_npk[2]; // (npk=account public key)
    signal input account_note_spk[2]; // (spk=signing public key)
    signal input new_account_note_npk[2]; // (npk=account public key)
    signal input new_account_note_spk1[2]; // (spk=signing public key)
    signal input new_account_note_spk2[2]; // (spk=signing public key)
    signal input signatureR8[2];
    signal input signatureS;
    signal input siblings_ac[nLevel];

    /// join split
    signal input asset_id;
    signal input alias_hash;
    signal input input_note_val[2];
    signal input input_note_secret[2];
    signal input input_note_asset_id[2];
    signal input input_note_owner[2][2];
    signal input input_note_nullifier[2];
    signal input input_note_account_required[2];
    signal input siblings[2][nLevel];
    signal input output_note_val[2];
    signal input output_note_secret[2];
    signal input output_note_owner[2][2];
    signal input output_note_asset_id[2];
    signal input output_note_nullifier[2];
    signal input output_note_account_required[2];
    signal input account_note_nk; // (nk = account private key)
    signal input account_required;

    component enabled_account_circuit = GreaterThan(252);
    enabled_account_circuit.in[0] <== proof_id;
    enabled_account_circuit.in[1] <== 10;
    //log("enabled_account_circuit");

    component account_circuit = Account(nLevel);
    account_circuit.enabled <== enabled_account_circuit.out;
    account_circuit.proof_id  <== proof_id;
    account_circuit.public_value  <== public_value;
    account_circuit.public_owner  <== public_owner;
    account_circuit.num_input_notes  <== num_input_notes;
    account_circuit.output_nc_1  <== output_nc_1;
    account_circuit.output_nc_2  <== output_nc_2;
    account_circuit.data_tree_root  <== data_tree_root;
    account_circuit.public_asset_id  <== public_asset_id;
    account_circuit.alias_hash <== alias_hash;
    account_circuit.account_note_npk  <== account_note_npk;
    account_circuit.account_note_spk  <== account_note_spk;
    account_circuit.new_account_note_npk  <== new_account_note_npk;
    account_circuit.new_account_note_spk1  <== new_account_note_spk1;
    account_circuit.new_account_note_spk2  <== new_account_note_spk2;
    account_circuit.signatureR8  <== signatureR8;
    account_circuit.signatureS  <== signatureS;
    account_circuit.siblings_ac  <== siblings_ac;

    component join_split_circuit = JoinSplit(nLevel);
    join_split_circuit.enabled <== 1 - enabled_account_circuit.out;
    join_split_circuit.proof_id    <== proof_id;
    join_split_circuit.public_value    <== public_value;
    join_split_circuit.public_owner    <== public_owner;
    join_split_circuit.num_input_notes    <== num_input_notes;
    join_split_circuit.output_nc_1    <== output_nc_1; //(nc is short for note commitment)
    join_split_circuit.output_nc_2    <== output_nc_2;
    join_split_circuit.data_tree_root    <== data_tree_root;
    join_split_circuit.public_asset_id    <== public_asset_id;
    join_split_circuit.asset_id    <== asset_id;
    join_split_circuit.alias_hash    <== alias_hash;
    join_split_circuit.input_note_val    <== input_note_val;
    join_split_circuit.input_note_secret    <== input_note_secret;
    join_split_circuit.input_note_asset_id    <== input_note_asset_id;
    join_split_circuit.input_note_owner    <== input_note_owner;
    join_split_circuit.input_note_nullifier    <== input_note_nullifier;
    join_split_circuit.input_note_account_required    <== input_note_account_required;
    join_split_circuit.siblings    <== siblings;
    join_split_circuit.output_note_val    <== output_note_val;
    join_split_circuit.output_note_secret    <== output_note_secret;
    join_split_circuit.output_note_owner    <== output_note_owner;
    join_split_circuit.output_note_asset_id    <== output_note_asset_id;
    join_split_circuit.output_note_nullifier    <== output_note_nullifier;
    join_split_circuit.output_note_account_required    <== output_note_account_required;
    join_split_circuit.account_note_npk    <== account_note_npk; // (npk=account public key)
    join_split_circuit.account_note_nk    <== account_note_nk; // (nk = account private key)
    join_split_circuit.account_note_spk    <== account_note_spk; // (spk=signing public key)
    join_split_circuit.siblings_ac    <== siblings_ac;
    join_split_circuit.signatureR8    <== signatureR8;
    join_split_circuit.signatureS    <== signatureS; // eddsa signature
    join_split_circuit.account_required    <== account_required;
}
