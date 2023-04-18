import {pathJoin} from "./utils";
const fs = require("fs");
const snarkjs = require("snarkjs");

export class Prover {
    static async updateState(circuitPath: string, input: any) {
        let wasm = pathJoin([circuitPath, "main_update_state_js", "main_update_state.wasm"]);
        let zkey = pathJoin([circuitPath, "circuit_final.zkey.16"]);
        const wc = require(`${circuitPath}/main_update_state_js/witness_calculator`);
        const buffer = fs.readFileSync(wasm);
        const witnessCalculator = await wc(buffer);

        // console.log("prover input", input);
        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
            input,
            0
        );

        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        // console.log("proof", proof, publicSignals)
        const proofAndPublicSignals = {
            proof,
            publicSignals
        };
        return proofAndPublicSignals;
    }

    static async verifyState(circuitPath: string, proofAndPublicSignals: any) {
        const proof = proofAndPublicSignals.proof;
        const publicSignals = proofAndPublicSignals.publicSignals;

        let zkey = pathJoin([circuitPath, "circuit_final.zkey.16"]);
        const vKey = await snarkjs.zKey.exportVerificationKey(zkey);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        return res;
    }

    static async withdraw(circuitPath: string, input: any) {
        let wasm = pathJoin([circuitPath, "main_withdraw_js", "main_withdraw.wasm"]);
        let zkey = pathJoin([circuitPath, "circuit_final.zkey.14"]);
        const wc = require(`${circuitPath}/main_withdraw_js/witness_calculator`);
        const buffer = fs.readFileSync(wasm);
        const witnessCalculator = await wc(buffer);

        // console.log("withdraw prover input", input);
        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
            input,
            0
        );

        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        // console.log("proof", proof, publicSignals)
        const proofAndPublicSignals = {
            proof,
            publicSignals
        };
        return proofAndPublicSignals;
    }

    static async verifyWithrawal(circuitPath: string, proofAndPublicSignals: any) {
        const proof = proofAndPublicSignals.proof;
        const publicSignals = proofAndPublicSignals.publicSignals;

        let zkey = pathJoin([circuitPath, "circuit_final.zkey.14"]);
        const vKey = await snarkjs.zKey.exportVerificationKey(zkey);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        return res;
    }

    static serialize(proofAndPublicSignals: any) {
        return JSON.stringify(proofAndPublicSignals)
    }
}
