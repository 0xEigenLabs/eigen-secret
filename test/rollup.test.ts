import { ethers } from "hardhat";
const {BigNumber, ContractFactory} = require("ethers");
const hre = require('hardhat')
const assert = require('assert');
const cls = require("circomlibjs");
const path = require("path");
const fs = require("fs");
const unstringifyBigInts = require("ffjavascript").utils.unstringifyBigInts;
import { parseProof, Proof } from "../src/utils";
// var rollup = artifacts.require("rollup");
// var TokenRegistry = artifacts.require("TokenRegistry")
// var TestToken = artifacts.require("TestToken")

/*
    Here we want to test the smart contract's deposit functionality.
*/

describe.only("Rollup Contract Test", () => {
    let accounts:any;
    let rollup:any;
    let vv:any;
    let tokenRegistry:any;
    let testToken:any;
    let poseidonContract2Inputs: any;
    let poseidonContract3Inputs: any;
    let poseidonContract6Inputs: any;
    let poseidonContract8Inputs: any;
    let factory: any;
    let SpongePoseidonFactory:any;

    before(async function () {
        accounts = await hre.ethers.getSigners()
        console.log("hi")

        const CF1 = new ethers.ContractFactory(
            cls.poseidonContract.generateABI(2),
            cls.poseidonContract.createCode(2),
            accounts[0]
          );
        const CF2 = new ethers.ContractFactory(
            cls.poseidonContract.generateABI(3),
            cls.poseidonContract.createCode(3),
            accounts[0]
        );
        const CF3 = new ethers.ContractFactory(
            cls.poseidonContract.generateABI(6),
            cls.poseidonContract.createCode(6),
            accounts[0]
        );
        console.log("hihi")
        poseidonContract2Inputs = await CF1.deploy();
        console.log("poseidonContract2Inputs address:", poseidonContract2Inputs.address);
        poseidonContract3Inputs = await CF2.deploy();
        console.log("poseidonContract3Inputs address:", poseidonContract3Inputs.address);
        poseidonContract6Inputs = await CF3.deploy();
        console.log("poseidonContract6Inputs address:", poseidonContract6Inputs.address);
        SpongePoseidonFactory = await ethers.getContractFactory("SpongePoseidon", {
            libraries: {
              PoseidonUnit6L: poseidonContract6Inputs.address,
            },
          });
        poseidonContract8Inputs = await SpongePoseidonFactory.deploy();
        await poseidonContract8Inputs.deployed();
        console.log("poseidonContract8Inputs address:", poseidonContract8Inputs.address);

        factory = await ethers.getContractFactory("TokenRegistry");
        tokenRegistry = await factory.deploy(accounts[0].address)
        await tokenRegistry.deployed()

        factory = await ethers.getContractFactory("Verifier");
        vv = await factory.deploy()
        await vv.deployed()

        factory = await ethers.getContractFactory("Rollup");
        rollup = await factory.deploy(poseidonContract2Inputs.address, poseidonContract3Inputs.address, 
            poseidonContract8Inputs.address, tokenRegistry.address);
        await rollup.deployed();
        console.log("rollup address:", rollup.address);

        factory = await ethers.getContractFactory("TestToken");
        testToken = await factory.connect(accounts[3]).deploy();
        await testToken.deployed();
    });

    // ----------------------------------------------------------------------------------

    it("should set rollup address", async () => {
        let setrollup = await tokenRegistry.connect(accounts[0]).setRollupNC(rollup.address);
        assert(setrollup, 'setRollupNC failed')
    });

    // ----------------------------------------------------------------------------------


    // const tokenContractAddr = "0xaD6D458402F60fD3Bd25163575031ACDce07538D"

    it("should register token", async () => {
        let registerToken = await rollup.connect(accounts[1]).registerToken(testToken.address, { from: accounts[1].address })
        assert(registerToken, "token registration failed");
    });

    // ----------------------------------------------------------------------------------

    it("should approve token", async () => {
        let approveToken = await rollup.connect(accounts[0]).approveToken(testToken.address, { from: accounts[0].address })
        assert(approveToken, "token registration failed");
	});

    // ----------------------------------------------------------------------------------
    it("should approve rollup on TestToken", async () => {
        let approveToken = await testToken.connect(accounts[3]).approve(
            rollup.address, 1700,
            {from: accounts[3].address}
        )
        assert(approveToken, "approveToken failed")
    });

    // ----------------------------------------------------------------------------------

    const pubkeyCoordinator = [
        '1891156797631087029347893674931101305929404954783323547727418062433377377293',
        '14780632341277755899330141855966417738975199657954509255716508264496764475094'
    ]
    const pubkeyA = [
        '16854128582118251237945641311188171779416930415987436835484678881513179891664',
        '8120635095982066718009530894702312232514551832114947239433677844673807664026'
    ]
    const pubkeyB = [
        '17184842423611758403179882610130949267222244268337186431253958700190046948852',
        '14002865450927633564331372044902774664732662568242033105218094241542484073498'
    ]

    it("should make first batch of deposits", async () => {
        // zero leaf
        let deposit0 = await rollup.connect(accounts[0])
        deposit0.deposit([0, 0], 0, 0, { from: accounts[0].address })
        assert(deposit0, "deposit0 failed");

        // operator account
        let deposit1 = await rollup.connect(accounts[0])
        deposit1.deposit(pubkeyCoordinator, 0, 0, { from: accounts[0].address })
        assert(deposit1, "deposit1 failed");

        // Alice account
        let deposit2 = await rollup.connect(accounts[3])
        deposit2.deposit(pubkeyA, 1000, 2, { from: accounts[3].address })
        assert(deposit2, "deposit2 failed");

        // Bob account
        let deposit3 = await rollup.connect(accounts[2])
        deposit3.deposit(pubkeyB, 20, 1, { value: 20, from: accounts[2].address })
        assert(deposit3, "deposit3 failed");

        // await rollup.currentRoot().then(console.log)
	});

    // ----------------------------------------------------------------------------------

    // first4Hash is the pendingDeposits in sol
    const first4Hash = '15746898236136636561403648879339919593421034102197162753778420002381731361410';
    const first4HashPosition = [0, 0]
    const first4HashProof = [
        '10979797660762940206903140898034771814264102460382043487394926534432430816033',
        '4067275915489912528025923491934308489645306370025757488413758815967311850978'
    ]

    it("should process first batch of deposits", async () => {
        let processDeposit1
        try {
            processDeposit1 = await rollup.connect(accounts[0])
            processDeposit1.processDeposits(
                2,
                first4HashPosition,
                first4HashProof,
                { from: accounts[0].address }
            )
        } catch (error){
            console.log('processDeposits revert reason', error)
        }
        assert(processDeposit1, "processDeposit1 failed")
        // await rollup.currentRoot().then(console.log)
    })

    // ----------------------------------------------------------------------------------

    const pubkeyC = [
        '1490516688743074134051356933225925590384196958316705484247698997141718773914',
        '18202685495984068498143988518836859608946904107634495463490807754016543014696'
    ]
    const pubkeyD = [
        '605092525880098299702143583094084591591734458242948998084437633961875265263',
        '5467851481103094839636181114653589464420161012539785001778836081994475360535'
    ]
    const pubkeyE = [
        '6115308589625576351618964952901291926887010055096213039283160928208018634120',
        '7748831575696937538520365609095562313470874985327756362863958469935920020098'
    ]
    const pubkeyF = [
        '8497552053649025231196693001489376949137425670153512736866407813496427593491',
        '2919902478295208415664305012229488283720319044050523257046455410971412405951'
    ]

    it("should make second batch of deposits", async () => {
        let deposit4 = await rollup.connect(accounts[3])
        deposit4.deposit(pubkeyC, 200, 2, { from: accounts[3].address })
        assert(deposit4, "deposit4 failed");

        let deposit5 = await rollup.connect(accounts[4])
        deposit5.deposit(pubkeyD, 100, 1, { value: 100, from: accounts[4].address })
        assert(deposit5, "deposit5 failed");

        let deposit6 = await rollup.connect(accounts[3])
        deposit6.deposit(pubkeyE, 500, 2, { from: accounts[3].address })
        assert(deposit6, "deposit6 failed");

        let deposit7 = await rollup.connect(accounts[6])
        deposit7.deposit(pubkeyF, 20, 1, { value: 20, from: accounts[6].address })
        assert(deposit7, "deposit7 failed");
        // await rollup.currentRoot().then(console.log)
    });


    // ----------------------------------------------------------------------------------

    let second4HashPosition = [1, 0]
    let second4HashProof = [
        first4Hash,
        '4067275915489912528025923491934308489645306370025757488413758815967311850978'
    ]

    it("should process second batch of deposits", async () => {
        let processDeposit2 = await rollup.connect(accounts[0])
        processDeposit2.processDeposits(
            2,
            second4HashPosition,
            second4HashProof,
            { from: accounts[0].address }
        )
        assert(processDeposit2, "processDeposit2 failed")
        // await rollup.currentRoot().then(console.log)
    })

    // ----------------------------------------------------------------------------------
    const updateInputJson = path.join(__dirname, "..", "circuits/main_update_state_js/public.json");
    const updateInput = JSON.parse(fs.readFileSync(updateInputJson, "utf8"));
    const updateProof = require("../circuits/main_update_state_js/proof.json");

    it("should accept valid state updates", async () => {
        const publicSignals = unstringifyBigInts(updateInput);
        console.log(publicSignals);
        const {a, b, c} = parseProof(updateProof)
        let validStateUpdate = await rollup.update(
            a , b, c, publicSignals
        );
        assert(validStateUpdate, "invalid state transition");
        // await rollup.currentRoot().then(console.log)
    });

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
    //     let validWithdraw = await rollup.connect(accounts[3]).withdraw(
    //         txInfo, recipient,
    //         withdraw_proof,
    //         {from: accounts[3].address}
    //     );
    //     assert(validWithdraw, "invalid withdraw");
    // });
});