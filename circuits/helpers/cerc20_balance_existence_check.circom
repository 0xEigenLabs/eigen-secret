pragma circom 2.0.0;
include "./cerc20_balance_leaf.circom";
include "./leaf_existence.circom";

template BalanceExistence(k){

    signal input x;
    signal input y;
    signal input balanceComm[2];
    signal input nonce;
    signal input tokenType;

    signal input balanceRoot;
    signal input paths2rootPos[k];
    signal input paths2root[k];

    component balanceLeaf = BalanceLeaf();
    balanceLeaf.x <== x;
    balanceLeaf.y <== y;
    balanceLeaf.balanceComm[0] <== balanceComm[0];
    balanceLeaf.balanceComm[1] <== balanceComm[1];
    balanceLeaf.nonce <== nonce; 
    balanceLeaf.tokenType <== tokenType;

    component balanceExistence = LeafExistence(k);
    balanceExistence.leaf <== balanceLeaf.out;
    balanceExistence.root <== balanceRoot;

    for (var s = 0; s < k; s++){
        balanceExistence.paths2rootPos[s] <== paths2rootPos[s];
        balanceExistence.paths2root[s] <== paths2root[s];
    }
}