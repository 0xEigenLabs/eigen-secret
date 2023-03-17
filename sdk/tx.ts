import { SigningKey } from "../src/account";
import { ethers } from "ethers";
import { AccountCircuit } from "../src/account";
const { buildEddsa, buildBabyJub } = require("circomlibjs");

export class SecretSDK {
    alias: string;
    accountKey: SigningKey;
    signingKey: SigningKey;
    constructor(alias: string, accountKey: SigningKey, signingKey: SigningKey) {
        this.alias = alias;
        this.signingKey = signingKey;
        this.accountKey = accountKey;
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
    createAccount(newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
    }

    updateAccount(newSigningKey: SigningKey, newSigningKey2: SigningKey) {
        let proofId = AccountCircuit.PROOF_ID_TYPE_UPDATE;

    }

    migrateAccount(newAccountKey: SigningKey) {
        let proofId = AccountCircuit.PROOF_ID_TYPE_MIGRATE;

    }
}
