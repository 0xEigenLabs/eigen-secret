import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
const { expect } = require("chai");
const { ethers } = require("hardhat");

export class AggregationProver {
    bigPower: number = 23;
    power: number = 18;
    numInputs: number = 8;
    circuitsDir: string;
    curDir: string;
    circuit: string = 'main_update_state';
    workspace: string;
    srs: string;
    bigSrs: string;
    execAsync: (command: string) => Promise<{ stdout: string, stderr: string }> = promisify(exec);

    constructor() {
        this.circuitsDir = path.join(__dirname, '..', '../circuits');
        console.log(this.circuitsDir);
        this.curDir = path.join(__dirname, '..');
        console.log(this.curDir);
        this.workspace = path.resolve(os.tmpdir(), 'aggregation');
        console.log(this.workspace);
        try {
        fs.rmdirSync(this.workspace, { recursive: true });
        } catch (err: any) {
        if (err.code !== 'ENOENT') {
            console.error(err);
        }
        }
        fs.mkdirSync(this.workspace, { recursive: true });
        this.srs = path.join(__dirname, '..', `keys/setup_2^${this.power}.key`);
        this.bigSrs = path.join(__dirname, '..', `keys/setup_2^${this.bigPower}.key`);
        this.execAsync = promisify(exec);
    }

    async compileCircuit() {
        await this.execAsync(`zkit compile -i ${this.circuitsDir}/${this.circuit}.circom --O2=full -o ${this.workspace}`);
    }

    async exportVerificationKey() {
        await this.execAsync(`zkit export_verification_key -s ${this.srs} -c ${this.workspace}/${this.circuit}.r1cs -v ${this.workspace}/vk.bin`);
    }

    async generateEachProof() {
        const inputDir = path.join(__dirname, "..", "input");
        const inputDirs = fs.readdirSync(inputDir).filter(name => !name.startsWith('.'));
        for (const input of inputDirs) {
          const inputPath = path.join(inputDir, input);
          const generateWitnessCmd = `node ${this.workspace}/${this.circuit}_js/generate_witness.js ${this.workspace}/${this.circuit}_js/${this.circuit}.wasm ${inputPath}/input.json ${inputPath}/witness.wtns`;
          await this.execAsync(generateWitnessCmd);
          const proveCmd = `zkit prove -c ${this.workspace}/${this.circuit}.r1cs -w ${inputPath}/witness.wtns -b ${inputPath}/proof.bin -s ${this.srs} -j ${inputPath}/proof.json -t rescue`;
          await this.execAsync(proveCmd);
          const verifyCmd = `zkit verify -p ${inputPath}/proof.bin -v ${this.workspace}/vk.bin -t rescue`;
          await this.execAsync(verifyCmd);
        }
    }

    async exportAggregationVk() {
        const inputDir = path.join(__dirname, "..", "input");
        const inputDirs = fs.readdirSync(inputDir).filter(name => !name.startsWith('.'));
        const oldProofList = path.join(this.workspace, 'old_proof_list.txt');
        fs.writeFileSync(oldProofList, '');
        let i = 0;
        for (const input of inputDirs) {
            const inputPath = path.join(__dirname, '../input', input);
            const proofBinPath = path.join(inputPath, 'proof.bin');
            fs.appendFileSync(oldProofList, `${proofBinPath}\n`);
            i++;
        }
        await this.execAsync(`zkit export_aggregation_verification_key -c ${i} -i ${this.numInputs} -s ${this.bigSrs} -v ${this.workspace}/aggregation_vk.bin`);
    }

    async generateAggregationProof() {
        const oldProofList = path.join(this.workspace, 'old_proof_list.txt');
        const aggregationProofPath = path.join(this.workspace, 'aggregation_proof.bin');
        const aggregationProofJsonPath = path.join(this.workspace, 'aggregation_proof.json');
        const generateAggregationProofCmd = `zkit aggregation_prove -s ${this.bigSrs} -f ${oldProofList} -v ${this.workspace}/vk.bin -n ${aggregationProofPath} -j ${aggregationProofJsonPath}`;
        await this.execAsync(generateAggregationProofCmd);      
    }

    async verify() {
        const aggregationProofPath = path.join(this.workspace, 'aggregation_proof.bin');
        const aggregationVerifyCmd = `zkit aggregation_verify -p ${aggregationProofPath} -v ${this.workspace}/aggregation_vk.bin`;
        await this.execAsync(aggregationVerifyCmd);
    }

    async generateVerifier() {
        const generateAggregationVerifierCmd = `zkit generate_aggregation_verifier -o ${this.workspace}/vk.bin -n ${this.workspace}/aggregation_vk.bin -i ${this.numInputs} -s ${this.curDir}/contracts/verifier.sol`;
        await this.execAsync(generateAggregationVerifierCmd);
    }

    async runVerifierTest() {
        const verifierFactory = await ethers.getContractFactory("KeysWithPlonkVerifier");
        const verifier = await verifierFactory.deploy();
        await verifier.deployed();
        const aggregationProofJsonPath = path.join(this.workspace, 'aggregation_proof.json');
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