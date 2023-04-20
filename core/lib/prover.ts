import axios from "axios";
const fs = require("fs");
const snarkjs = require("snarkjs");

export class Prover {
    static serverAddr: string;

    static async fetchRemoteFile(url: string) {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return response.data;
    }

    static async updateState(circuitPath: string, input: any) {
        let wasmUrl = `${Prover.serverAddr}/main_update_state_js/main_update_state.wasm`;
        let zkeyUrl = `${Prover.serverAddr}/circuit_final.zkey.16`;

        let wcUrl = `${Prover.serverAddr}/main_update_state_js/witness_calculator.js`;
        const { data: wcContent } = await axios.get(wcUrl, { responseType: 'text' });
        const wcBlob = new Blob([wcContent], { type: 'text/javascript' });
        const wcImportUrl = URL.createObjectURL(wcBlob);
        const { default: wc } = await import(wcImportUrl);
        URL.revokeObjectURL(wcImportUrl);

        const wasmBuffer = await Prover.fetchRemoteFile(wasmUrl);
        const witnessCalculator = await wc(wasmBuffer);

        // console.log("prover input", input);
        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
          input,
          0
        );

        const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyUrl, witnessBuffer);
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

        let zkeyUrl = `${circuitPath}/circuit_final.zkey.16`;

        const zkeyBuffer = await Prover.fetchRemoteFile(zkeyUrl);

        const vKey = await snarkjs.zKey.exportVerificationKey(zkeyBuffer);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        return res;
    }

    static async withdraw(circuitPath: string, input: any) {
        let wasmUrl = `${Prover.serverAddr}/main_withdraw_js/main_update_state.wasm`;
        let zkeyUrl = `${Prover.serverAddr}/circuit_final.zkey.14`;

        let wcUrl = `${Prover.serverAddr}/main_withdraw_js/witness_calculator.js`;
        const { data: wcContent } = await axios.get(wcUrl, { responseType: 'text' });
        const wcBlob = new Blob([wcContent], { type: 'text/javascript' });
        const wcImportUrl = URL.createObjectURL(wcBlob);
        const { default: wc } = await import(wcImportUrl);
        URL.revokeObjectURL(wcImportUrl);

        const wasmBuffer = await Prover.fetchRemoteFile(wasmUrl);
        const witnessCalculator = await wc(wasmBuffer);

        // console.log("withdraw prover input", input);
        const witnessBuffer = await witnessCalculator.calculateWTNSBin(
          input,
          0
        );

        const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyUrl, witnessBuffer);
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

        let zkeyUrl = `${Prover.serverAddr}/circuit_final.zkey.14`;

        const zkeyBuffer = await Prover.fetchRemoteFile(zkeyUrl);

        const vKey = await snarkjs.zKey.exportVerificationKey(zkeyBuffer);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        return res;
    }

    static serialize(proofAndPublicSignals: any) {
        return JSON.stringify(proofAndPublicSignals)
    }
}
