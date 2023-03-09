// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;
import "./JoinSplitVerifier.sol";
import "./SMT.sol";

contract ITokenRegistry {
    address public coordinator;
    uint256 public numTokens;
    mapping(address => bool) public pendingTokens;
    mapping(uint256 => address) public registeredTokens;
    modifier onlyCoordinator(){
        assert (msg.sender == coordinator);
        _;
    }
    function registerToken(address tokenContract) public {}
    function approveToken(address tokenContract) public onlyCoordinator{}
}

contract IERC20 {
    function transferFrom(address from, address to, uint256 value) public returns(bool) {}
    function transfer(address recipient, uint value) public returns (bool) {}
    function balanceOf(address account) external view returns (uint256) {}
    function allowance(address owner, address spender) external view returns (uint256) {}
}

contract IPoseidon5 {
  function poseidon(uint256[5] memory) public pure returns(uint256) {}
}

contract Rollup {
    uint8 public constant PROOF_ID_TYPE_INVALID = 0;
    uint8 public constant PROOF_ID_TYPE_DEPOSIT = 1;
    uint8 public constant PROOF_ID_TYPE_WITHDRAW = 2;
    uint8 public constant PROOF_ID_TYPE_SEND = 3;

    IPoseidon5 public insPoseidon;
    ITokenRegistry public tokenRegistry;
    IERC20 public tokenContract;
    address public coordinator;

    struct Deposit{
        uint[2] publicOwner;
        uint publicAssetId;
        uint publicValue;
        uint nonce;
    }
    Deposit[] public pendingDeposits;
    uint public queueNumber;

    mapping(uint256 => bool) public nullifierHashs;

    uint256 public dataTreeRoot;

    JoinSplitVerifier joinSplitVerifier;
    WithdrawVerifier withdrawVerifier;

    SMT public smt;

    event RegisteredToken(uint publicAssetId, address tokenContract);
    event RequestDeposit(uint[2] pubkey, uint publicValue, uint publicAssetId);
    event UpdatedState(uint, uint, uint); //newRoot, txRoot, oldRoot
    event Withdraw(uint, uint);

    struct TxInfo {
        uint pubkeyX;
        uint pubkeyY;
        uint index;
        uint toX;
        uint toY;
        uint nonce;
        uint amount;
        uint fromAssetId;
        uint txRoot;
        uint[] proof;
    }

    constructor(
        address _poseidonContractAddr,
        address _tokenRegistryAddr
    ) public {
        insPoseidon = IPoseidon5(_poseidonContractAddr);
        tokenRegistry = ITokenRegistry(_tokenRegistryAddr);
        coordinator = msg.sender;
        dataTreeRoot = 0;
        joinSplitVerifier = new JoinSplitVerifier();
        smt = new SMT(_poseidonContractAddr);
    }

    modifier onlyCoordinator(){
        assert(msg.sender == coordinator);
        _;
    }

    function deposit(
        uint[2] memory pubkey,
        uint256 publicValue,
        uint256 publicAssetId,
        uint256 nonce
    ) public payable {
        if ( publicAssetId == 0 ) {
            require(
                msg.sender == coordinator,
                "publicAssetId 0 is reserved for coordinator");
                require(
                    publicValue == 0 && msg.value == 0,
                    "publicAssetId 0 does not have real value");
        } else if ( publicAssetId == 1 ) { // ETH
            require(
                msg.value > 0 && msg.value >= publicValue,
                "msg.value must at least equal stated publicValue in wei");
        } else if ( publicAssetId > 1 ) { // ERC20
            require(
                publicValue > 0,
                "token deposit must be greater than 0");
                address tokenContractAddress = tokenRegistry.registeredTokens(publicAssetId);
                tokenContract = IERC20(tokenContractAddress);
                require(
                    tokenContract.transferFrom(msg.sender, address(this), publicValue),
                    "token transfer not approved"
                );
        }

        pendingDeposits.push(Deposit(
            pubkey,
            publicAssetId,
            publicValue,
            nonce
        ));

        queueNumber++;

        emit RequestDeposit(pubkey, publicValue, publicAssetId);
    }

    function removeDeposit(uint index) internal returns(Deposit[] memory) {
        require(index < pendingDeposits.length, "index is out of bounds");

        for (uint i = index; i<pendingDeposits.length-1; i++){
            pendingDeposits[i] = pendingDeposits[i+1];
        }
        pendingDeposits.pop();
        queueNumber --;
        return pendingDeposits;
    }

    // proof is siblings
    function processDeposits(
        uint[] memory keys,
        uint[] memory values,
        uint[][] memory proof
    ) public returns (uint) {
        require(keys.length == values.length, "Key and value must have same size");
        require(keys.length == proof.length, "Key and sibling must have same size");
        // TODO keys.length should less than or equal to queueNumber
        for (uint i = 0; i < keys.length; i ++) {
            Deposit memory deposit = pendingDeposits[0];
            // ensure the leaf is empty
            require(
                !smtVerifier(dataTreeRoot, proof[i], keys[i], values[i], 0, 0, false, false, 20),
                "Invalid tex"
            );

            // update data tree root
            
        }
        return dataTreeRoot;
    }

    // TODO batchUpdate with aggregated proof
    function update(
        uint queueNumberEnd,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[8] memory input
    ) public payable {
        uint256 proofId = input[0];
        uint256 publicValue = input[1];
        uint256 publicOwner = input[2];
        uint256 numInputNotes = input[3];
        uint256 nullifier1 = input[4];
        uint256 nullifier2 = input[5];
        uint256 inDataTreeRoot = input[6];
        uint256 publicAssetId = input[7];

        require(!nullifierHashs[nullifier1], "Invalid nullifier1 when deposit");
        require(!nullifierHashs[nullifier2], "Invalid nullifier2 when deposit");

        uint i = 0;
        require(pendingDeposits.length > queueNumberEnd, "Invalid queueNumberEnd");
        for (; i < queueNumberEnd; i++) {
            processDeposits();
        }

        require(joinSplitVerifier.verifyProof(a, b, c, input),
                "Invalid deposit proof");

        dataTreeRoot = inDataTreeRoot;
        nullifierHashs[nullifier1] = true;
        nullifierHashs[nullifier2] = true;
        emit UpdatedState(inDataTreeRoot, nullifier1, nullifier2);
    }

    function withdraw(
        TxInfo memory txInfo,
        address payable recipient,
        uint[] memory proof
    ) public{
        require(txInfo.fromAssetId > 0, "invalid tokenType");
        require(updates[txInfo.txRoot] > 0, "txRoot does not exist");
        uint[] memory txArray = new uint[](8);
        txArray[0] = txInfo.pubkeyX;
        txArray[1] = txInfo.pubkeyY;
        txArray[2] = txInfo.index;
        txArray[3] = txInfo.toX;
        txArray[4] = txInfo.toY;
        txArray[5] = txInfo.nonce;
        txArray[6] = txInfo.amount;
        txArray[7] = txInfo.fromAssetId;

        // check if the leaf is in merkle tree
        uint leaf = insPoseidon.poseidon(txArray);
        require(
            smtVerifier(txInfo.root, txInfo.proof, leaf, 1, 0, 0, false, false, 20),
            "Invalid tex"
        );

        // message is hash of nonce and recipient address
        uint[] memory msgArray = new uint[](2);
        msgArray[0] = txInfo.nonce;
        address tmp = recipient;
        msgArray[1] = uint256(uint160(tmp));

        uint[] memory input = new uint[](3);
        input[0] = txInfo.pubkeyX;
        input[1] = txInfo.pubkeyY;
        input[2] = insPoseidon.poseidon(msgArray);

        require(withdrawVerifier.verify_serialized_proof(input, proof), "eddsa signature is not valid");

        // transfer token on tokenContract
        if (txInfo.fromAssetId == 1){
            // ETH
            recipient.transfer(txInfo.amount);
        } else {
            // ERC20
            address tokenContractAddress = tokenRegistry.registeredTokens(txInfo.fromAssetId);
            tokenContract = IERC20(tokenContractAddress);
            require(
                tokenContract.transfer(recipient, txInfo.amount),
                "transfer failed"
            );
        }

        emit Withdraw(txInfo, recipient);
    }

    function registerToken(
        address tokenContractAddress
    ) public {
        tokenRegistry.registerToken(tokenContractAddress);
    }

    function approveToken(
        address tokenContractAddress
    ) public onlyCoordinator {
        tokenRegistry.approveToken(tokenContractAddress);
        emit RegisteredToken(tokenRegistry.numTokens(),tokenContractAddress);
    }
}
