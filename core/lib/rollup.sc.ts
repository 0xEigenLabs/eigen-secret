import { ethers } from "ethers"
import { assert } from "chai";
import { parseProof, uint8Array2Bigint } from "./utils";
import { errResp, succResp, ErrCode } from "./error";
const createBlakeHash = require("blake-hash");


/*
    Here we want to test the smart contract's deposit functionality.
*/

export class RollupSC {
    userAccount: any;
    rollup: any;
    moduleProxy: any;
    tokenRegistry: any;
    spongePoseidon: any;
    eddsa: any;

    alias: string;
    aliasHash: any;

    spongePoseidonAddress: string;
    tokenRegistryAddress: string;
    poseidon2Address: string;
    poseidon3Address: string;
    poseidon6Address: string;
    rollupProxyAddress: string;

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
        rollupProxyAddress: string
    ) {
        this.eddsa = eddsa;
        this.alias = alias;
        this.userAccount = userAccount;
        this.rollup = undefined;
        this.tokenRegistry = undefined;
        this.spongePoseidon = undefined;
        this.aliasHash = undefined;

        this.spongePoseidonAddress = spongePoseidonAddress;
        this.tokenRegistryAddress = tokenRegistryAddress;
        this.poseidon2Address = poseidon2Address;
        this.poseidon3Address = poseidon2Address;
        this.poseidon6Address = poseidon2Address;
        this.rollupProxyAddress = rollupProxyAddress;
        this.tokenERC20ABI = undefined;
    }

    async initialize(
        spongePoseidonContractABI: any,
        tokenRegistryContractABI: any,
        rollupContractABI: any,
        moduleProxyABI: any,
        tokenContractABI: any
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
        this.moduleProxy = new ethers.Contract(
            this.rollupProxyAddress, moduleProxyABI, this.userAccount
        )
        this.rollup = new ethers.Contract(
            this.rollupProxyAddress, rollupContractABI, this.userAccount
        )
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

    async getTokenInfo(tokenAddress: string) {
        let testToken = new ethers.Contract(tokenAddress, this.tokenERC20ABI, this.userAccount);
        let symbol = await testToken.symbol()
        let name = await testToken.name()
        let decimals = await testToken.decimals()
        let info = {
            "symbol": symbol,
            "name": name,
            "decimals": decimals
        }
        return info
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
        return approveToken;
    }

    async allowance(tokenAddress: string) {
        let userAccount = this.userAccount;
        assert(this.rollup);
        let testToken = new ethers.Contract(tokenAddress, this.tokenERC20ABI, this.userAccount);
        let allowance = await testToken.connect(userAccount).allowance(
            userAccount.address,
            this.rollup.address,
            { from: userAccount.address }
        )
        return allowance.toBigInt();
    }

    async deposit(pubkeyEigenAccountKey: bigint[], assetId: number, value: bigint, nonce: number, keysFound: bigint[], valuesFound: bigint[], siblings: bigint[][]) {
        let userAccount = this.userAccount;
        assert(this.rollup);
        let receipt: any;
        try {
            let etherValue = assetId == 1? value: 0n;
            let deposit0 = await this.rollup.connect(userAccount).deposit(
                pubkeyEigenAccountKey,
                assetId,
                value,
                nonce,
                keysFound,
                valuesFound,
                siblings,
                { from: userAccount.address, value: etherValue }
            )
            receipt = await deposit0.wait()
            if (receipt.status !== 1) {
                throw new Error(`receipt: ${JSON.stringify(receipt)}`)
            }
        } catch (error: any) {
            console.log("deposit revert reason", error)
            return errResp(ErrCode.CallContractError, JSON.stringify(error))
        }

        return succResp(receipt, true);
    }

    async update(proofAndPublicSignal: any) {
        assert(this.rollup);
        let update: any;
        let receipt: any;
        let proof = parseProof(proofAndPublicSignal.proof);
        try {
            update = await this.rollup.connect(this.userAccount).update(
                proof.a,
                proof.b,
                proof.c,
                proofAndPublicSignal.publicSignals,
                { from: this.userAccount.address }
            )
            receipt = await update.wait()
            if (receipt.status !== 1) {
                throw new Error(`receipt: ${JSON.stringify(receipt)}`)
            }
        } catch (error: any) {
            console.log("update revert reason", error)
            return errResp(ErrCode.CallContractError, JSON.stringify(error))
        }
        return succResp(receipt, true);
    }

    async withdraw(receiverAccountAddress: any, txInfo: any, proofAndPublicSignal: any) {
        assert(this.rollup);
        let withdraw: any;
        let proof = parseProof(proofAndPublicSignal.proof);
        let receipt: any;
        try {
            withdraw = await this.rollup.connect(this.userAccount).withdraw(
                txInfo,
                receiverAccountAddress,
                proof.a,
                proof.b,
                proof.c,
                { from: this.userAccount.address }
            )
            receipt = await withdraw.wait()
            if (receipt.status !== 1) {
                throw new Error(`receipt: ${JSON.stringify(receipt)}`)
            }
        } catch (error: any) {
            console.log("withdraw revert reason", error)
            return errResp(ErrCode.CallContractError, JSON.stringify(error))
        }
        return succResp(receipt, true);
    }
}

