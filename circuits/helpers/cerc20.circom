pragma circom 2.0.0;
include "./pedersen_commitment.circom";

template CERC20TokenFrom() {
    signal input currentBalance[2];

    signal input amount[2];

    signal output newBalance[2];

    component changer = SubPedersenComm();

    changer.balanceComm[0] <== currentBalance[0];
    changer.balanceComm[1] <== currentBalance[1];
    changer.amountComm[0] <== amount[0];
    changer.amountComm[1] <== amount[1];

    newBalance[0] <== changer.out[0];
    newBalance[1] <== changer.out[1];
}

template CERC20TokenTo() {
    signal input currentBalance[2];

    signal input amount[2];

    signal output newBalance[2];

    component changer = AddPedersenComm();

    changer.balanceComm[0] <== currentBalance[0];
    changer.balanceComm[1] <== currentBalance[1];
    changer.amountComm[0] <== amount[0];
    changer.amountComm[1] <== amount[1];

    newBalance[0] <== changer.out[0];
    newBalance[1] <== changer.out[1];
}