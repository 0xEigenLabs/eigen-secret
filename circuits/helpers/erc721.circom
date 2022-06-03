pragma circom 2.0.0;
include "../../node_modules/circomlib/circuits/comparators.circom";

template SenderERC721Token(n) {
    signal input currentTokenIDs[n];
    signal input transferTokenID;

    signal output newTokenIDs[n-1];

    // check transferTokenID in currentTokenIDs
    var idx = 0;
    for (var i = 1; i < n+1; i++) {
        if (currentTokenIDs[i-1] == transferTokenID) {
            idx <== i;
        }
    } 
    component gt = GreaterThan(32);
    
    gt.in[0] <== idx;
    gt.in[1] <== 0;

    gt.out === 1;

    for (var i = 0; i < idx; i++) {
        newTokenIDs[i] <== currentTokenIDs[i];
    }

    for (var i = idx+1; i < n; i++) {
        newTokenIDs[i-1] <== currentTokenIDs[i];
    }
}

template ReceiverERC721Token(n) {
    signal input currentTokenIDs[n];
    signal input transferTokenID;

    signal output newTokenIDs[n+1];

    // check transferTokenID not in currentTokenIDs
    var idx = 0;
    for (var i = 1; i < n+1; i++) {
        if (currentTokenIDs[i-1] == transferTokenID) {
            idx <== i;
        }
    } 
    component eq = IsEqual(32);
    
    eq.in[0] <== idx;
    eq.in[1] <== 0;

    eq.out === 1;

    for (var i = 0; i < n; i++) {
        newTokenIDs[i] <== currentTokenIDs[i];
    }
    newTokenIDs[n] <== transferTokenID;
}

// template ERC721Token(n) {
//     signal input currentTokenIDs[n];
//     signal input randoms[n];

//     // 1 sender, 0, receiver
//     signal input isFrom;

//     signal input transferTokenID;
//     signal input random;

//     signal output p[2];
//     signal output pr[2];

//     signal c;
//     signal cr;

//     var G[2] = [
//         995203441582195749578291179787384436505546430278305826713579947235728471134,
//         5472060717959818805561601436314318772137091100104008585924551046643952123905
//     ];

//     component c2bits = Num2Bits(256);
//     component cr2bits = Num2Bits(256);
//     component escalarMulc = EscalarMulFix(256, G);
//     component escalarMulcr = EscalarMulFix(256, G);

//     c2bits.in <== c;
//     cr2bits.in <== cr;

//     // c = ∏ tokenID_i  cr = ∏ (tokenID_i + r_i)
//     c <== currentTokenIDs[0];
//     cr <== currentTokenIDs + randoms[0]
//     for (var i = 1; i < n + 1; i++) {
//         if (transferTokenID != currentTokenIDs[i]) {
//             c <== c * currentTokenIDs[i];
//             cr <== cr * (currentTokenIDs[i] + randoms[i]);
//         }
//     }

//     if (isFrom == 0) {
//         c <== c * transferTokenID;
//         cr <== cr * (transferTokenID + random);
//     }

//     // p = c * G  pr = cr * G
//     for (var i=0; i<256; i++) {
//         c2bits.out[i] ==> escalarMulc.e[i];
//         cr2bits.out[i] ==> escalarMulcr.e[i];
//     }

//     p[0] <== escalarMulc.out[0];
//     p[1] <== escalarMulc.out[1];
//     pr[0] <== escalarMulcr.out[0];
//     pr[1] <== escalarMulcr.out[1];
// }