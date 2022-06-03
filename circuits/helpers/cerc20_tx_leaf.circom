pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/mimc.circom";

template TxLeaf() {

    signal input fromX;
    signal input fromY;
    signal input fromIndex;
    signal input toX;
    signal input toY;
    signal input nonce;
    signal input amountComm[2];
    signal input tokenType;

    signal output out;

    component txLeaf = MultiMiMC7(9,91);
    txLeaf.in[0] <== fromX;
    txLeaf.in[1] <== fromY;
    txLeaf.in[2] <== fromIndex;
    txLeaf.in[3] <== toX;
    txLeaf.in[4] <== toY;
    txLeaf.in[5] <== nonce;
    txLeaf.in[6] <== amountComm[0];
    txLeaf.in[7] <== amountComm[1];
    txLeaf.in[8] <== tokenType;
    txLeaf.k <== 0;

    out <== txLeaf.out;
}