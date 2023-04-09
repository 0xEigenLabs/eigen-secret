import { ethers } from "ethers"
import { assert } from "chai";
import { uint8Array2Bigint, parseProof } from "../src/utils";
import spongePoseidonContract from "../artifacts/contracts/libs/Poseidon.sol/SpongePoseidon.json";
import tokenRegistryContract from "../artifacts/contracts/TokenRegistry.sol/TokenRegistry.json";
import rollupContract from "../artifacts/contracts/Rollup.sol/Rollup.json";
import testTokenContract from "../artifacts/contracts/TestToken.sol/TestToken.json";
const createBlakeHash = require("blake-hash");


/*
    Here we want to test the smart contract's deposit functionality.
*/

export class RollupSC {
    userAccount: any;
    rollup: any;
    tokenRegistry: any;
    testToken: any;
    spongePoseidon: any;
    eddsa: any;

    alias: string;
    aliasHash: any;

    spongePoseidonAddress: string;
    tokenRegistryAddress: string;
    poseidon2Address: string;
    poseidon3Address: string;
    poseidon6Address: string;
    rollupAddress: string;
    testTokenAddress: string;

    constructor(
        eddsa: any,
        alias: string,
        userAccount: any,
        spongePoseidonAddress: string,
        tokenRegistryAddress: string,
        poseidon2Address: string,
        poseidon3Address: string,
        poseidon6Address: string,
        rollupAddress: string,
        testTokenAddress: string = ""
    ) {
        this.eddsa = eddsa;
        this.alias = alias;
        this.userAccount = userAccount;
        this.rollup = undefined;
        this.tokenRegistry = undefined;
        this.testToken = undefined;
        this.spongePoseidon = undefined;
        this.aliasHash = undefined;

        this.spongePoseidonAddress = spongePoseidonAddress;
        this.tokenRegistryAddress = tokenRegistryAddress;
        this.poseidon2Address = poseidon2Address;
        this.poseidon3Address = poseidon2Address;
        this.poseidon6Address = poseidon2Address;
        this.rollupAddress = rollupAddress;
        this.testTokenAddress = testTokenAddress;
    }

    async initialize() {
        const aliasHashBuffer = this.eddsa.pruneBuffer(
            createBlakeHash("blake512").update(this.alias).digest().slice(0, 32)
        );
        this.aliasHash = uint8Array2Bigint(aliasHashBuffer);
        this.spongePoseidon = new ethers.Contract(
            this.spongePoseidonAddress, spongePoseidonContract.abi, this.userAccount
        );
        this.tokenRegistry = new ethers.Contract(
            this.tokenRegistryAddress, tokenRegistryContract.abi, this.userAccount
        );
        this.rollup = new ethers.Contract(this.rollupAddress, rollupContract.abi, this.userAccount);

        if (this.testTokenAddress != "") {
            this.testToken = new ethers.Contract(this.testTokenAddress, testTokenContract.abi, this.userAccount);
        }
    }

    async deposit(pubkeyEigenAccountKey: bigint[], assetId: number, value: number, nonce: number) {
        let userAccount = this.userAccount;
        assert(this.rollup);
        console.log(this.testToken);
        let approveToken = await this.testToken.connect(userAccount).approve(
            this.rollup.address, value,
            { from: userAccount.address }
        )
        console.log(approveToken);
        assert(approveToken, "approveToken failed")
        let deposit0 = await this.rollup.connect(userAccount).deposit(
            pubkeyEigenAccountKey,
            assetId,
            value,
            nonce,
            { from: userAccount.address }
        )
        assert(deposit0, "deposit0 failed");
        return deposit0;
    }

    async processDeposits(userAccount: any, keysFound: any, valuesFound: any, siblings: any) {
        assert(this.rollup);
        let processDeposit1: any;
        try {
            processDeposit1 = await this.rollup.connect(userAccount).processDeposits(
                keysFound,
                valuesFound,
                siblings,
                { from: userAccount.address }
            )
        } catch (error) {
            console.log("processDeposits revert reason", error)
        }
        assert(processDeposit1, "processDeposit1 failed")
    }

    async update(proofAndPublicSignal: any) {
        assert(this.rollup);
        let update: any;
        let proof = parseProof(proofAndPublicSignal.proof);
        try {
            update = await this.rollup.connect(this.userAccount).update(
                proof.a,
                proof.b,
                proof.c,
                proofAndPublicSignal.publicSignals,
                { from: this.userAccount.address }
            )
        } catch (error) {
            console.log("processDeposits revert reason", error)
        }
        assert(update, "update failed")
    }

    async withdraw(receiverAccount: any, txInfo: any, proofAndPublicSignal: any) {
        assert(this.rollup);
        let processDeposit1: any;
        let proof = parseProof(proofAndPublicSignal.proof);
        try {
            processDeposit1 = await this.rollup.connect(this.userAccount).withdraw(
                txInfo,
                receiverAccount.address,
                proof.a,
                proof.b,
                proof.c,
                { from: this.userAccount.address }
            )
        } catch (error) {
            console.log("processDeposits revert reason", error)
        }
        assert(processDeposit1, "processDeposit1 failed")
    }
}
