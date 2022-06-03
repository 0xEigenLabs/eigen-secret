pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/mimc.circom";

template ERC721BalanceLeaf(n) {
    signal input x;
    signal input y;
    signal input tokenIDs[n];
    signal input nonce;

    signal output out;

    component balanceLeaf = MultiMiMC7(n+3,91);
    balanceLeaf.in[0] <== x;
    balanceLeaf.in[1] <== y;
    for (var i = 0; i < n; i++) {
        balanceLeaf.in[2+i] <== tokenIDs[i];
    }
    balanceLeaf.in[2+n] <== nonce;
    balanceLeaf.k <== 0;

    out <== balanceLeaf.out;
}
