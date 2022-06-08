pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/babyjub.circom";

template AddPedersenComm() {
    signal input balanceComm[2];
    signal input amountComm[2];
    
    signal output out[2];

    component adder = BabyAdd();
    adder.x1 <== balanceComm[0];
    adder.y1 <== balanceComm[1];
    adder.x2 <== amountComm[0];
    adder.y2 <== amountComm[1];

    out[0] <== adder.xout;
    out[1] <== adder.yout;
}

template SubPedersenComm() {
    signal input balanceComm[2];
    signal input amountComm[2];
    
    signal output out[2];

    component adder = BabyAdd();
    adder.x1 <== balanceComm[0];
    adder.y1 <== balanceComm[1];
    // The GLOBAL_FIELD_P in circom is equal to r(https://eips.ethereum.org/EIPS/eip-2494), so no need to do the modulo
    adder.x2 <== (-amountComm[0]);
    adder.y2 <== amountComm[1];

    out[0] <== adder.xout;
    out[1] <== adder.yout;
}