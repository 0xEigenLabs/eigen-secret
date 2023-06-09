// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract ModuleProxy {
    event NewImplementation(address oldImplementation, address newImplementation);
    event NewAdmin(address indexed newAdmin);

    address public implementation;
    address public admin;

    function setImplementation(address _imp) external {
        require(admin == msg.sender, "Only admin can setImplementation");
        address old = implementation;
        implementation = _imp;
        emit NewImplementation(old, implementation);
    }

    constructor(address _admin) {
        admin = _admin;
    }

    function setAdmin(address _admin) public {
        require(admin == msg.sender, "Only admin can setAdmin");
        admin = _admin;
        emit NewAdmin(admin);
    }

    function getImplementation() external view returns (address) {
        return implementation;
    }

    function _delegate(address _imp) internal virtual {
        assembly {
            // let ptr := mload(0x40)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), _imp, 0, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(0, 0, size)

            switch result
            case 0 { revert(0, size) }
            default { return(0, size) }
        }
    }

    fallback() external payable {
        require(implementation != address(0));
        _delegate(implementation);
    }
}
