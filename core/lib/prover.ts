import { pathJoin } from "./utils";
const fs = require("fs");
const snarkjs = require("snarkjs");
import axios from "axios";

export class Prover {
    static serverAddr: string;

    static async fetchRemoteFile(url: string) {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        return response.data;
    }

    static async updateState(circuitPath: string, input: any) {
        if (typeof window !== "undefined") {
            return Prover.updateStateForClient(circuitPath, input);
        } else {
            return Prover.updateStateForBackend(circuitPath, input);
        }
    }

    static async verifyState(circuitPath: string, proofAndPublicSignals: any) {
        if (typeof window !== "undefined") {
            return Prover.verifyStateForClient(circuitPath, proofAndPublicSignals);
        } else {
            return Prover.verifyStateForBackend(circuitPath, proofAndPublicSignals);
        }
    }

    static async withdraw(circuitPath: string, input: any) {
        if (typeof window !== "undefined") {
            return Prover.withdrawForClient(circuitPath, input);
        } else {
            return Prover.withdrawForBackend(circuitPath, input);
        }
    }

    static async verifyWithrawal(circuitPath: string, proofAndPublicSignals: any) {
        if (typeof window !== "undefined") {
            return Prover.verifyWithdrawalForClient(circuitPath, proofAndPublicSignals);
        } else {
            return Prover.verifyWithdrawalForBackend(circuitPath, proofAndPublicSignals);
        }
    }

    static async updateStateForClient(circuitPath: string, input: any) {
        let wasmUrl = `${Prover.serverAddr}/public/main_update_state_js/main_update_state.wasm`;
        let zkeyUrl = `${Prover.serverAddr}/public/circuit_final.zkey.16`;

        let wcUrl = `${Prover.serverAddr}/public/main_update_state_js/witness_calculator.js`;
        const { data: wcContent } = await axios.get(wcUrl, { responseType: "text" });
        const wcBlob = new Blob([wcContent], { type: "text/javascript" });
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

    static async verifyStateForClient(circuitPath: string, proofAndPublicSignals: any) {
        const proof = proofAndPublicSignals.proof;
        const publicSignals = proofAndPublicSignals.publicSignals;

        let zkeyUrl = `${Prover.serverAddr}/public/circuit_final.zkey.16`;

        const zkeyBuffer = await Prover.fetchRemoteFile(zkeyUrl);

        const vKey = await snarkjs.zKey.exportVerificationKey(zkeyBuffer);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        return res;
    }

    static async withdrawForClient(circuitPath: string, input: any) {
        let wasmUrl = `${Prover.serverAddr}/public/main_withdraw_js/main_update_state.wasm`;
        let zkeyUrl = `${Prover.serverAddr}/public/circuit_final.zkey.14`;

        let wcUrl = `${Prover.serverAddr}/public/main_withdraw_js/witness_calculator.js`;
        const { data: wcContent } = await axios.get(wcUrl, { responseType: "text" });
        const wcBlob = new Blob([wcContent], { type: "text/javascript" });
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

    static async verifyWithdrawalForClient(circuitPath: string, proofAndPublicSignals: any) {
        const proof = proofAndPublicSignals.proof;
        const publicSignals = proofAndPublicSignals.publicSignals;

        let zkeyUrl = `${Prover.serverAddr}/public/circuit_final.zkey.14`;

        const zkeyBuffer = await Prover.fetchRemoteFile(zkeyUrl);

        const vKey = await snarkjs.zKey.exportVerificationKey(zkeyBuffer);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        return res;
    }

    static async updateStateForBackend(circuitPath: string, input: any) {
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

    static async verifyStateForBackend(circuitPath: string, proofAndPublicSignals: any) {
        const proof = proofAndPublicSignals.proof;
        const publicSignals = proofAndPublicSignals.publicSignals;

        let zkey = pathJoin([circuitPath, "circuit_final.zkey.16"]);
        const vKey = await snarkjs.zKey.exportVerificationKey(zkey);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        return res;
    }

    static async withdrawForBackend(circuitPath: string, input: any) {
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

    static async verifyWithdrawalForBackend(circuitPath: string, proofAndPublicSignals: any) {
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
