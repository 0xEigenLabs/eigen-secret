const {waffle, ethers} = require("hardhat");
//import { ContractFactory, BigNumber} from "ethers";
const hre = require('hardhat')
const assert = require('assert');
const cls = require("circomlibjs");
const fs = require("fs");

import { SigningKey } from "@eigen-secret/core/dist/account";
import { genTempMain } from "./test";
import * as utils from "@eigen-secret/core/dist/utils";

describe("Test withdraw", async() => {
    let eddsa: any;
    let circuit: any;
    let poseidon: any;

    before(async function () {
        eddsa = await cls.buildEddsa();
        circuit = await genTempMain("node_modules/circomlib/circuits/eddsaposeidon.circom",
            "EdDSAPoseidonVerifier", "Ax, Ay, M", "", {});
        poseidon = await cls.buildPoseidon();
    });


    it("should generate withdraw proof and verify", async () => {
        // mock the account and transaction data
        // generate 8 accounts
        let F = poseidon.F

        let signingKey = new SigningKey(eddsa);
        let rawMsg = F.e(11);

        var msg = poseidon([rawMsg])

        let signature = await signingKey.sign(msg);
        let xy = signingKey.pubKey.unpack(eddsa.babyJub);

        let input = {
            enabled: 1,
            R8x: F.toObject(signature.R8[0]),
            R8y: F.toObject(signature.R8[1]),
            S: signature.S,
            Ax: F.toObject(xy[0]),
            Ay: F.toObject(xy[1]),
            M: F.toObject(msg),
        };

        fs.writeFileSync("./circuits/main_withdraw.input.json", JSON.stringify(input))

        await utils.executeCircuit(circuit, input);
    });
})
