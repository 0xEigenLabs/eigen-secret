const Tree = require("./tree.js");
const Transaction = require("./transaction.js")

const buildMimc7 = require("circomlibjs").buildMimc7;

module.exports = class AccountTree extends Tree{
    constructor(
        _accounts
    ){
        super(_accounts.map(x => x.hashAccount()))
        this.accounts = _accounts
    }

    async processTxArray(txTree){
        let mimcjs = await buildMimc7()
        let F = mimcjs.F

        const originalState = this.root;
        const txs = txTree.txs;

        var paths2txRoot = new Array(txs.length);
        var paths2txRootPos = new Array(txs.length);
        var deltas = new Array(txs.length);

        for (var i = 0; i < txs.length; i++){

            const tx = txs[i];

            // verify tx exists in tx tree
            const [txProof, txProofPos] = txTree.getTxProofAndProofPos(tx);
            txTree.checkTxExistence(tx, txProof);
            paths2txRoot[i] = [F.toString(txProof[0]), F.toString(txProof[1])];
            paths2txRootPos[i] = txProofPos;

            // process transaction
            console.log("processing tx:", i)
            deltas[i] = await this.processTx(tx);
        }

        return {
            originalState: originalState,
            txTree: txTree,
            paths2txRoot: paths2txRoot,
            paths2txRootPos: paths2txRootPos,
            deltas: deltas
        }
    }

    async processTx(tx){
        let mimcjs = await buildMimc7()
        let F = mimcjs.F
        const sender = this.findAccountByPubkey(tx.fromX, tx.fromY);
        const indexFrom = sender.index;
        const balanceCommXFrom = F.toString(sender.balanceCommX);
        const balanceCommYFrom = F.toString(sender.balanceCommY);

        const receiver = this.findAccountByPubkey(tx.toX, tx.toY);
        const indexTo = receiver.index;
        const balanceCommXTo = F.toString(receiver.balanceCommX);
        const balanceCommYTo = F.toString(receiver.balanceCommY);
        const nonceTo = receiver.nonce;
        const tokenTypeTo = receiver.tokenType;

        const [senderProof, senderProofPos] = this.getAccountProof(sender);
        console.log("sender checking")
        console.log("sender Proof:", senderProof)
        console.log("senderProofPos", senderProofPos)
        this.checkAccountExistence(sender, senderProof);
        tx.checkSignature();
        this.checkTokenTypes(tx);

        sender.debitAndIncreaseNonce(tx.amountCommX, tx.amountCommY);
        this.leafNodes[sender.index] = sender.hash;

        this.updateInnerNodes(sender.hash, sender.index, senderProof);
        this.root = this.innerNodes[0][0]
        const rootFromNewSender = this.root;

        const [receiverProof, receiverProofPos] = this.getAccountProof(receiver);
        console.log("receiver check")
        console.log("receiver Proof:", receiverProof)
        console.log("receiverProofPos", receiverProofPos)
        this.checkAccountExistence(receiver, receiverProof);

        receiver.credit(tx.amountCommX, tx.amountCommY);
        this.leafNodes[receiver.index] = receiver.hash;
        this.updateInnerNodes(receiver.hash, receiver.index, receiverProof);
        this.root = this.innerNodes[0][0]
        const rootFromNewReceiver = this.root;

        return {
            senderProof: senderProof,
            senderProofPos: senderProofPos,
            rootFromNewSender: rootFromNewSender,
            receiverProof: receiverProof,
            receiverProofPos: receiverProofPos,
            rootFromNewReceiver: rootFromNewReceiver,
            indexFrom: indexFrom,
            balanceCommXFrom: balanceCommXFrom,
            balanceCommYFrom: balanceCommYFrom,
            indexTo: indexTo,
            balanceCommXTo: balanceCommXTo,
            balanceCommYTo: balanceCommYTo,
            nonceTo: nonceTo,
            tokenTypeTo: tokenTypeTo
        }
    }

    checkTokenTypes(tx){
        const sender = this.findAccountByPubkey(tx.fromX, tx.fromY)
        const receiver = this.findAccountByPubkey(tx.toX, tx.toY)
        const sameTokenType = (
            (tx.tokenType == sender.tokenType && tx.tokenType == receiver.tokenType)
            || receiver.tokenType == 0 //withdraw token type doesn't have to match
        );
        if (!sameTokenType){
            throw "token types do not match"
        }
    }

    checkAccountExistence(account, accountProof){
        if (!this.verifyProof(account.hash, account.index, accountProof)){
            console.log('given account hash', account.hash)
            console.log('given account proof', accountProof)

            throw "account does not exist"
        }
    }

    getAccountProof(account){
        const proofObj = this.getProof(account.index)
        return [proofObj.proof, proofObj.proofPos]
    }

    findAccountByPubkey(pubkeyX, pubkeyY){
        const account = this.accounts.filter(
            acct => (acct.pubkeyX == pubkeyX && acct.pubkeyY == pubkeyY)
        )[0];
        return account
    }

    generateEmptyTx(pubkeyX, pubkeyY, index, prvkey){
        const sender = this.findAccountByPubkey(pubkeyX, pubkeyY);
        const nonce = sender.nonce;
        const tokenType = sender.tokenType;
        var tx = new Transaction(
            pubkeyX, pubkeyY, index,
            pubkeyX, pubkeyY,
            nonce, 0, tokenType
        );
        tx.signTxHash(prvkey);
    }

}
