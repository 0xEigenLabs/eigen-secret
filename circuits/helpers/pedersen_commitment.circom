pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/babyjub.circom";

template AddPedersenComm() {
    signal input comm1[2];
    signal input comm2[2];
    
    signal output out[2];

    component adder = BabyAdd();
    adder.x1 <== comm1[0];
    adder.y1 <== comm1[1];
    adder.x2 <== comm2[0];
    adder.y2 <== comm2[1];

    out[0] <== adder.xout;
    out[1] <== adder.yout;
}

template SubPedersenComm() {
    signal input comm1[2];
    signal input comm2[2];
    
    signal output out[2];

    component adder = BabyAdd();
    adder.x1 <== comm1[0];
    adder.y1 <== comm1[1];
    // The GLOBAL_FIELD_P in circom is equal to r(https://eips.ethereum.org/EIPS/eip-2494), so no need to do the modulo
    adder.x2 <== (-comm2[0]);
    adder.y2 <== comm2[1];

    out[0] <== adder.xout;
    out[1] <== adder.yout;
}