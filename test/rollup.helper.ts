import { ethers } from "hardhat";
const {BigNumber, ContractFactory, Contract} = require("ethers");
import { expect, assert } from "chai";
const {buildEddsa} = require("circomlibjs");
const path = require("path");
const fs = require("fs");
const unstringifyBigInts = require("ffjavascript").utils.unstringifyBigInts;
import { uint8Array2Bigint, prepareJson, parseProof, Proof, signEOASignature } from "../src/utils";
import { deploySpongePoseidon, deployPoseidons, deployPoseidonFacade } from "./deploy_poseidons.util";
import { AccountCircuit, compress as accountCompress, EigenAddress, SigningKey } from "../src/account";
import { JoinSplitCircuit } from "../src/join_split";
import { Prover } from "../src/prover";
import { WorldState } from "../src/state_tree";
import { getHashes, N_LEVEL, StateTreeCircuitInput, siblingsPad } from "../src/state_tree_circuit";
const createBlakeHash = require("blake-hash");
import { UpdateStatusCircuit, UpdateStatusInput } from "../src/update_state";
import { NoteModel, updateDBNotes, getDBNotes } from "../server/note";
import { Note, NoteState } from "../src/note";
import { Transaction } from "../src/transaction";
import { createTxInternal } from "../server/transaction";
import sequelize from "../src/db";

/*
    Here we want to test the smart contract's deposit functionality.
*/

export class RollupHelper {
    userAccounts:any;
    rollup:any;
    tokenRegistry:any;
    testToken:any;
    spongePoseidon: any;
    poseidonContracts: any;
    eddsa: any;

    testTokenAssetId = 0;
    // index = 0 is the coordinator
    eigenAccountKey: SigningKey[] = []; // n
    pubkeyEigenAccountKey: bigint[][] = []; // 2n
    eigenSigningKeys: SigningKey[][] = []; // 3n
    pubkeyEigenSigningKeys: bigint[][][] = []; // 3n * 2

    rawMessage: string = "Use Eigen Secret to shield your asset";
    circuitPath: string = path.join(__dirname, "../circuits/");
    alias: string = "contract.eigen.eth"
    aliasHash: any;
    createAccountFunc: any;
    depositFunc: any;
    sendFunc: any;

    constructor(
        userAccounts: any,
    ) {
        this.userAccounts = userAccounts;
        this.rollup = undefined;
        this.tokenRegistry = undefined;
        this.testToken = undefined;
        this.spongePoseidon = undefined;
        this.eddsa = undefined;
        this.aliasHash = undefined;
        this.createAccountFunc = undefined;
        this.depositFunc = undefined;
        this.sendFunc = undefined;
    }

