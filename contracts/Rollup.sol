// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;
import "./UpdateStateVerifier.sol";
import "./WithdrawVerifier.sol";
import "./SMT.sol";
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

contract IPoseidon8 {
  function poseidon(uint256[8] memory) public pure returns(uint256) {}
}

contract Rollup is SMT {
    uint8 public constant PROOF_ID_TYPE_INVALID = 0;
    uint8 public constant PROOF_ID_TYPE_DEPOSIT = 1;
    uint8 public constant PROOF_ID_TYPE_WITHDRAW = 2;
    uint8 public constant PROOF_ID_TYPE_SEND = 3;

    IPoseidon2 public insPoseidon2;
    IPoseidon3 public insPoseidon3;
    IPoseidon8 public insPoseidon8;
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

    event RegisteredToken(uint publicAssetId, address tokenContract);
    event RequestDeposit(uint[2] pubkey, uint publicValue, uint publicAssetId);
    event UpdatedState(uint, uint, uint); //newRoot, txRoot, oldRoot
    event Withdraw(TxInfo, address);


    constructor(
        address _poseidon2ContractAddr,
        address _poseidon3ContractAddr,
        address _poseidon8ContractAddr,
        address _tokenRegistryAddr
    ) SMT(_poseidon2ContractAddr, _poseidon3ContractAddr) public {
        insPoseidon2 = IPoseidon2(_poseidon2ContractAddr);
        insPoseidon3 = IPoseidon3(_poseidon3ContractAddr);
        insPoseidon8 = IPoseidon8(_poseidon8ContractAddr);
        tokenRegistry = ITokenRegistry(_tokenRegistryAddr);
        coordinator = msg.sender;
        dataTreeRoot = 0;
        updateStateVerifier = new UpdateStateVerifier();
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

    // proof is siblings
    function processDeposits(
        uint[] memory keys,
        uint[] memory values,
        uint[][] memory proof
    ) public returns (uint) {
        require(keys.length == values.length, "Key and value must have same size");
        require(keys.length == proof.length, "Key and sibling must have same size");
        // TODO keys.length should less than or equal to queueNumber
        uint newRoot = dataTreeRoot;
        for (uint i = 0; i < keys.length; i ++) {
            Deposit memory deposit = pendingDeposits[0];
            // ensure the leaf is empty
            newRoot = smtVerifier(proof[i], keys[i], values[i], 0, 0, false, false, 20);
            require(
                nullifierRoots[newRoot] != true,
                "Invalid tex"
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

        require(!nullifierHashs[nullifier1], "Invalid nullifier1 when deposit");
        require(!nullifierHashs[nullifier2], "Invalid nullifier2 when deposit");
        require(!nullifierRoots[inDataTreeRoot], "Invalid data tree root");

        require(updateStateVerifier.verifyProof(a, b, c, input),
                "Invalid deposit proof");

        dataTreeRoot = inDataTreeRoot;
        nullifierRoots[inDataTreeRoot] = true;
        nullifierHashs[nullifier1] = true;
        nullifierHashs[nullifier2] = true;
        emit UpdatedState(inDataTreeRoot, nullifier1, nullifier2);
    }

    function withdraw(
        TxInfo memory txInfo,
        address payable recipient,
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c
    ) public{
        require(txInfo.fromAssetId > 0, "invalid tokenType");
        require(nullifierRoots[txInfo.txRoot], "txRoot does not exist");
        uint[8] memory txArray = [
            txInfo.pubkeyX,
            txInfo.pubkeyY,
            txInfo.index,
            txInfo.toX,
            txInfo.toY,
            txInfo.nonce,
            txInfo.amount,
            txInfo.fromAssetId
        ];

        // check if the leaf is in merkle tree
        uint leaf = insPoseidon8.poseidon(txArray);
        require(
            txInfo.txRoot == smtVerifier(txInfo.proof, leaf, 1, 0, 0, false, false, 20),
            "Invalid tex"
        );

        // message is hash of nonce and recipient address
        address tmp = recipient;
        uint[2] memory msgArray = [txInfo.nonce, uint256(uint160(tmp))];

        uint[3] memory input = [
            txInfo.pubkeyX,
            txInfo.pubkeyY,
            insPoseidon2.poseidon(msgArray)
        ];

        require(withdrawVerifier.verifyProof(a, b, c, input), "eddsa signature is not valid");

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
