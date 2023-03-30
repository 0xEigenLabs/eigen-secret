import { ethers } from "hardhat";
const {BigNumber, ContractFactory} = require("ethers");
const hre = require('hardhat')
import { expect, assert } from "chai";
const {buildEddsa} = require("circomlibjs");
const path = require("path");
const fs = require("fs");
const unstringifyBigInts = require("ffjavascript").utils.unstringifyBigInts;
import { uint8Array2Bigint, prepareJson, parseProof, Proof, signEOASignature } from "../src/utils";
import { deploySpongePoseidon, deployPoseidons, deployPoseidonFacade } from "./deploy_poseidons.util";
import { AccountCircuit, aliasHashDigest, compress as accountCompress, EigenAddress, SigningKey } from "../src/account";
import { JoinSplitCircuit } from "../src/join_split";
import { Prover } from "../src/prover";
import { Contract } from "ethers";
import { siblingsPad, WorldState } from "../src/state_tree";
const createBlakeHash = require("blake-hash");
import { UpdateStatusCircuit, UpdateStatusInput } from "../src/update_state";
import { NoteModel, NoteState, updateDBNotes, getDBNotes } from "../server/note";

/*
    Here we want to test the smart contract's deposit functionality.
*/
describe("Rollup Contract Test", () => {
    let EOAAccounts:any;
    let rollup:any;
    let tokenRegistry:any;
    let testToken:any;
    let factory: any;
    let spongePoseidon: Contract;
    let poseidonContracts: any;
    let eddsa: any;
    let F: any;
    let babyJub: any;

    let coordinator: SigningKey;
    let pubkeyCoordinator: bigint[];
    let coordinatorSigingKeys: bigint[][] = [];

    let eigenAccountKey: SigningKey[] = []; // n
    let pubkeyEigenAccountKey: bigint[][] = []; // 2n
    let eigenSigningKeys: SigningKey[][] = []; // 3n
    let pubkeyEigenSigningKeys: bigint[][][] = []; // 3n * 2

    const rawMessage = "Use Eigen Secret to shield your asset";
    const circuitPath = path.join(__dirname, "../circuits/");
    const alias = "contract.eigen.eth"
    let aliasHash: any;
    let createAccountFunc: any;
    let depositFunc: any;

    before(async function () {
        EOAAccounts = await hre.ethers.getSigners()
        eddsa = await buildEddsa();
        F = eddsa.F;
        babyJub = eddsa.babyJub;
        const aliasHashBuffer = eddsa.pruneBuffer(createBlakeHash("blake512").update(alias).digest().slice(0, 32));
        aliasHash = uint8Array2Bigint(aliasHashBuffer);

        //TODO: may not deploy all contract
        poseidonContracts = await deployPoseidons(
            (
                await ethers.getSigners()
            )[0],
            new Array(6).fill(6).map((_, i) => i + 1)
        );

        spongePoseidon = await deploySpongePoseidon(poseidonContracts[5].address);

        factory = await ethers.getContractFactory("TokenRegistry");
        tokenRegistry = await factory.deploy(EOAAccounts[0].address)
        await tokenRegistry.deployed()

        factory = await ethers.getContractFactory("Rollup");
        rollup = await factory.deploy(poseidonContracts[1].address, poseidonContracts[2].address,
            spongePoseidon.address, tokenRegistry.address);
        await rollup.deployed();
        console.log("rollup address:", rollup.address);

        factory = await ethers.getContractFactory("TestToken");
        testToken = await factory.connect(EOAAccounts[3]).deploy();
        await testToken.deployed();

        let coordinator = await (new SigningKey()).newKey(undefined);
        let tmpCoor = coordinator.pubKey.unpack(babyJub);
        pubkeyCoordinator = [F.toObject(tmpCoor[0]), F.toObject(tmpCoor[1])];
        tmpCoor = await (new SigningKey()).newKey(undefined);
        coordinatorSigingKeys.push([F.toObject(tmpCoor[0]), F.toObject(tmpCoor[1])]);
        tmpCoor = await (new SigningKey()).newKey(undefined);
        coordinatorSigingKeys.push([F.toObject(tmpCoor[0]), F.toObject(tmpCoor[1])]);
        tmpCoor = await (new SigningKey()).newKey(undefined);
        coordinatorSigingKeys.push([F.toObject(tmpCoor[0]), F.toObject(tmpCoor[1])]);

        for (var i = 0; i < 20; i ++) {
            let tmp = await (new SigningKey()).newKey(undefined);
            let tmpP = tmp.pubKey.unpack(babyJub);
            let tmpPub = [F.toObject(tmpP[0]), F.toObject(tmpP[1])];
            eigenAccountKey.push(tmp);
            pubkeyEigenAccountKey.push(tmpPub);

            let tmpSigningKeys = [];
            let tmpPubKeySigningKeys = [];

            tmpCoor = await (new SigningKey()).newKey(undefined);
            tmpSigningKeys.push(tmpCoor);
            tmpCoor = coordinator.pubKey.unpack(babyJub);
            tmpPubKeySigningKeys.push([F.toObject(tmpCoor[0]), F.toObject(tmpCoor[1])]);

            tmpCoor = await (new SigningKey()).newKey(undefined);
            tmpSigningKeys.push(tmpCoor);
            tmpCoor = coordinator.pubKey.unpack(babyJub);
            tmpPubKeySigningKeys.push([F.toObject(tmpCoor[0]), F.toObject(tmpCoor[1])]);

            tmpCoor = await (new SigningKey()).newKey(undefined);
            tmpSigningKeys.push(tmpCoor);
            tmpCoor = coordinator.pubKey.unpack(babyJub);
            tmpPubKeySigningKeys.push([F.toObject(tmpCoor[0]), F.toObject(tmpCoor[1])]);

            eigenSigningKeys.push(tmpSigningKeys);
            pubkeyEigenSigningKeys.push(tmpPubKeySigningKeys);
        }

        createAccountFunc = async (i: number) => {
            let proofId = AccountCircuit.PROOF_ID_TYPE_CREATE;
            let accountRequired = true;
            let input = await UpdateStatusCircuit.createAccountInput(
                proofId,
                eigenAccountKey[i],
                eigenSigningKeys[i][0],
                pubkeyEigenAccountKey[i],
                pubkeyEigenSigningKeys[i][1],
                pubkeyEigenSigningKeys[i][2],
                aliasHash,
            );
            let signer = accountRequired? eigenSigningKeys[i][0]: eigenAccountKey[i];
            let acStateKey = await accountCompress(eddsa, eigenAccountKey[i], signer, aliasHash);
            assert(input.newAccountNC == acStateKey, "Invalid accountNC");
            let singleProof = await WorldState.updateStateTree(acStateKey, 1n, 0n, 0n, acStateKey)
            let circuitInput = input.toCircuitInput(babyJub, singleProof);
            let proofAndPublicSignals = await Prover.updateState(circuitPath, circuitInput, F);
            return [proofAndPublicSignals, [acStateKey, 1]];
        }

        depositFunc = async (assetId: number, i: number, value: number, receiverI: number) => {
            let proofId = JoinSplitCircuit.PROOF_ID_TYPE_DEPOSIT;
            let accountRequired = false;
            let signer = accountRequired? eigenSigningKeys[i][0]: eigenAccountKey[i];
            let acStateKey = await accountCompress(eddsa, eigenAccountKey[i], signer, aliasHash);
            let notes = await getDBNotes(alias, [NoteState.CREATING, NoteState.PROVED]);
            let inputs = await UpdateStatusCircuit.createJoinSplitInput(
                eigenAccountKey[i],
                eigenSigningKeys[i][0],
                acStateKey,
                proofId,
                aliasHash,
                assetId,
                assetId,
                BigInt(value),
                eigenSigningKeys[i][0].pubKey,
                BigInt(value),
                eigenSigningKeys[receiverI][0].pubKey,
                notes,
                accountRequired
            );
            let proofAndPublicSignalsList = [];
            for (const input of inputs) {
                let input = await UpdateStatusCircuit.createAccountInput(
                    proofId,
                    eigenAccountKey[i],
                    eigenSigningKeys[i][0],
                    pubkeyEigenAccountKey[i],
                    pubkeyEigenSigningKeys[i][1],
                    pubkeyEigenSigningKeys[i][2],
                    aliasHash,
                );
                let signer = accountRequired? eigenSigningKeys[i][0]: eigenAccountKey[i];
                let acStateKey = await accountCompress(eddsa, eigenAccountKey[i], signer, aliasHash);
                assert(input.newAccountNC == acStateKey, "Invalid accountNC");
                let singleProof = await WorldState.updateStateTree(
                    input.outputNCs[0],
                    input.outputNotes[0].inputNullifier,
                    input.outputNCs[1],
                    input.outputNotes[1].inputNullifier,
                    acStateKey
                );

                let circuitInput = input.toCircuitInput(babyJub, singleProof);
                let proofAndPublicSignals = await Prover.updateState(circuitPath, circuitInput, F);
                proofAndPublicSignalsList.push([
                    proofAndPublicSignals,
                    [
                        input.outputNCs[0],
                        input.outputNotes[0].inputNullifier,
                        input.outputNCs[1],
                        input.outputNotes[1].inputNullifier,
                    ]
                ]);
            }
            return proofAndPublicSignalsList;
        }
    });

        it("should set rollup address", async () => {
            let setrollup = await tokenRegistry.connect(EOAAccounts[0]).setRollupNC(rollup.address);
            assert(setrollup, 'setRollupNC failed')
        });

        it("should register token", async () => {
            let registerToken = await rollup.connect(EOAAccounts[1]).registerToken(testToken.address, { from: EOAAccounts[1].address })
            assert(registerToken, "token registration failed");
        });

        it("should approve token", async () => {
            let approveToken = await rollup.connect(EOAAccounts[0]).approveToken(testToken.address, { from: EOAAccounts[0].address })
            assert(approveToken, "token registration failed");
        });

        it("should approve rollup on TestToken", async () => {
            let approveToken = await testToken.connect(EOAAccounts[3]).approve(
                rollup.address, 1700,
                {from: EOAAccounts[3].address}
            )
            assert(approveToken, "approveToken failed")
        });

        it("should make first batch of account creation", async () => {
            const value = ethers.utils.parseEther("100");

            let keys = [];
            // zero leaf
            let res = await createAccountFunc(0);
            keys.push(res[1][0]);
            let deposit0 = await rollup.connect(EOAAccounts[0]).deposit([0, 0], 0, 0, 0, { from: EOAAccounts[0].address })
            assert(deposit0, "deposit0 failed");

            // operator account
            let deposit1 = await rollup.connect(EOAAccounts[0]).deposit(pubkeyCoordinator, 0, 0, 0, { from: EOAAccounts[0].address })
            assert(deposit1, "deposit1 failed");

            // Alice account
            res = await createAccountFunc(1);
            keys.push(res[1][0]);
            let deposit2 = await rollup.connect(EOAAccounts[1]).deposit(pubkeyEigenAccountKey[1], 10, 1, 2, { value, from: EOAAccounts[1].address })
            assert(deposit2, "deposit2 failed");

            // Bob account
            res = await createAccountFunc(2);
            keys.push(res[1][0]);
            let deposit3 = await rollup.connect(EOAAccounts[2]).deposit(pubkeyEigenAccountKey[2], 20, 1, 1, { value, from: EOAAccounts[2].address })
            assert(deposit3, "deposit3 failed");

            let root = await rollup.dataTreeRoot();
            expect(root).to.eq(0n);
            let queueNumber = await rollup.queueNumber();
            expect(queueNumber).to.eq(4n);

            let keysFound = []
            let valuesFound = [];
            let siblings = [];
            let instance = await WorldState.getInstance();
            console.log("keys", keys);
            for (const key of keys) {
                keysFound.push(key);
                let value = await instance.find(key);
                assert(value.found);
                valuesFound.push(value.foundValue)
                siblings.push(siblingsPad(value.siblings, F));
            }

            let processDeposit1: any;
            // create 4 notes for above deposit.
            try {
                processDeposit1 = await rollup.connect(EOAAccounts[0]).processDeposits(
                    keysFound,
                    valuesFound,
                    siblings,
                    { from: EOAAccounts[0].address }
                )
            } catch (error){
                console.log('processDeposits revert reason', error)
            }
            assert(processDeposit1, "processDeposit1 failed")
            await rollup.dataTreeRoot().then(console.log)
        })

        // ----------------------------------------------------------------------------------

        it("should make second batch of deposits", async () => {
            const pubkeyC = pubkeyEigenAccountKey[3];
            const pubkeyD = pubkeyEigenAccountKey[4];
            const pubkeyE = pubkeyEigenAccountKey[5];
            const pubkeyF = pubkeyEigenAccountKey[6];

            const value = ethers.utils.parseEther("100");
            let keys = [];
            let res = await createAccountFunc(3);
            keys.push(res[1][0]);
            let deposit4 = await rollup.connect(EOAAccounts[3]).deposit(pubkeyC, 200, 1, 3, { value, from: EOAAccounts[3].address })
            assert(deposit4, "deposit4 failed");

            res = await createAccountFunc(4);
            keys.push(res[1][0]);
            let deposit5 = await rollup.connect(EOAAccounts[4]).deposit(pubkeyD, 100, 1, 4, { value, from: EOAAccounts[4].address })
            assert(deposit5, "deposit5 failed");

            res = await createAccountFunc(5);
            keys.push(res[1][0]);
            let deposit6 = await rollup.connect(EOAAccounts[3]).deposit(pubkeyE, 500, 1, 5, { value, from: EOAAccounts[3].address })
            assert(deposit6, "deposit6 failed");

            res = await createAccountFunc(6);
            keys.push(res[1][0]);
            let deposit7 = await rollup.connect(EOAAccounts[6]).deposit(pubkeyF, 20, 1, 6, { value, from: EOAAccounts[6].address })
            assert(deposit7, "deposit7 failed");
            await rollup.dataTreeRoot().then(console.log)
            let keysFound = []
            let valuesFound = [];
            let siblings = [];
            let instance = await WorldState.getInstance();
            for (const key of keys) {
                keysFound.push(key);
                let value = await instance.find(key);
                assert(value.found);
                valuesFound.push(value.foundValue)
                siblings.push(siblingsPad(value.siblings, F));
            }

            // create 4 notes for above deposit.
            let processDeposit2 = await rollup.connect(EOAAccounts[0]).processDeposits(
                keysFound,
                valuesFound,
                siblings,
                { from: EOAAccounts[0].address }
            )
            assert(processDeposit2, "processDeposit2 failed")
            await rollup.dataTreeRoot().then(console.log)
        });

        // ----------------------------------------------------------------------------------
        // const updateInputJson = path.join(__dirname, "..", "circuits/main_update_state_js/public.json");
        // const updateInput = JSON.parse(fs.readFileSync(updateInputJson, "utf8"));
        // const updateProof = require("../circuits/main_update_state_js/proof.json");

        // it("should accept valid state updates", async () => {
        //     const publicSignals = unstringifyBigInts(updateInput);
        //     console.log(publicSignals);
        //     const {a, b, c} = parseProof(updateProof)
        //     let validStateUpdate = await rollup.update(
        //         a , b, c, publicSignals
        //     );
        //     assert(validStateUpdate, "invalid state transition");
        //     // await rollup.currentRoot().then(console.log)
        // });

        // ----------------------------------------------------------------------------------
        // const pubkey_from = [
        //     "1490516688743074134051356933225925590384196958316705484247698997141718773914",
        //     "18202685495984068498143988518836859608946904107634495463490807754016543014696"
        // ]
        // const index = 4;
        // const nonce = 0;
        // const amount = 200;
        // const token_type_from = 2;
        // const position = [1, 0]
        // const txRoot =
        //     "11104599065074864544861425585000276813461567861239463907298857663432015403888"
        // const recipient = "0xC33Bdb8051D6d2002c0D80A1Dd23A1c9d9FC26E4"

        // let withdraw_proof = require("../circuits/withdraw_signature_verifier_js/proof.json")

        // // you can get this proof from input.json generated by generate_update_state_verifier.js
        // // just remember the proof corresponds to position above
        // const proof = [
        //     "923732209247106967839161264110052797174320966153955281208442788790069671618",
        //     "7964815910787619688596922151009426619451026939393880799897520778748707002824"
        // ]

        // it("should accept valid withdrawals", async () => {
        //     const txInfo = {
        //         pubkeyX: pubkey_from[0],
        //         pubkeyY: pubkey_from[1],
        //         index: index,
        //         toX: BigNumber.from(0),
        //         toY: BigNumber.from(0),
        //         nonce: BigNumber.from(nonce),
        //         amount: BigNumber.from(amount),
        //         token_type_from: BigNumber.from(token_type_from),
        //         txRoot: txRoot,
        //         position: position,
        //         proof: proof,
        //     }
        //     let validWithdraw = await rollup.connect(EOAAccounts[3]).withdraw(
        //         txInfo, recipient,
        //         withdraw_proof,
        //         {from: EOAAccounts[3].address}
        //     );
        //     assert(validWithdraw, "invalid withdraw");
        // });
});
