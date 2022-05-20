pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/escalarmulfix.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template PedersenCommitmentPlusRangeProof(n) {
    signal input H[2];
    signal input r;
    signal input balance;
    signal input balanceComm[2];
    
    signal input a;
    signal input b;
    signal input c;
    signal input amount;


    var G[2] = [
        995203441582195749578291179787384436505546430278305826713579947235728471134,
        5472060717959818805561601436314318772137091100104008585924551046643952123905
    ];
    var i;

    component r2bits = Num2Bits(256);
    component balance2bits = Num2Bits(256);
    component escalarMulr = EscalarMulFix(256, G);
    component escalarMulv = EscalarMulAny(256);
    component adder = BabyAdd();

    component lessor = LessThan(n);
    component greater1 = GreaterEqThan(n);
    component greater2 = GreaterEqThan(n);
    component greater3 = GreaterEqThan(n);

    r ==> r2bits.in;
    balance ==> balance2bits.in;

    for (i=0; i<256; i++) {
        r2bits.out[i] ==> escalarMulr.e[i];
        balance2bits.out[i] ==> escalarMulv.e[i];
    }

    H[0] ==> escalarMulv.p[0];
    H[1] ==> escalarMulv.p[1];

    escalarMulr.out[0] ==> adder.x1;
    escalarMulr.out[1] ==> adder.y1;
    escalarMulv.out[0] ==> adder.x2;
    escalarMulv.out[1] ==> adder.y2;

    adder.xout === balanceComm[0];
    adder.yout === balanceComm[1];

    // range proof： a < amount <= b <= balance <= c
    // balance <= c
    greater1.in[0] <== c;
    greater1.in[1] <== balance;
    1 === greater1.out;

    // b <= balance
    greater2.in[0] <== balance;
    greater2.in[1] <== b;
    1 === greater2.out;

    // amount <= b
    greater3.in[0] <== b;
    greater3.in[1] <== amount;
    1 === greater3.out;

    // a < amount
    lessor.in[0] <== a;
    lessor.in[1] <== amount;
    lessor.out === 1;
}

component main { public[H, balanceComm, a, b, c] } = PedersenCommitmentPlusRangeProof(252);