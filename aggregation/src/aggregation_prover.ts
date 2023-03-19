import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
const { expect } = require("chai");
const { ethers } = require("hardhat");

const bigPower = 23;
const power = 18;
const numInputs = 8;

const circuitsDir = path.join(__dirname, '..', '../circuits');
console.log(circuitsDir);
const curDir = path.join(__dirname, '..');
console.log(curDir);
const circuit = 'main_update_state';
const workspace = path.resolve(os.tmpdir(), 'aggregation');
console.log(workspace);
try {
  fs.rmdirSync(workspace, { recursive: true });
} catch (err: any) {
  if (err.code !== 'ENOENT') {
    console.error(err);
  }
}
fs.mkdirSync(workspace, { recursive: true });

const srs = path.join(__dirname, '..', `keys/setup_2^${power}.key`);
const bigSrs = path.join(__dirname, '..', `keys/setup_2^${bigPower}.key`);

const execAsync = promisify(exec);

export class aggregation_Prover {
    static async compileCircuit(): Promise<void> {
        await execAsync(`zkit compile -i ${circuitsDir}/${circuit}.circom --O2=full -o ${workspace}`);
    }

    static async exportVerificationKey(): Promise<void> {
        await execAsync(`zkit export_verification_key -s ${srs} -c ${workspace}/${circuit}.r1cs -v ${workspace}/vk.bin`);
    }

    static async generateEachProof(): Promise<void> {
        const inputDir = path.join(__dirname, "..", "input");
        const inputDirs = fs.readdirSync(inputDir);
        for (const input of inputDirs) {
          const inputPath = path.join(inputDir, input);
          const generateWitnessCmd = `node ${workspace}/${circuit}_js/generate_witness.js ${workspace}/${circuit}_js/${circuit}.wasm ${inputPath}/input.json ${inputPath}/witness.wtns`;
          await execAsync(generateWitnessCmd);
          const proveCmd = `zkit prove -c ${workspace}/${circuit}.r1cs -w ${inputPath}/witness.wtns -b ${inputPath}/proof.bin -s ${srs} -j ${inputPath}/proof.json -t rescue`;
          await execAsync(proveCmd);
          const verifyCmd = `zkit verify -p ${inputPath}/proof.bin -v ${workspace}/vk.bin -t rescue`;
          await execAsync(verifyCmd);
        }
    }

    static async exportAggregationVk(): Promise<void> {
        const inputDir = path.join(__dirname, "..", "input");
        const inputDirs = fs.readdirSync(inputDir);
        const oldProofList = path.join(workspace, 'old_proof_list.txt');
        fs.writeFileSync(oldProofList, '');
        let i = 0;
        for (const input of inputDirs) {
            const inputPath = path.join(__dirname, '../input', input);
            const proofBinPath = path.join(inputPath, 'proof.bin');
            fs.appendFileSync(oldProofList, `${proofBinPath}\n`);
            i++;
        }
        await execAsync(`zkit export_aggregation_verification_key -c ${i} -i ${numInputs} -s ${bigSrs} -v ${workspace}/aggregation_vk.bin`);
    }

    static async generateAggregationProof(): Promise<void> {
        const oldProofList = path.join(workspace, 'old_proof_list.txt');
        const aggregationProofPath = path.join(workspace, 'aggregation_proof.bin');
        const aggregationProofJsonPath = path.join(workspace, 'aggregation_proof.json');
        const generateAggregationProofCmd = `zkit aggregation_prove -s ${bigSrs} -f ${oldProofList} -v ${workspace}/vk.bin -n ${aggregationProofPath} -j ${aggregationProofJsonPath}`;
        await execAsync(generateAggregationProofCmd);      
    }

    static async verify(): Promise<void> {
        const aggregationProofPath = path.join(workspace, 'aggregation_proof.bin');
        const aggregationVerifyCmd = `zkit aggregation_verify -p ${aggregationProofPath} -v ${workspace}/aggregation_vk.bin`;
        await execAsync(aggregationVerifyCmd);
    }

    static async generateVerifier(): Promise<void> {
        const generateAggregationVerifierCmd = `zkit generate_aggregation_verifier -o ${workspace}/vk.bin -n ${workspace}/aggregation_vk.bin -i ${numInputs} -s ${curDir}/contracts/verifier.sol`;
        await execAsync(generateAggregationVerifierCmd);
    }

    static async runVerifierTest(): Promise<void> {
        const verifierFactory = await ethers.getContractFactory("KeysWithPlonkVerifier");
        const verifier = await verifierFactory.deploy();
        await verifier.deployed();
        const aggregationProofJsonPath = path.join(workspace, 'aggregation_proof.json');
        const proof = require(aggregationProofJsonPath);
        expect(await verifier.verifyAggregatedProof(
            proof[0],
            proof[1],
            proof[2],
            proof[3],
            proof[4],
        )).to.equal(true);
    }
}