pragma circom 2.0.0;
include "./pedersen_commitment.circom";

template CERC20TokenFrom() {
    // pedersen commitment
    // signal input r;
    signal input currentBalance[2];

    // should be 0 if just check existance
    signal input amount[2];

    signal output newBalance[2];

    component changer = SubPedersenComm();

    changer.comm1[0] <== currentBalance[0];
    changer.comm1[1] <== currentBalance[1];
    changer.comm2[0] <== amount[0];
    changer.comm2[1] <== amount[1];

    // range check TODO
    // pedersenAdd.r < r;
    // pedersenAdd.balance < currentBalance;
    // pedersenAdd.rate < amount;

    // update balance
    newBalance[0] <== changer.out[0];
    newBalance[1] <== changer.out[1];
}

template CERC20TokenTo() {
    // pedersen commitment
    // signal input r;
    signal input currentBalance[2];

    // should be 0 if just check existance
    signal input amount[2];

    signal output newBalance[2];

    component changer = AddPedersenComm();

    changer.comm1[0] <== currentBalance[0];
    changer.comm1[1] <== currentBalance[1];
    changer.comm2[0] <== amount[0];
    changer.comm2[1] <== amount[1];

    // range check TODO
    // pedersenAdd.r < r;
    // pedersenAdd.balance < currentBalance;
    // pedersenAdd.rate < amount;

    // update balance
    newBalance[0] <== changer.out[0];
    newBalance[1] <== changer.out[1];
}