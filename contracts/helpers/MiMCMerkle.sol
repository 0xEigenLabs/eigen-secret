// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract MiMC {

    function MiMCpe7(uint256,uint256) public pure returns(uint256) {}

}

contract MiMCMerkle{

    MiMC public mimc;
    uint public IV = 15021630795539610737508582392395901278341266317943626182700664337106830745361;
    // hashes for empty tree of depth 16
    uint[5] public zeroCache = [
        18822210974461572787084328874970506324337552386873748437313431894257875892527, //H0 = empty leaf
        13709419133780021201613586010693342878534544523459755321806052948713273869912,  //H1 = hash(H0, H0)
        10979797660762940206903140898034771814264102460382043487394926534432430816033,  //H2 = hash(H1, H1)
        4067275915489912528025923491934308489645306370025757488413758815967311850978, //...and so on
        19452855192846597539349825891822538438453868909233030566164911148476856805886
    ];

    constructor(
        address _mimcContractAddr
    ) public {
        mimc = MiMC(_mimcContractAddr);
    }

    function getRootFromProof(
        uint256 _leaf,
        uint256[] memory _position,
        uint256[] memory _proof
    ) public view returns(uint) {

        uint256[] memory root = new uint256[](_proof.length);

        // the following codes is used for the old multiHashMiMC
        // // if leaf is left sibling
        // if (_position[0] == 0){
        //     root[0] = mimc.MiMCpe7(mimc.MiMCpe7(r, _leaf), _proof[0]);
        // }
        // // if leaf is right sibling
        // else if (_position[0] == 1){
        //     root[0] = mimc.MiMCpe7(mimc.MiMCpe7(r, _proof[0]), _leaf);
        // }

        // for (uint i = 1; i < _proof.length; i++){
        //     // if leaf is left sibling
        //     if (_position[i] == 0){
        //         root[i] = mimc.MiMCpe7(mimc.MiMCpe7(r, root[i - 1]), _proof[i]);
        //     }
        //     // if leaf is right sibling
        //     else if (_position[i] == 1){
        //         root[i] = mimc.MiMCpe7(mimc.MiMCpe7(r, _proof[i]), root[i - 1]);
        //     }
        // }

        // if leaf is left sibling
        if (_position[0] == 0){
            root[0] = hashMiMC([_leaf, _proof[0]]);
        }
        // if leaf is right sibling
        else if (_position[0] == 1){
            root[0] = hashMiMC([_proof[0], _leaf]);
        }

        for (uint i = 1; i < _proof.length; i++){
            // if leaf is left sibling
            if (_position[i] == 0){
                root[i] = hashMiMC([root[i - 1], _proof[i]]);
            }
            // if leaf is right sibling
            else if (_position[i] == 1){
                root[i] = hashMiMC([_proof[i], root[i - 1]]);
            }
        }


        // return (_claimedRoot == root[root.length - 1]);
        return root[root.length - 1];

    }

    /*
    function hashMiMCOld(uint[] memory array) public view returns(uint){
        //[pubkey_x, pubkey_y, balance, nonce, token_type]
        uint r = IV;
        for (uint i = 0; i < array.length; i++){
            r = mimc.MiMCpe7(r, array[i]);
        }
        return r;
    }
    */

    function multiHashMiMC(uint[] memory array) public view returns (uint) {
        uint r = 0;
        // align with https://github.com/iden3/circomlibjs/blob/main/src/mimc7_gencontract.js#L30
        uint Fr = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001;
        for (uint i = 0; i < array.length; i++) {
            uint tmp = mimc.MiMCpe7(array[i], r);
            uint tmp2 = addmod(array[i], tmp, Fr);
            r = addmod(r, tmp2, Fr);
        }
        return r;
    }

    function hashMiMC(uint[2] memory array) public view returns (uint) {
        uint256[] memory input = new uint256[](2);
        input[0] = array[0];
        input[1] = array[1];
        return multiHashMiMC(input);
    }
}
