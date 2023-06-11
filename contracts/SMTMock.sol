// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;
import "./SMT.sol";

contract SMTMock is SMT{
  function initializeSMT(
        address _poseidon2ContractAddr,
        address _poseidon3ContractAddr
    ) public initializer{
        SMT.initialize(_poseidon2ContractAddr, _poseidon3ContractAddr); 
    }
}