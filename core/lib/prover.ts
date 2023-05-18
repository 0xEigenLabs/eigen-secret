import { pathJoin } from "./utils";
const fs = require("fs");
const snarkjs = require("snarkjs");
import axios from "axios";

function generateRandomVarName(prefix: string) {
    const randomString = Math.random().toString(36).substr(2, 8);
    return `${prefix}_${randomString}`;
}

async function loadScriptFromBlob(blob: Blob, globalVarName: string) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const url = URL.createObjectURL(blob);
        script.src = url;
        script.type = "text/javascript";
        script.onload = () => {
            URL.revokeObjectURL(url);
            resolve(window[(globalVarName as keyof Window)]);
        };
        script.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load the script"));
        };
        document.head.appendChild(script);
    });
}

export enum ProofState {
    NEW = 1,
    PROVED,
}

export class Prover {
    static serverAddr: string;
    static witnessCalculator: any;
    // static witnessCalculatorUpdateState: any;
    // static witnessCalculatorWithdraw: any;

    static async init() {
        const witnessCalculatorUrl = `${Prover.serverAddr}/public/main_update_state_js/witness_calculator.js`;
        // const witnessCalculatorUpdateStateUrl = `${Prover.serverAddr}/public/main_update_state_js/witness_calculator.js`;
        // const witnessCalculatorWithdrawUrl = `${Prover.serverAddr}/public/main_withdraw_js/witness_calculator.js`;

        if (!Prover.witnessCalculator) {
            Prover.witnessCalculator = await Prover.loadAndModifyWitnessCalculator(witnessCalculatorUrl);
        }
        // if (!Prover.witnessCalculatorUpdateState) {
        //     Prover.witnessCalculatorUpdateState = await Prover.loadAndModifyWitnessCalculator(witnessCalculatorUpdateStateUrl);
        // }
        // if (!Prover.witnessCalculatorWithdraw) {
        //     Prover.witnessCalculatorWithdraw = await Prover.loadAndModifyWitnessCalculator(witnessCalculatorWithdrawUrl);
        // }
    }

    static async loadAndModifyWitnessCalculator(url: string) {
        const { data: wcContent } = await axios.get(url, { responseType: "text" });

        const uniqueGlobalVarName = generateRandomVarName("witnessCalculatorModule");
        const modifiedWcContent = wcContent.replace(/module\.exports\s*=/, `window.${uniqueGlobalVarName} =`);
        const wcBlob = new Blob([modifiedWcContent], { type: "text/javascript" });

        return await loadScriptFromBlob(wcBlob, uniqueGlobalVarName);
    }

    static async fetchRemoteFile(url: string) {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        return response.data;
    }

    static async updateState(circuitPath: string, input: any) {
        if (typeof window !== "undefined") {
            return Prover.updateStateForClient(input);
        } else {
            return Prover.updateStateForBackend(circuitPath, input);
        }
    }

    static async verifyState(circuitPath: string, proofAndPublicSignals: any) {
        if (typeof window !== "undefined") {
            return Prover.verifyStateForClient(proofAndPublicSignals);
        } else {
            return Prover.verifyStateForBackend(circuitPath, proofAndPublicSignals);
        }
    }

    static async withdraw(circuitPath: string, input: any) {
        if (typeof window !== "undefined") {
            return Prover.withdrawForClient(input);
        } else {
            return Prover.withdrawForBackend(circuitPath, input);
        }
    }

    static async verifyWithrawal(circuitPath: string, proofAndPublicSignals: any) {
        if (typeof window !== "undefined") {
            return Prover.verifyWithdrawalForClient(proofAndPublicSignals);
        } else {
            return Prover.verifyWithdrawalForBackend(circuitPath, proofAndPublicSignals);
        }
    }

    static async updateStateForClient(input: any) {
        let wasmUrl = `${Prover.serverAddr}/public/main_update_state_js/main_update_state.wasm`;
        let zkeyUrl = `${Prover.serverAddr}/public/circuit_final.zkey.16`;

        const wasmBuffer = await Prover.fetchRemoteFile(wasmUrl);
        const witnessCalculator = await Prover.witnessCalculator(wasmBuffer);

        const witnessBuffer = await witnessCalculator.calculateWTNSBin(input, 0);
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyUrl, witnessBuffer);

        const proofAndPublicSignals = {
            proof,
            publicSignals
        };
        return proofAndPublicSignals;
    }

    static async verifyStateForClient(proofAndPublicSignals: any) {
        const proof = proofAndPublicSignals.proof;
        const publicSignals = proofAndPublicSignals.publicSignals;

        let zkeyUrl = `${Prover.serverAddr}/public/circuit_final.zkey.16`;

        const vKey = await snarkjs.zKey.exportVerificationKey(zkeyUrl);
        const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        return res;
    }

    static async withdrawForClient(input: any) {
        let wasmUrl = `${Prover.serverAddr}/public/main_withdraw_js/main_withdraw.wasm`;
        let zkeyUrl = `${Prover.serverAddr}/public/circuit_final.zkey.14`;

        const wasmBuffer = await Prover.fetchRemoteFile(wasmUrl);
        const witnessCalculator = await Prover.witnessCalculator(wasmBuffer);

        const witnessBuffer = await witnessCalculator.calculateWTNSBin(input, 0);

        const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyUrl, witnessBuffer);
        const proofAndPublicSignals = {
            proof,
            publicSignals
        };
        return proofAndPublicSignals;
    }

    static async verifyWithdrawalForClient(proofAndPublicSignals: any) {
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

    static async updateStateRemote(circuitPath: string, input: any) {
        var net = require('net');
        var client = new net.Socket();
        client.connect(3100, '127.0.0.1', function () {
            console.log('Connected');

            let req = {
                method: "prove",
                body: {
                    circuit_file: "../circuits/main_update_state_js/main_update_state.r1cs",
                    witness: "../circuits/main_update_state_js/witness.wtns",
                    srs_monomial_form: "/tmp/final.zkay.18",
                    srs_lagrange_form: "",
                    transcript: "keccak",
                    proof_bin: "/tmp/proof.bin",
                    proof_json: "/tmp/proof.json",
                    public_json: "/tmp/public.json",
                }
            }

            client.write(`${JSON.stringify(req)}\r\n`);
        });

        client.on('data', function (data) {
            console.log('Received: ' + data);
            client.destroy(); // kill client after server's response
        });

        client.on('close', function () {
            console.log('Connection closed');
        });

        // console.log("proof", proof, publicSignals)
        const proofAndPublicSignals = {
            proof: "",
            publicSignals: ""
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
        const wc = require(`${circuitPath}/main_update_state_js/witness_calculator`);
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
