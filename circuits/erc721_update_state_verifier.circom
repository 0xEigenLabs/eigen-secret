pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/mimc.circom";
include "../node_modules/circomlib/circuits/eddsamimc.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

include "./helpers/erc721_tx_existence_check.circom";
include "./helpers/erc721_balance_existence_check.circom";
include "./helpers/erc721_balance_leaf.circom";
include "./helpers/get_merkle_root.circom";
include "./helpers/if_gadgets.circom";
include "./helpers/erc721.circom";


template Main(n, m, x, y) {
    // n is depth of balance tree
    // m is depth of transactions tree
    // x is the amount of the sender's ERC721 tokens
    // y is the amount of the receiver's ERC721 tokens
    // for each proof, update 2**m transactions

    // Merkle root of transactions tree
    signal input txRoot;

    // Merkle proof for transaction in tx tree
    signal input paths2txRoot[2**m][m];

    // binary vector indicating whether node in tx proof is left or right
    signal input paths2txRootPos[2**m][m];

    // Merkle root of old balance tree
    signal input currentState;

    // intermediate roots (two for each tx), final element is last.
    signal input intermediateRoots[2**(m+1)+1];

    // Merkle proof for sender account in balance tree
    signal input paths2rootFrom[2**m][n];

    // binary vector indicating whether node in balance proof for sender account
    // is left or right 
    signal input paths2rootFromPos[2**m][n];

    // Merkle proof for receiver account in balance tree
    signal input paths2rootTo[2**m][n];

    // binary vector indicating whether node in balance proof for receiver account
    // is left or right 
    signal input paths2rootToPos[2**m][n];

    // tx info, 10 fields
    signal input fromX[2**m]; //sender address x coordinate
    signal input fromY[2**m]; //sender address y coordinate
    signal input fromIndex[2**m]; //sender account leaf index
    signal input toX[2**m]; // receiver address x coordinate
    signal input toY[2**m]; // receiver address y coordinate
    signal input nonceFrom[2**m]; // sender account nonce
    signal input transferTokenID[2**m]; // token being transferred
    signal input R8x[2**m]; // sender signature
    signal input R8y[2**m]; // sender signature
    signal input S[2**m]; // sender signature

    signal input tokenIDsFrom[2**m][x]; // sender ERC721 tokenID list
    signal input tokenIDsTo[2**m][y]; // receiver ERC721 tokenID list
    signal input nonceTo[2**m]; // receiver account nonce

    // // new balance tree Merkle root
    signal output out;

    var NONCE_MAX_VALUE = 4294967296;

    // constant zero address

    var ZERO_ADDRESS_X = 0;
    var ZERO_ADDRESS_Y = 0;

    component txExistence[2**m];
    component senderExistence[2**m];
    component ifBothHighForceEqual[2**m];
    component newSender[2**m];
    component computedRootFromNewSender[2**m];
    component receiverExistence[2**m];
    component newReceiver[2**m];
    component allLow[2**m];
    component ifThenElse[2**m];
    component computedRootFromNewReceiver[2**m];
    component greater[2**m];
    component greaterSender[2**m];
    component greaterReceiver[2**m];
    component nonceEquals[2**m];

    component ERC721TokenFrom[2**m];
    component ERC721TokenTo[2**m];

    currentState === intermediateRoots[0];

    for (var i = 0; i < 2**m; i++) {
        // transactions existence and signature check
        txExistence[i] = ERC721TxExistence(m);
        txExistence[i].fromX <== fromX[i];
        txExistence[i].fromY <== fromY[i];
        txExistence[i].fromIndex <== fromIndex[i];
        txExistence[i].toX <== toX[i];
        txExistence[i].toY <== toY[i];
        txExistence[i].nonce <== nonceFrom[i];
        txExistence[i].transferTokenID <== transferTokenID[i];

        txExistence[i].txRoot <== txRoot;

        for (var j = 0; j < m; j++){
            txExistence[i].paths2rootPos[j] <== paths2txRootPos[i][j];
            txExistence[i].paths2root[j] <== paths2txRoot[i][j];
        }

        txExistence[i].R8x <== R8x[i];
        txExistence[i].R8y <== R8y[i];
        txExistence[i].S <== S[i];

        // ERC721Token sender
        ERC721TokenFrom[i] = SenderERC721Token(x);
        for (var j = 0; j < x; j++) {
            ERC721TokenFrom[i].currentTokenIDs[j] <== tokenIDsFrom[i][j];
        }
        ERC721TokenFrom[i].transferTokenID <== transferTokenID[i];
        
        // sender existence check
        senderExistence[i] = ERC721BalanceExistence(n, x);
        senderExistence[i].x <== fromX[i];
        senderExistence[i].y <== fromY[i];
        for (var j = 0; j < x; j++) {
            senderExistence[i].tokenIDs[j] <== tokenIDsFrom[i][j];
        }
        senderExistence[i].nonce <== nonceFrom[i];

        senderExistence[i].balanceRoot <== intermediateRoots[2*i];
        for (var j = 0; j < n; j++){
            senderExistence[i].paths2rootPos[j] <== paths2rootFromPos[i][j];
            senderExistence[i].paths2root[j] <== paths2rootFrom[i][j];
        }

        //nonceFrom[i] != NONCE_MAX_VALUE;
        nonceEquals[i] = IsEqual();
        nonceEquals[i].in[0] <== nonceFrom[i];
        nonceEquals[i].in[1] <== NONCE_MAX_VALUE;
        nonceEquals[i].out === 0; 

        // subtract transferTokenID from sender tokenIDs; increase sender nonce 
        newSender[i] = ERC721BalanceLeaf(x-1);
        newSender[i].x <== fromX[i];
        newSender[i].y <== fromY[i];
        for (var j = 0; j < x-1; j++) {
            newSender[i].tokenIDs[j] <== ERC721TokenFrom[i].newTokenIDs[j];
        }
        newSender[i].nonce <== nonceFrom[i] + 1;

        // get intermediate root from new sender leaf
        computedRootFromNewSender[i] = GetMerkleRoot(n);
        computedRootFromNewSender[i].leaf <== newSender[i].out;
        for (var j = 0; j < n; j++){
            computedRootFromNewSender[i].paths2root[j] <== paths2rootFrom[i][j];
            computedRootFromNewSender[i].paths2rootPos[j] <== paths2rootFromPos[i][j];
        }

        // check that intermediate root is consistent with input

        computedRootFromNewSender[i].out === intermediateRoots[2*i  + 1];
        //-----END SENDER IN TREE 2 AFTER DEDUCTING CHECK-----//

        // ERC721Token receiver
        ERC721TokenTo[i] = ReceiverERC721Token(y);
        for (var j = 0; j < y; j++) {
            ERC721TokenFrom[i].currentTokenIDs[j] <== tokenIDsTo[i][j];
        }
        ERC721TokenFrom[i].transferTokenID <== transferTokenID[i];
        
        // receiver existence check in intermediate root from new sender
        receiverExistence[i] = ERC721BalanceExistence(n, y);
        receiverExistence[i].x <== toX[i];
        receiverExistence[i].y <== toY[i];
        for (var j = 0; j < y; j++) {
            receiverExistence[i].tokenIDs[j] <== tokenIDsFrom[i][j];
        }
        receiverExistence[i].nonce <== nonceTo[i];

        receiverExistence[i].balanceRoot <== intermediateRoots[2*i + 1];
        for (var j = 0; j < n; j++){
            receiverExistence[i].paths2rootPos[j] <== paths2rootToPos[i][j] ;
            receiverExistence[i].paths2root[j] <== paths2rootTo[i][j];
        }

        //-----CHECK RECEIVER IN TREE 3 AFTER INCREMENTING-----//

        // if receiver is zero address, do not change balance
        // otherwise add transferTokenID to receiver tokenIDs
        allLow[i] = AllLow(2);
        allLow[i].in[0] <== toX[i];
        allLow[i].in[1] <== toY[i];

        if (allLow.out == 1) {
            newReceiver[i] = ERC721BalanceLeaf(y);
            newReceiver[i].x <== toX[i];
            newReceiver[i].y <== toY[i];
            for (var j = 0; j < y; j++) {
                newReceiver[i].tokenIDs[j] <== tokenIDsTo[i][j];
            }
            newReceiver[i].nonce <== nonceTo[i];
        } else {
            newReceiver[i] = ERC721BalanceLeaf(y+1);
            newReceiver[i].x <== toX[i];
            newReceiver[i].y <== toY[i];
            for (var j = 0; j < y+1; j++) {
                newReceiver[i].tokenIDs[j] <== ERC721TokenTo[i].newTokenIDs[j];
            }
            newReceiver[i].nonce <== nonceTo[i];
        }

        // get intermediate root from new receiver leaf
        computedRootFromNewReceiver[i] = GetMerkleRoot(n);
        computedRootFromNewReceiver[i].leaf <== newReceiver[i].out;
        for (var j = 0; j < n; j++){
            computedRootFromNewReceiver[i].paths2root[j] <== paths2rootTo[i][j];
            computedRootFromNewReceiver[i].paths2rootPos[j] <== paths2rootToPos[i][j];
        }

        // check that intermediate root is consistent with input
        computedRootFromNewReceiver[i].out === intermediateRoots[2*i  + 2];
        //-----END CHECK RECEIVER IN TREE 3 AFTER INCREMENTING-----//
    }
    out <== computedRootFromNewReceiver[2**m - 1].out;
}

// TODO: how to pass the dynamic x, y to Main circuit?
component main { public [txRoot, currentState] } = Main(4, 2);
