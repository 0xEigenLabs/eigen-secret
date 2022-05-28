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
        7244400317647726759212845837151908248512761968909835817352420904037607768269, //H0 = empty leaf
        5388640756345848889762884810438895796735816700292928499337806143458473952712,  //H1 = hash(H0, H0)
        19642209756261147487299395139138750018042610884404237622752434560230554958919,  //H2 = hash(H1, H1)
        16580474105437433399820305371359442442925783187705352117189664556047228178620, //...and so on
        8402882114362553348470385035641836079763698187447181765066228837497212806560
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
