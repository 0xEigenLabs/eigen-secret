import { SigningKey } from "../src/account";
import { ethers } from "ethers";
import { AccountCircuit } from "../src/account";
import { IStateTree, StateTreeCircuitInput } from "../src/state_tree";
const createBlakeHash = require("blake-hash");
const { buildEddsa, buildBabyJub } = require("circomlibjs");

export class StateTreeClient implements IStateTree {
    serverAddr: string;
    constructor(serverAddr: string) {
        this.serverAddr = serverAddr;
    }

    root(): any {
        //return this.tree.root;
        return "";
    }

    static get index(): bigint {
        //return BigInt("0x" + _randomBytes(32).toString("hex"))
        return 0n;
    }

    async find(_key: any) {
        return "";
    }

    async insert(_key: any, _value: any): Promise<StateTreeCircuitInput> {
        return Promise.reject(null);
        //return new StateTreeCircuitInput(this.tree, [1, 0], res, siblings, key, value);
    }
}

export class SecretSDK {
    alias: string;
    accountKey: SigningKey;
    signingKey: SigningKey;
    state: StateTreeClient;
    constructor(alias: string, accountKey: SigningKey, signingKey: SigningKey, serverAddr: string) {
        this.alias = alias;
        this.signingKey = signingKey;
        this.accountKey = accountKey;
        this.state = new StateTreeClient(serverAddr);
    }

    static async newSigningKey() {
        return await (new SigningKey()).newKey(undefined)
    }

    // create proof for general transaction
    deposit(sender: string, receiver: string, value: string, assetId: number) {

    }

    send(sender: string, receiver: string, value: string, assetId: number) {

    }

    withdraw(sender: string, receiver: string, value: string, assetId: number) {

    }

    // create proof for account operation, create, migrate or update
    async createAccount(newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let eddsa = await buildEddsa();
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
            aliasHash,
            this.state
        );
    }

    updateAccount(newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let proofId = AccountCircuit.PROOF_ID_TYPE_UPDATE;
    }

    migrateAccount(newAccountKey: SigningKey) {
        let proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;
    }
}
