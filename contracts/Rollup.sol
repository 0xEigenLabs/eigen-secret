// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;
import "./UpdateStateVerifier.sol";
import "./WithdrawVerifier.sol";
import "./SMT.sol";
import "./libs/Poseidon.sol";
//import "hardhat/console.sol";

contract ITokenRegistry {
    address public coordinator;
    uint256 public numTokens;
    mapping(address => bool) public pendingTokens;
    mapping(uint256 => address) public registeredTokens;
    // TODO: should limit the ability of coordinator
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

contract IPoseidon2 {
  function poseidon(uint256[2] memory) public pure returns(uint256) {}
}

contract IPoseidon3 {
  function poseidon(uint256[3] memory) public pure returns(uint256) {}
}

contract Rollup is SMT {
    uint8 public constant PROOF_ID_TYPE_INVALID = 0;
    uint8 public constant PROOF_ID_TYPE_DEPOSIT = 1;
    uint8 public constant PROOF_ID_TYPE_WITHDRAW = 2;
    uint8 public constant PROOF_ID_TYPE_SEND = 3;

    IPoseidon2 public insPoseidon2;
    IPoseidon3 public insPoseidon3;
    //IPoseidon7 public insPoseidon7;
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
    mapping(uint256 => bool) public nullifierRoots;

    uint256 public dataTreeRoot;

    UpdateStateVerifier updateStateVerifier;
    WithdrawVerifier withdrawVerifier;

    struct TxInfo {
        uint publicValue;
        uint[2] publicOwner;
        uint outputNc1;
        uint outputNc2;
        uint publicAssetId;
        uint dataTreeRoot;
        uint[] roots;
        uint[] keys;
        uint[] values;
        uint[][] siblings;
    }

    event RegisteredToken(uint publicAssetId, address tokenContract);
    event RequestDeposit(uint[2] pubkey, uint publicValue, uint publicAssetId);
    event UpdatedState(uint, uint, uint); //newRoot, txRoot, oldRoot
    event Withdraw(TxInfo, address);

    event RollupInitialized(address initializer);
    
    constructor(){}

    function initialize(
        address _poseidon2ContractAddr,
        address _poseidon3ContractAddr,
        address _tokenRegistryAddr
    ) public initializer{
        emit RollupInitialized(msg.sender); 
        SMT.initialize(_poseidon2ContractAddr, _poseidon3ContractAddr); 
        insPoseidon2 = IPoseidon2(_poseidon2ContractAddr);
        insPoseidon3 = IPoseidon3(_poseidon3ContractAddr);
        tokenRegistry = ITokenRegistry(_tokenRegistryAddr);
        coordinator = msg.sender;
        dataTreeRoot = 0;
        updateStateVerifier = new UpdateStateVerifier();
        withdrawVerifier = new WithdrawVerifier();
    }

    modifier onlyCoordinator(){
        assert(msg.sender == coordinator);
        _;
    }

    function deposit(
        uint[2] memory pubkey,
        uint256 publicAssetId,
        uint256 publicValue,
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

    function processDeposits(
        uint[] memory keys,
        uint[] memory values,
        uint[][] memory siblings
    ) public returns (uint) {
        require(keys.length == values.length, "Key and value must have same size");
        require(keys.length == siblings.length, "Key and sibling must have same size");
        // TODO keys.length should less than or equal to queueNumber
        uint newRoot = dataTreeRoot;
        for (uint i = 0; i < keys.length; i ++) {
            Deposit memory deposit = pendingDeposits[0];
            // ensure the leaf is empty
            newRoot = smtVerifier(siblings[i], keys[i], values[i], 0, 0, false, false, 20);
            require(
                nullifierRoots[newRoot] != true,
                "Invalid nullifierRoot"
            );

            // update data tree root
            nullifierRoots[newRoot] = true;
        }
        dataTreeRoot = newRoot;
        return dataTreeRoot;
    }

    // TODO batchUpdate with aggregated proof
    function update(
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

        require(!nullifierRoots[inDataTreeRoot], "Invalid data tree root");
        require(!nullifierHashs[nullifier1], "Invalid nullifier1 when deposit");
        require(!nullifierHashs[nullifier2], "Invalid nullifier2 when deposit");

        require(updateStateVerifier.verifyProof(a, b, c, input),
                "Invalid deposit proof");

        dataTreeRoot = inDataTreeRoot;
        nullifierRoots[inDataTreeRoot] = true;
        emit UpdatedState(inDataTreeRoot, nullifier1, nullifier2);
    }

    //TODO: fixme double spent
    function withdraw(
        TxInfo memory txInfo,
        address payable recipient, // any address as receiver
        uint[2] memory a, // withdrawal proof
        uint[2][2] memory b,
        uint[2] memory c
    ) public{
        uint publicAssetId = txInfo.publicAssetId;
        uint inDataTreeRoot = txInfo.dataTreeRoot;

        uint rootsLength = txInfo.roots.length;
        uint[] memory messages = new uint[](6 + rootsLength);
        messages[0] = txInfo.publicValue;
        messages[1] = txInfo.publicOwner[0];
        messages[2] = txInfo.publicOwner[1];
        messages[3] = txInfo.outputNc1;
        messages[4] = txInfo.outputNc2;
        messages[5] = txInfo.publicAssetId;
        for (uint i = 0; i < rootsLength; i ++) {
            messages[6+i] = txInfo.roots[i];
        }
        uint msghash = SpongePoseidon.hash(messages);
        require(!nullifierHashs[txInfo.outputNc1], "Invalid nullifier1 when deposit");
        require(!nullifierHashs[txInfo.outputNc2], "Invalid nullifier2 when deposit");

        //Ax, Ay, M
        uint[3] memory input = [
            txInfo.publicOwner[0],
            txInfo.publicOwner[1],
            msghash
        ];

        require(publicAssetId > 0, "Invalid tokenType");
        require(nullifierRoots[inDataTreeRoot], "Invalid lastest data tree root");

        for (uint i = 0; i < txInfo.roots.length; i ++) {
            for (uint j = 0; j < 2; j ++) {
                require(nullifierRoots[txInfo.roots[i]], "Invalid data tree root");
                require(
                    txInfo.roots[i] == smtVerifier(txInfo.siblings[2*i+j], txInfo.keys[2*i+j], txInfo.values[2*i+j], 0, 0, false, false, 20),
                    "invalid merkle proof"
                );
            }
        }

        require(withdrawVerifier.verifyProof(a, b, c, input), "The eddsa signature is not valid");
        // transfer token on tokenContract
        if (publicAssetId == 1){
            // ETH
            recipient.transfer(txInfo.publicValue);
        } else {
            // ERC20
            address tokenContractAddress = tokenRegistry.registeredTokens(publicAssetId);
            tokenContract = IERC20(tokenContractAddress);
            require(
                tokenContract.transfer(recipient, txInfo.publicValue),
                "Transfer failed"
            );
        }
        nullifierHashs[txInfo.outputNc1] = true;
        nullifierHashs[txInfo.outputNc2] = true;

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

