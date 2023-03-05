pragma circom 2.0.2;
include "account.circom";
component main { public [proof_id, public_value, public_owner, num_input_notes, output_nc_1, output_nc_2, data_tree_root, public_asset_id] } = Account (20);