    async initialize() {
        this.eddsa = await buildEddsa();
        const aliasHashBuffer = this.eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));
        this.aliasHash = uint8Array2Bigint(aliasHashBuffer);

        //TODO: may not deploy all contract
        this.poseidonContracts = await deployPoseidons(
            (
                await ethers.getSigners()
            )[0],
            new Array(6).fill(6).map((_, i) => i + 1)
        );

        this.spongePoseidon = await deploySpongePoseidon(this.poseidonContracts[5].address);

        let factoryTR = await ethers.getContractFactory("TokenRegistry");
        this.tokenRegistry = await factoryTR.deploy(this.userAccounts[0].address)
        await this.tokenRegistry.deployed()

        let factoryR = await ethers.getContractFactory(
            "Rollup",
            {
                libraries: {
                    SpongePoseidon: this.spongePoseidon.address,
                }
            }
        );
        this.rollup = await factoryR.deploy(
            this.poseidonContracts[1].address,
            this.poseidonContracts[2].address,
            this.tokenRegistry.address,
        );
        await this.rollup.deployed();
        console.log("rollup address:", this.rollup.address);

        let factoryTT = await ethers.getContractFactory("TestToken");
        this.testToken = await factoryTT.connect(this.userAccounts[3]).deploy();
        await this.testToken.deployed();

        for (const ea of this.userAccounts) {
            await this.testToken.connect(this.userAccounts[3]).transfer(ea.address, 1000);
        }

        let tmpKey: any;
        let tmpKeyP: any;
        const F = this.eddsa.F;
        const babyJub = this.eddsa.babyJub;
        for (var i = 0; i < 20; i ++) {
            let tmp = await (new SigningKey()).newKey(undefined);
            let tmpP = tmp.pubKey.unpack(babyJub);
            let tmpPub = [F.toObject(tmpP[0]), F.toObject(tmpP[1])];
            this.eigenAccountKey.push(tmp);
            this.pubkeyEigenAccountKey.push(tmpPub);

            let tmpSigningKeys = [];
            let tmpPubKeySigningKeys = [];

            tmpKey = await (new SigningKey()).newKey(undefined);
            tmpSigningKeys.push(tmpKey);
            tmpKeyP = tmpKey.pubKey.unpack(babyJub);
            tmpPubKeySigningKeys.push([F.toObject(tmpKeyP[0]), F.toObject(tmpKeyP[1])]);

            tmpKey = await (new SigningKey()).newKey(undefined);
            tmpSigningKeys.push(tmpKey);
            tmpKeyP = tmpKey.pubKey.unpack(babyJub);
            tmpPubKeySigningKeys.push([F.toObject(tmpKeyP[0]), F.toObject(tmpKeyP[1])]);

            tmpKey = await (new SigningKey()).newKey(undefined);
            tmpSigningKeys.push(tmpKey);
            tmpKeyP = tmpKey.pubKey.unpack(babyJub);
            tmpPubKeySigningKeys.push([F.toObject(tmpKeyP[0]), F.toObject(tmpKeyP[1])]);

            this.eigenSigningKeys.push(tmpSigningKeys);
            this.pubkeyEigenSigningKeys.push(tmpPubKeySigningKeys);
        }
    }

    async deploy() {
        let setrollup = await this.tokenRegistry.connect(this.userAccounts[0]).setRollupNC(this.rollup.address);
        assert(setrollup, 'setRollupNC failed')

        let registerToken = await this.rollup.connect(this.userAccounts[1]).registerToken(this.testToken.address, { from: this.userAccounts[1].address })
        assert(registerToken, "token registration failed");

        let approveToken = await this.rollup.connect(this.userAccounts[0]).approveToken(this.testToken.address, { from: this.userAccounts[0].address })
        assert(approveToken, "token registration failed");
        this.testTokenAssetId = await this.tokenRegistry.numTokens();

        let approveToken2 = await this.testToken.connect(this.userAccounts[3]).approve(
            this.rollup.address, 1700,
            {from: this.userAccounts[3].address}
        )
        assert(approveToken2, "approveToken failed")
        return await this.tokenRegistry.numTokens();
    }

    async deposit(index: number, assetId: number, value: number) {
        assert(value <= 1000, "check the line 96");
        let approveToken = await this.testToken.connect(this.userAccounts[index]).approve(
            this.rollup.address, value,
            {from: this.userAccounts[index].address}
        )
        assert(approveToken, "approveToken failed")
        let deposit0 = await this.rollup.connect(this.userAccounts[index]).deposit(
            this.pubkeyEigenAccountKey[index],
            assetId,
            value,
            0, //TODO: use nonce
            { from: this.userAccounts[index].address }
        )
        assert(deposit0, "deposit0 failed");
        return deposit0;
    }

    async processDeposits(i: number, keysFound: any, valuesFound: any, siblings: any) {
        let processDeposit1: any;
        // create 4 notes for above deposit.
        try {
            processDeposit1 = await this.rollup.connect(this.userAccounts[i]).processDeposits(
                keysFound,
                valuesFound,
                siblings,
                { from: this.userAccounts[i].address }
            )
        } catch (error) {
            console.log('processDeposits revert reason', error)
        }
        assert(processDeposit1, "processDeposit1 failed")
        await this.rollup.dataTreeRoot().then(console.log)
    }

    async update(i: number, proofAndPublicSignal: any) {
        let processDeposit1: any;
        // create 4 notes for above deposit.
        let proof = parseProof(proofAndPublicSignal.proof);
        try {
            processDeposit1 = await this.rollup.connect(this.userAccounts[i]).update(
                proof.a,
                proof.b,
                proof.c,
                proofAndPublicSignal.publicSignals,
                { from: this.userAccounts[i].address }
            )
        } catch (error) {
            console.log('processDeposits revert reason', error)
        }
        assert(processDeposit1, "processDeposit1 failed")
        await this.rollup.dataTreeRoot().then(console.log)
    }

    async withdraw(i: number, receiverI: number, txInfo: any, proofAndPublicSignal: any) {
        let processDeposit1: any;
        // create 4 notes for above deposit.
        let proof = parseProof(proofAndPublicSignal.proof);
        console.log(txInfo, this.userAccounts[receiverI].address, proof);
        try {
            processDeposit1 = await this.rollup.connect(this.userAccounts[i]).withdraw(
                txInfo,
                this.userAccounts[receiverI].address,
                proof.a,
                proof.b,
                proof.c,
                { from: this.userAccounts[i].address }
            )
        } catch (error) {
            console.log('processDeposits revert reason', error)
        }
        assert(processDeposit1, "processDeposit1 failed")
        await this.rollup.dataTreeRoot().then(console.log)
    }
}
