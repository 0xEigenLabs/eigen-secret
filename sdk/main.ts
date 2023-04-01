import { ethers } from "ethers";
import { StateTreeCircuitInput } from "../src/state_tree";
const createBlakeHash = require("blake-hash");
const { buildEddsa, buildBabyJub } = require("circomlibjs");
import { signEOASignature } from "../src/utils";
import { JoinSplitCircuit } from "../src/join_split";
import { UpdateStatusCircuit } from "../src/update_state";
import { Prover } from "../src/prover";
import { AccountCircuit, compress as accountCompress, EigenAddress, SigningKey, aliasHashDigest } from "../src/account";
const path = require("path");
const axios = require("axios").default;

export class StateTreeClient {
    serverAddr: any;

    constructor(serverAddr: string) {
        this.serverAddr = serverAddr;
    }

    async updateStateTree(
        context: any,
        outputNc1: bigint,
        nullifier1: bigint,
        outputNc2: bigint,
        nullifier2: bigint,
        acStateKey: bigint
    ) {
        const {
            alias,
            ethAddress,
            rawMessage,
            timestamp,
            signature
        } = context;

        let options = {
            method: "POST",
            url: this.serverAddr + "/statetree",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            data: {
                alias: alias,
                timestamp: timestamp,
                message: rawMessage,
                hexSignature: signature,
                ethAddress: ethAddress,
                newStates: [
                    outputNc1,
                    nullifier1,
                    outputNc2,
                    nullifier2,
                    acStateKey
                ]
            }
        };
        let response = await axios.request(options);
        console.log(response);
        return response.data.data;
    }
}

export class SecretSDK {
    alias: string;
    accountKey: SigningKey;
    signingKey: SigningKey;
    state: StateTreeClient;
    circuitPath: string;
    constructor(
        alias: string,
        accountKey: SigningKey,
        signingKey: SigningKey,
        serverAddr: string,
        circuitPath: string
    ) {
        this.alias = alias;
        this.signingKey = signingKey;
        this.accountKey = accountKey;
        this.state = new StateTreeClient(serverAddr);
        this.circuitPath = circuitPath;
    }

    static async newSigningKey() {
        return await (new SigningKey()).newKey(undefined)
    }

    // create proof for general transaction
    async deposit(ctx: any, receiver: string, value: string, assetId: number) {
        let eddsa = await buildEddsa();
        let F = eddsa.F;
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
        let accountRequired = false;
        const aliasHash = await aliasHashDigest(ctx.alias);
        const signer = accountRequired? ctx.signingKey: ctx.accountKey;
        const acStateKey = await accountCompress(eddsa, ctx.accountKey, signer, aliasHash);
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            ctx.accountKey,
            ctx.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            BigInt(value),
            ctx.signingKey.pubKey,
            BigInt(value),
            new EigenAddress(receiver),
            [],
            accountRequired
        );

