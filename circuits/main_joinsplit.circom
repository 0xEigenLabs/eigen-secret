pragma circom 2.0.2;
include "./join_split.circom";
component main { public [proof_id, public_value, public_owner, num_input_notes, output_nc_1, output_nc_2, data_tree_root, public_asset_id] } = JoinSplit (20);
