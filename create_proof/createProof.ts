import { UpdateStatusInput } from "../src/update_state";
import { parseProof } from "../src/utils";
const path = require("path");
const fs = require("fs");
const snarkjs = require("snarkjs");

export class createProof{

    static async updateState(circuitPath: string, input: any, F: any) {
        let wasm = path.join(circuitPath, "main_update_state_js", "main_update_state.wasm");
        let zkey = path.join(circuitPath, "circuit_final.zkey");
        const wc = require(`${circuitPath}/main_update_state_js/witness_calculator`);
        const buffer = fs.readFileSync(wasm);
        const witnessCalculator = await wc(buffer);
    
        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
            input,
            0
        );
    
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, witnessBuffer);
        const proofAndPublicSignals = {
            proof,
            publicSignals
        };
        return proofAndPublicSignals;
    }

}