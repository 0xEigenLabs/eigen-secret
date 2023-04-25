import { ethers } from "ethers"
import { assert } from "chai";
import { parseProof, uint8Array2Bigint } from "./utils";

const createBlakeHash = require("blake-hash");


/*
    Here we want to test the smart contract's deposit functionality.
*/

export class RollupSC {
    userAccount: any;
    rollup: any;
    tokenRegistry: any;
    spongePoseidon: any;
    SMT: any;
    eddsa: any;

    alias: string;
    aliasHash: any;

    spongePoseidonAddress: string;
    tokenRegistryAddress: string;
    poseidon2Address: string;
    poseidon3Address: string;
    poseidon6Address: string;
    rollupAddress: string;
    smtVerifierAddress: string;

    tokenERC20ABI: any;

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
        smtVerifierAddress: string = ""
    ) {
        this.eddsa = eddsa;
        this.alias = alias;
        this.userAccount = userAccount;
        this.rollup = undefined;
        this.tokenRegistry = undefined;
        this.spongePoseidon = undefined;
        this.SMT = undefined;
        this.aliasHash = undefined;

        this.spongePoseidonAddress = spongePoseidonAddress;
        this.tokenRegistryAddress = tokenRegistryAddress;
        this.poseidon2Address = poseidon2Address;
        this.poseidon3Address = poseidon2Address;
        this.poseidon6Address = poseidon2Address;
        this.rollupAddress = rollupAddress;
        this.smtVerifierAddress = smtVerifierAddress;
        this.tokenERC20ABI = undefined;
    }

    async initialize(
        spongePoseidonContractABI: any,
        tokenRegistryContractABI: any,
        rollupContractABI: any,
        tokenContractABI: any,
        smtVerifierContractABI: any
    ) {
        this.tokenERC20ABI = tokenContractABI;
        const aliasHashBuffer = this.eddsa.pruneBuffer(
            createBlakeHash("blake512").update(this.alias).digest().slice(0, 32)
        );
        this.aliasHash = uint8Array2Bigint(aliasHashBuffer);
        this.spongePoseidon = new ethers.Contract(
            this.spongePoseidonAddress, spongePoseidonContractABI, this.userAccount
        );
        this.tokenRegistry = new ethers.Contract(
            this.tokenRegistryAddress, tokenRegistryContractABI, this.userAccount
        );
        this.rollup = new ethers.Contract(this.rollupAddress, rollupContractABI, this.userAccount);

        if (this.smtVerifierAddress != "") {
            this.SMT = new ethers.Contract(this.smtVerifierAddress, smtVerifierContractABI, this.userAccount);
        }
    }

    async setRollupNC() {
        let tx = await this.tokenRegistry.
            connect(this.userAccount).setRollupNC(this.rollup.address);
        await tx.wait();
    }

    async getRegisteredToken(id: bigint) {
        return await this.tokenRegistry.connect(this.userAccount).
            registeredTokens(id)
    }

    // customize tokenAddress
    async registerToken(tokenAddress: string) {
        let info = await this.tokenRegistry.
            connect(this.userAccount).
            pendingTokens(tokenAddress);
        if (info) {
            return;
        }

        let registerToken = await this.rollup.connect(this.userAccount).
            registerToken(
                tokenAddress,
                { from: this.userAccount.address }
        )
        assert(registerToken, "token registration failed");
        await registerToken.wait();
    }

    /**
     * customize tokenAddress
     * @param {string} tokenAddress token address
     * @return { bigint } assetId
     */
    async approveToken(tokenAddress: string) {
        let approveToken = await this.rollup.connect(this.userAccount).approveToken(
            tokenAddress, { from: this.userAccount.address }
        )
        let tx = await approveToken.wait();
        let abi = ["event RegisteredToken(uint publicAssetId, address tokenContract)"];
        const iface = new ethers.utils.Interface(abi)
        const eventData = iface.decodeEventLog("RegisteredToken", tx.logs[0].data, tx.logs[0].topics)
        return eventData["publicAssetId"];
    }

    async approve(tokenAddress: string, value: bigint) {
        let userAccount = this.userAccount;
        assert(this.rollup);
        let testToken = new ethers.Contract(tokenAddress, this.tokenERC20ABI, this.userAccount);
        let approveToken = await testToken.connect(userAccount).approve(
            this.rollup.address, value,
            { from: userAccount.address }
        )
        assert(approveToken, "approveToken failed")
        return approveToken;
    }

    async deposit(pubkeyEigenAccountKey: bigint[], assetId: number, value: bigint, nonce: number) {
        let userAccount = this.userAccount;
        assert(this.rollup);
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
