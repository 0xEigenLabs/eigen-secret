const {waffle, ethers} = require("hardhat");
//import { ContractFactory, BigNumber} from "ethers";
const hre = require('hardhat')
const assert = require('assert');
const cls = require("circomlibjs");
const Account = require("../src/account.js");
const Transaction = require("../src/transaction.js");

const {prove, verify, proveWithdrawSignature, verifyWithdrawSignature} = require("../operator/prover");
//import treeHelper from "../src/treeHelper";

const ACCOUNT_DEPTH = 8;
const TXS_PER_SNARK = 4;
const NUM_LEAVES = 2 ** ACCOUNT_DEPTH;

function generatePrvkey(i){
    let prvkey = Buffer.from(i.toString().padStart(64,'0'), "hex");
    return prvkey;
}


describe("Prover generates proof and verify", () => {
    let eddsa;

    before(async function () {
        eddsa = await cls.buildEddsa();
    });

    // ----------------------------------------------------------------------------------

    it("should generate proof and verify", async () => {
        // mock the account and transaction data
        // generate 8 accounts
        let zeroAccount = new Account();
        await zeroAccount.initialize();
        var accArray = [zeroAccount]

        const coordinatorPrvkey = generatePrvkey(1);
        const coordinatorPubkey = generatePubkey(coordinatorPrvkey);
        const coordinator = new Account(
            1, coordinatorPubkey[0], coordinatorPubkey[1],
            0, 0, 0, coordinatorPrvkey
        );
        await coordinator.initialize()

        accArray.push(coordinator);

        const numAccounts = 6
        const tokenTypes = [2, 1, 2, 1, 2, 1];
        const balances = [1000, 20, 200, 100, 500, 20];
        const nonces = [0, 0, 0, 0, 0, 0];

        function generatePubkey(prvkey){
            let pubkey = eddsa.prv2pub(prvkey);
            return pubkey;
        }
        
        for (var i = 0; i < numAccounts; i++) {
            var prvkey = generatePrvkey(i + 2);
            var pubkey = generatePubkey(prvkey);
            var account = new Account(
                i + 2, // index
                pubkey[0], // pubkey x coordinate
                pubkey[1], // pubkey y coordinate
                balances[i], // balance
                nonces[i], // nonce
                tokenTypes[i], // tokenType,
                prvkey
            )
            await account.initialize()
            accArray.push(account);
        }

        // generate 4 txs
        let fromAccountsIdx = [2, 4, 3, 1]
        let toAccountsIdx = [4, 0, 5, 0]

        const amounts = [500, 200, 10, 0]
        const txTokenTypes = [2, 2, 1, 0]
        const txNonces = [0, 0, 0, 0]

        var txArray = new Array(TXS_PER_SNARK)

        for (var i = 0; i < txArray.length; i++){
            let fromAccount = accArray[fromAccountsIdx[i]];
            let toAccount = accArray[toAccountsIdx[i]];
            let tx = new Transaction(
            fromAccount.pubkeyX,
            fromAccount.pubkeyY,
            fromAccount.index,
            toAccount.pubkeyX,
            toAccount.pubkeyY,
            txNonces[i],
            amounts[i],
            txTokenTypes[i]
            );
            await tx.initialize()

            tx.hashTx();
            tx.signTxHash(fromAccount.prvkey);

            tx.checkSignature()

            txArray[i] = tx;
        }

        let {vk, proof, inputJson, proofJson, publicJson, txRoot} = await prove(accArray, txArray);

        let isValid = await verify(vk, proof);
        assert(isValid, "invalid proof")
    });

    it("withdraw signature", async () => {
        // mock the account and transaction data
        // generate 8 accounts
        mimcjs = await cls.buildMimc7();
        babyJub = await cls.buildBabyjub();
        //let F = eddsa.babyJub.F;
        let F = mimcjs.F

        var prvKey = Buffer.from("4".padStart(64,'0'), "hex");
        // const prvKey = fromHexString("0001020304050607080900010203040506070809000102030405060708090002");
      
        var pubKey = eddsa.prv2pub(prvKey);
      
        var nonce = 0;
        //var txRoot = bigInt('14053325031894235002744541221369412510941171790893507881802249870625790656164')
        var recipient = BigInt('0xC33Bdb8051D6d2002c0D80A1Dd23A1c9d9FC26E4');
        var m = mimcjs.multiHash([nonce, recipient])
        //const msgBuf = fromHexString("000102030405060708090000");
        //const msg = eddsa.babyJub.F.e(Scalar.fromRprLE(msgBuf, 0));
        const msg = F.e(m);
      
        var signature = eddsa.signMiMC(prvKey, msg);

        let {vk, proof, proofJson} = await proveWithdrawSignature(pubKey, signature, msg)

        let isValid = await verifyWithdrawSignature(vk, proof);
        assert(isValid, "invalid proof")
    });
});