        let proof: string[] = [];
        for (const input of inputs) {
            const proof = await this.state.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            console.log(proof);
            let circuitInput = input.toCircuitInput(eddsa.babyJub, proof);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput, F);
            proof.push(Prover.serialize(proofAndPublicSignals));
        }
        return proof;
    }

    async send(ctx: any, receiver: string, value: string, assetId: number) {
        let eddsa = await buildEddsa();
        let F = eddsa.F;
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_SEND;
        let accountRequired = false;
        const aliasHash = await aliasHashDigest(ctx.alias);
        const signer = accountRequired? ctx.signingKey: ctx.accountKey;
        const acStateKey = await accountCompress(eddsa, ctx.accountKey, signer, aliasHash);
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            ctx.accountKey,
            ctx.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            0,
            0n,
            undefined,
            BigInt(value),
            new EigenAddress(receiver),
            [],
            accountRequired
        );

        let proof: string[] = [];
        for (const input of inputs) {
            const proof = await this.state.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            console.log(proof);
            let circuitInput = input.toCircuitInput(eddsa.babyJub, proof);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput, F);
            proof.push(Prover.serialize(proofAndPublicSignals));
        }
        return proof;
    }

    async withdraw(ctx: any, receiver: string, value: string, assetId: number) {
        let eddsa = await buildEddsa();
        let F = eddsa.F;
        let proofId = JoinSplitCircuit.PROOF_ID_TYPE_WITHDRAW;
        let accountRequired = false;
        const aliasHash = await aliasHashDigest(ctx.alias);
        const signer = accountRequired? ctx.signingKey: ctx.accountKey;
        const acStateKey = await accountCompress(eddsa, ctx.accountKey, signer, aliasHash);
        let inputs = await UpdateStatusCircuit.createJoinSplitInput(
            ctx.accountKey,
            ctx.signingKey,
            acStateKey,
            proofId,
            aliasHash,
            assetId,
            assetId,
            BigInt(value),
            new EigenAddress(receiver),
            0n,
            ctx.accountKey.pubKey,
            [],
            accountRequired
        );

        let proof: string[] = [];
        for (const input of inputs) {
            const proof = await this.state.updateStateTree(
                ctx,
                input.outputNCs[0],
                input.outputNotes[0].inputNullifier,
                input.outputNCs[1],
                input.outputNotes[1].inputNullifier,
                acStateKey
            );
            console.log(proof);
            let circuitInput = input.toCircuitInput(eddsa.babyJub, proof);
            let proofAndPublicSignals = await Prover.updateState(this.circuitPath, circuitInput, F);
            proof.push(Prover.serialize(proofAndPublicSignals));
        }
        return proof;
    }

    // create proof for account operation, create, migrate or update
    async createAccount(ctx: any, newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
        const F = eddsa.F;
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
        let newAccountPubKey = this.accountKey.toCircuitInput(eddsa);
        let newSigningPubKey1 = newSigningKey.toCircuitInput(eddsa);
        let newSigningPubKey2 = newSigningKey2.toCircuitInput(eddsa);
        const aliasHash = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));

        let input = await AccountCircuit.createProofInput(
            proofId,
            this.accountKey,
            this.signingKey,
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            aliasHash
        );
        let smtProof = await this.state.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        let inputJoson = input.toCircuitInput(smtProof);

        // create final proof
        // let circuitPath = path.join(__dirname, "..", "circuits");
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, input, F);

        if (!Prover.verifyState(proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        return Prover.serialize(proofAndPublicSignals);
    }

    async updateAccount(ctx: any, newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
        const F = eddsa.F;
        let proofId = AccountCircuit.PROOF_ID_TYPE_UPDATE;
        let newAccountPubKey = this.accountKey.toCircuitInput(eddsa);
        let newSigningPubKey1 = newSigningKey.toCircuitInput(eddsa);
        let newSigningPubKey2 = newSigningKey2.toCircuitInput(eddsa);
        const aliasHash = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));

        let input = await AccountCircuit.createProofInput(
            proofId,
            this.accountKey,
            this.signingKey,
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            aliasHash
        );
        let smtProof = await this.state.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        let inputJoson = input.toCircuitInput(smtProof);

        // create final proof
        // let circuitPath = path.join(__dirname, "..", "circuits");
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, input, F);

        if (!Prover.verifyState(proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        return Prover.serialize(proofAndPublicSignals);
    }

    async migrateAccount(ctx: any, newAccountKey: SigningKey, oldSigningKey: SigningKey, oldSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
        const F = eddsa.F;
        let proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
        let newAccountPubKey = this.accountKey.toCircuitInput(eddsa);
        let newSigningPubKey1 = oldSigningKey.toCircuitInput(eddsa);
        let newSigningPubKey2 = oldSigningKey2.toCircuitInput(eddsa);
        const aliasHash = eddsa.pruneBuffer(createBlakeHash("blake512").update(this.alias).digest().slice(0, 32));

        let input = await AccountCircuit.createProofInput(
            proofId,
            this.accountKey,
            this.signingKey,
            newAccountPubKey[0],
            newSigningPubKey1[0],
            newSigningPubKey2[0],
            aliasHash
        );
        let smtProof = await this.state.updateStateTree(ctx, input.newAccountNC, 1n, 0n, 0n, input.accountNC);
        let inputJoson = input.toCircuitInput(smtProof);

        // create final proof
        // let circuitPath = path.join(__dirname, "..", "circuits");
        let proofAndPublicSignals = await Prover.updateState(this.circuitPath, input, F);

        if (!Prover.verifyState(proofAndPublicSignals)) {
            throw new Error("Invalid proof")
        }
        return Prover.serialize(proofAndPublicSignals);
    }
}
