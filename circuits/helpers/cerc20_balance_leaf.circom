pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/mimc.circom";

template BalanceLeaf() {

    signal input x;
    signal input y;
    signal input balanceComm[2];
    signal input nonce;
    signal input tokenType;

    signal output out;

    component balanceLeaf = MultiMiMC7(6,91);
    balanceLeaf.in[0] <== x;
    balanceLeaf.in[1] <== y;
    balanceLeaf.in[2] <== balanceComm[0];
    balanceLeaf.in[3] <== balanceComm[1];
    balanceLeaf.in[4] <== nonce;
    balanceLeaf.in[5] <== tokenType;
    balanceLeaf.k <== 0;

    out <== balanceLeaf.out;
}