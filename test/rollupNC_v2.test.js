const {BigNumber, ContractFactory} = require("ethers");
const hre = require('hardhat')
const assert = require('assert');
const cls = require("circomlibjs");
// var RollupNC = artifacts.require("RollupNC");
// var TokenRegistry = artifacts.require("TokenRegistry")
// var TestToken = artifacts.require("TestToken")

/*
    Here we want to test the smart contract's deposit functionality.
                      O 
              O                 O
    O           O     O       O
  O       O   O   O O    O  O    O
      O  O O O O O O O 
*/


describe("RollupNC", () => {
    let accounts;
    let rollupNC;
    let tokenRegistry;
    let testToken;
    let mimc;
    let miMCMerkle;
    let leafNode1 = "18822210974461572787084328874970506324337552386873748437313431894257875892527"
    let leafNode3 = "18478211098575390970395583853915802009515002497061285726581588388081385468683"
    let leafNode5 = "6301740491468840608824416786238951322541867047870310345001644655350385598693"
    let leafNode7 = "16216986896739907889922474959427476644952847261532234586890412980086465204808"
    let first2Hash = "9575645077855908492647958726852672638044619506344865795285348485714968472489"
    let third2Hash = "13985626066863116037966374155234478824369255841473489468339194653638590644478"
    let first4Hash = "15746898236136636561403648879339919593421034102197162753778420002381731361410"

    before(async function () {
        accounts = await hre.ethers.getSigners()

        const SEED = "mimc";
        let abi = cls.mimc7Contract.abi
        let createCode = cls.mimc7Contract.createCode
        let factory = new ContractFactory(
            abi, createCode(SEED, 91), accounts[0]
        )
        mimc = await factory.deploy()

        factory = await ethers.getContractFactory("MiMCMerkle");
        miMCMerkle = await factory.deploy(mimc.address)
        await miMCMerkle.deployed()

        factory = await ethers.getContractFactory("TokenRegistry");
        tokenRegistry = await factory.deploy(accounts[0].address)
        await tokenRegistry.deployed()

        factory = await ethers.getContractFactory("RollupNCV2");
        rollupNC = await factory.deploy(mimc.address, miMCMerkle.address, tokenRegistry.address)
        await rollupNC.deployed()

        factory = await ethers.getContractFactory("TestToken");
        testToken = await factory.connect(accounts[3]).deploy()
        await testToken.deployed()
    });

    // ----------------------------------------------------------------------------------

    it("should set rollupNC address", async () => {
        let setRollupNC = await tokenRegistry.connect(accounts[0]).setRollupNC(rollupNC.address, { from: accounts[0].address });
        assert(setRollupNC, 'setRollupNC failed')
    });

    // ----------------------------------------------------------------------------------


    // const tokenContractAddr = "0xaD6D458402F60fD3Bd25163575031ACDce07538D"

    it("should register token", async () => {
        let registerToken = await rollupNC.connect(accounts[1]).registerToken(testToken.address, { from: accounts[1].address })
        assert(registerToken, "token registration failed");
    });

    // ----------------------------------------------------------------------------------

    it("should approve token", async () => {
        let approveToken = await rollupNC.connect(accounts[0]).approveToken(testToken.address, { from: accounts[0].address })
        assert(approveToken, "token registration failed");
	});

    // ----------------------------------------------------------------------------------
    it("should approve RollupNC on TestToken", async () => {
        let approveToken = await testToken.connect(accounts[3]).approve(
            rollupNC.address, 1700,
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

    it("should make first deposit", async () => {
        // zero leaf
        let deposit0 = await rollupNC.connect(accounts[0]).deposit([0, 0], 0, 0, { from: accounts[0].address })
        assert(deposit0, "deposit0 failed");

        leafNode1 = await rollupNC.pendingDeposits(0)
        console.log(leafNode1)
        await rollupNC.currentRoot().then(console.log)
	  });

    it("should process first deposit", async () => {
        let processDeposit
        let position = [
          0, 0, 0, 0
        ]
        let proof = [
          '18822210974461572787084328874970506324337552386873748437313431894257875892527',
          '13709419133780021201613586010693342878534544523459755321806052948713273869912',
          '10979797660762940206903140898034771814264102460382043487394926534432430816033',
          '4067275915489912528025923491934308489645306370025757488413758815967311850978',
        ]
        try {
            processDeposit = await rollupNC.connect(accounts[0]).processDeposits(
                position,
                proof,
                { from: accounts[0].address }
            )
        } catch (error){
            console.log('processDeposits revert reason', error)
        }
        assert(processDeposit, "processDeposit failed")
        await rollupNC.currentRoot().then(console.log)
    })

    it("should make second deposit", async () => {
        // operator account
        let deposit1 = await rollupNC.connect(accounts[0]).deposit(pubkeyCoordinator, 0, 0, { from: accounts[0].address })
        assert(deposit1, "deposit failed");

        await rollupNC.currentRoot().then(console.log)
    });

    it("should process second deposit", async () => {
        let processDeposit
        let position = [
          1, 0, 0, 0
        ]
        let proof = [
          leafNode1,
          '13709419133780021201613586010693342878534544523459755321806052948713273869912',
          '10979797660762940206903140898034771814264102460382043487394926534432430816033',
          '4067275915489912528025923491934308489645306370025757488413758815967311850978',
        ]
        try {
            processDeposit = await rollupNC.connect(accounts[0]).processDeposits(
                position,
                proof,
                { from: accounts[0].address }
            )
        } catch (error){
            console.log('processDeposits revert reason', error)
        }
        assert(processDeposit, "processDeposit failed")
        await rollupNC.currentRoot().then(console.log)
    })

    it("should make third deposit", async () => {
        // Alice account
        let deposit2 = await rollupNC.connect(accounts[3]).deposit(pubkeyA, 1000, 2, { from: accounts[3].address })
        assert(deposit2, "deposit2 failed");

        leafNode3 = await rollupNC.pendingDeposits(0)
        await rollupNC.currentRoot().then(console.log)
    });

    it("should process third deposit", async () => {
        let processDeposit
        let position = [
          0, 1, 0, 0
        ]
        let proof = [
          '18822210974461572787084328874970506324337552386873748437313431894257875892527',
          first2Hash,
          '10979797660762940206903140898034771814264102460382043487394926534432430816033',
          '4067275915489912528025923491934308489645306370025757488413758815967311850978',
        ]
        try {
            processDeposit = await rollupNC.connect(accounts[0]).processDeposits(
                position,
                proof,
                { from: accounts[0].address }
            )
        } catch (error){
            console.log('processDeposits revert reason', error)
        }
        assert(processDeposit, "processDeposit failed")
        await rollupNC.currentRoot().then(console.log)
    })

    it("should make forth deposit", async () => {
        // Bob account
        let deposit3 = await rollupNC.connect(accounts[2]).deposit(pubkeyB, 20, 1, { value: 20, from: accounts[2].address })
        assert(deposit3, "deposit3 failed");

        await rollupNC.currentRoot().then(console.log)
    });

    it("should process forth deposit", async () => {
        let processDeposit
        let position = [
          1, 1, 0, 0
        ]
        let proof= [
          leafNode3,
          first2Hash,
          '10979797660762940206903140898034771814264102460382043487394926534432430816033',
          '4067275915489912528025923491934308489645306370025757488413758815967311850978',
        ]
        try {
            processDeposit = await rollupNC.connect(accounts[0]).processDeposits(
                position,
                proof,
                { from: accounts[0].address }
            )
        } catch (error){
            console.log('processDeposits revert reason', error)
        }
        assert(processDeposit, "processDeposit failed")
        await rollupNC.currentRoot().then(console.log)
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

    it("should make fifth deposit", async () => {
        let deposit4 = await rollupNC.connect(accounts[3]).deposit(pubkeyC, 200, 2, { from: accounts[3].address })
        assert(deposit4, "deposit4 failed");

        leafNode5 = await rollupNC.pendingDeposits(0)
        await rollupNC.currentRoot().then(console.log)
    });

    it("should process fifth deposit", async () => {
      let position = [
        0, 0, 1, 0
      ]
      let proof = [
        '18822210974461572787084328874970506324337552386873748437313431894257875892527',
        '13709419133780021201613586010693342878534544523459755321806052948713273869912',
        first4Hash,
        '4067275915489912528025923491934308489645306370025757488413758815967311850978'
      ]
      let processDeposit = await rollupNC.connect(accounts[0]).processDeposits(
          position,
          proof,
          { from: accounts[0].address }
      )
      assert(processDeposit, "processDeposit failed")
      await rollupNC.currentRoot().then(console.log)
    })

    it("should make sixth deposit", async () => {
        let deposit5 = await rollupNC.connect(accounts[4]).deposit(pubkeyD, 100, 1, { value: 100, from: accounts[4].address })
        assert(deposit5, "deposit5 failed");
        await rollupNC.currentRoot().then(console.log)
    });

    it("should process sixth deposit", async () => {
      let position = [
        1, 0, 1, 0
      ]
      let proof = [
        leafNode5,
        '13709419133780021201613586010693342878534544523459755321806052948713273869912',
        first4Hash,
        '4067275915489912528025923491934308489645306370025757488413758815967311850978'
      ]
      let processDeposit = await rollupNC.connect(accounts[0]).processDeposits(
          position,
          proof,
          { from: accounts[0].address }
      )
      assert(processDeposit, "processDeposit failed")
      await rollupNC.currentRoot().then(console.log)
    })

    it("should make seventh deposit", async () => {
        let deposit6 = await rollupNC.connect(accounts[3]).deposit(pubkeyE, 500, 2, { from: accounts[3].address })
        assert(deposit6, "deposit6 failed");

        leafNode7 = await rollupNC.pendingDeposits(0)
        await rollupNC.currentRoot().then(console.log)
    });

    it("should process seventh deposit", async () => {
      let position = [
        0, 1, 1, 0
      ]
      let proof = [
        '18822210974461572787084328874970506324337552386873748437313431894257875892527',
        third2Hash,
        first4Hash,
        '4067275915489912528025923491934308489645306370025757488413758815967311850978'
      ]
      let processDeposit = await rollupNC.connect(accounts[0]).processDeposits(
          position,
          proof,
          { from: accounts[0].address }
      )
      assert(processDeposit, "processDeposit failed")
      await rollupNC.currentRoot().then(console.log)
    })

    it("should make eighth deposit", async () => {
        let deposit7 = await rollupNC.connect(accounts[6]).deposit(pubkeyF, 20, 1, { value: 20, from: accounts[6].address })
        assert(deposit7, "deposit7 failed");
        await rollupNC.currentRoot().then(console.log)
    });

    it("should process eighth deposit", async () => {
      let position = [
        1, 1, 1, 0
      ]
      let proof = [
        leafNode7,
        third2Hash,
        first4Hash,
        '4067275915489912528025923491934308489645306370025757488413758815967311850978'
      ]
      let processDeposit = await rollupNC.connect(accounts[0]).processDeposits(
          position,
          proof,
          { from: accounts[0].address }
      )
      assert(processDeposit, "processDeposit failed")
      await rollupNC.currentRoot().then(console.log)
    })


    // ----------------------------------------------------------------------------------
    const updateProof = require("../circuits/update_state_verifier_js/proof.json")
    const updateInput = require("../circuits/update_state_verifier_js/public.json")

    it("should accept valid state updates", async () => {
        let validStateUpdate = await rollupNC.updateState(
            updateProof, updateInput
        );
        assert(validStateUpdate, "invalid state transition");
        await rollupNC.currentRoot().then(console.log)

    });

    // ----------------------------------------------------------------------------------
    const pubkey_from = [
        "1490516688743074134051356933225925590384196958316705484247698997141718773914",
        "18202685495984068498143988518836859608946904107634495463490807754016543014696"
    ]
    const index = 4;
    const nonce = 0;
    const amount = 200;
    const token_type_from = 2;
    const position = [1, 0]
    const txRoot =
        "11104599065074864544861425585000276813461567861239463907298857663432015403888"
    const recipient = "0xC33Bdb8051D6d2002c0D80A1Dd23A1c9d9FC26E4"

    let withdraw_proof = require("../circuits/withdraw_signature_verifier_js/proof.json")

    // you can get this proof from input.json generated by generate_update_state_verifier.js
    // just remember the proof corresponds to position above
    const proof = [
        "923732209247106967839161264110052797174320966153955281208442788790069671618",
        "7964815910787619688596922151009426619451026939393880799897520778748707002824"
    ]

    it("should accept valid withdrawals", async () => {
        const txInfo = {
            pubkeyX: pubkey_from[0],
            pubkeyY: pubkey_from[1],
            index: index,
            toX: BigNumber.from(0),
            toY: BigNumber.from(0),
            nonce: BigNumber.from(nonce),
            amount: BigNumber.from(amount),
            token_type_from: BigNumber.from(token_type_from),
            txRoot: txRoot,
            position: position,
            proof: proof,
        }
        let validWithdraw = await rollupNC.connect(accounts[3]).withdraw(
            txInfo, recipient,
            withdraw_proof,
            {from: accounts[3].address}
        );
        assert(validWithdraw, "invalid withdraw");
    });
});
