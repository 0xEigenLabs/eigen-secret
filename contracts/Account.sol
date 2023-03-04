// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.16;
import "./AccountVerifier.sol";
import "./SMT.sol";

contract Account is Verifier {
    constructor() {}
    mapping(uint256 => bool) public roots;
    mapping(uint256 => bool) public nullifierHashes;

    function migrate(
        uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[7] memory input) public payable {
        uint256 proofId = input[0];
        uint256 nullifier1 = input[4];
        uint256 nullifier2 = input[5];
        uint256 dataTreeRoot = input[6];

        require(!roots[dataTreeRoot], "The root is invalid");
        require(!nullifierHashes[nullifier1], "The account nullifier1 has been already used");
        require(!nullifierHashes[nullifier2], "The account nullifier2 has been already used");
        require(verifyProof(a, b, c, input), "Invalid migrate account proof");

        //insert nullifier into nullifier tree
        roots[dataTreeRoot] = true;
        nullifierHashes[nullifier1] = true;
        nullifierHashes[nullifier2] = true;
    }
}
