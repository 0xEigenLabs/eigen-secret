pragma circom 2.0.0;

template ERC20Token() {
    signal input currentBalance;

    // 1 sender, 0, receiver
    signal input isFrom;

    // should be 0 if just check existance
    signal input amount;

    signal output newBalance;

    // range check  
    isFrom * (currentBalance - amount) + (1 - isFrom) * (currentBalance + amount) >= currentBalance;
    // If isFrom == 1, the second equation will be 0 >= currentBalance, which is wrong
    // isFrom * (currentBalance - amount) >= 0;
    // (1 - isFrom) * (currentBalance + amount) >= currentBalance;

    // update balance
    newBalance <== (currentBalance - amount) * isFrom + (currentBalance + amount) * (1 - isFrom);
}