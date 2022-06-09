pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/comparators.circom";
include "./if_gadgets.circom";

template ERC20Token() {
    signal input currentBalance;
    // 1 sender, 0, receiver
    signal input isFrom;
    signal input amount;
    signal output newBalance;

    // range check  
    component ifThenElse1 = IfAThenBElseC();
    ifThenElse1.aCond <== isFrom;
    ifThenElse1.bBranch <== currentBalance - amount;
    ifThenElse1.cBranch <== currentBalance + amount; 

    component ifThenElse2 = IfAThenBElseC();
    ifThenElse2.aCond <== isFrom;
    ifThenElse2.bBranch <== 0;
    ifThenElse2.cBranch <== currentBalance; 

    component gt = GreaterEqThan(256);
    gt.in[0] <== ifThenElse1.out;
    gt.in[1] <== ifThenElse2.out;
    gt.out === 1;

    // update balance
    component ifThenElse3 = IfAThenBElseC();
    ifThenElse3.aCond <== isFrom;
    ifThenElse3.bBranch <== currentBalance - amount;
    ifThenElse3.cBranch <== currentBalance + amount; 

    newBalance <== ifThenElse3.out;
}