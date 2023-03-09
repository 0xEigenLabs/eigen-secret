// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;
import "./AccountVerifier.sol";

contract Account is Verifier {
    uint8 public constant PROOF_ID_TYPE_INVALID = 0;
    uint8 public constant PROOF_ID_TYPE_CREATE = 11;
    uint8 public constant PROOF_ID_TYPE_MIGRATE = 12;
    uint8 public constant PROOF_ID_TYPE_UPDATE = 13;

    constructor() {}
    mapping(uint256 => bool) public roots;
    mapping(uint256 => bool) public nullifierHashes;

    function create(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[8] memory input) public payable {
        uint256 proofId = input[0];
        uint256 nullifier1 = input[4];
        uint256 nullifier2 = input[5];
        uint256 dataTreeRoot = input[6];
        require(proofId == PROOF_ID_TYPE_CREATE, "Invalid proof id");

        require(!roots[dataTreeRoot], "The root is invalid");
        require(!nullifierHashes[nullifier1], "The account nullifier1 has been already used");
        require(!nullifierHashes[nullifier2], "The account nullifier2 has been already used");

        // verify the account migrate correctly
        require(verifyProof(a, b, c, input), "Invalid migrate account proof");

        //insert nullifier into nullifier tree
        roots[dataTreeRoot] = true;
        nullifierHashes[nullifier1] = true;
        nullifierHashes[nullifier2] = true;
    }

    function migrate(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[8] memory input) public payable {

        uint256 proofId = input[0];
        uint256 nullifier1 = input[4];
        uint256 nullifier2 = input[5];
        uint256 dataTreeRoot = input[6];
        require(proofId == PROOF_ID_TYPE_MIGRATE, "Invalid proof id");

        require(!roots[dataTreeRoot], "The root is invalid");
        require(nullifierHashes[nullifier1], "The account nullifier1(alias) does not exist");
        require(!nullifierHashes[nullifier2], "The account nullifier2 has been already used");
        require(verifyProof(a, b, c, input), "Invalid migrate account proof");

        //insert nullifier into nullifier tree
        roots[dataTreeRoot] = true;
        nullifierHashes[nullifier2] = true;
    }

    function update(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[8] memory input) public payable {

        uint256 proofId = input[0];
        uint256 nullifier1 = input[4];
        uint256 nullifier2 = input[5];
        uint256 dataTreeRoot = input[6];
        require(proofId == PROOF_ID_TYPE_UPDATE, "Invalid proof id");

        require(!roots[dataTreeRoot], "The root is invalid");
        require(nullifierHashes[nullifier1], "The account nullifier1 has been already used");
        require(nullifierHashes[nullifier2], "The account nullifier2 has been already used");
        require(verifyProof(a, b, c, input), "Invalid migrate account proof");

        //insert nullifier into nullifier tree
        roots[dataTreeRoot] = true;
    }
}
