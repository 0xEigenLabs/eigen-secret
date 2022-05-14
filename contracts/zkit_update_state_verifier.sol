// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity >=0.5.0 <0.9.0;

import "./plonkit.sol";

contract UpdateStateKeyedVerifier is Plonk4VerifierWithAccessToDNext {
    uint256 constant SERIALIZED_PROOF_LENGTH = 33;

    function get_verification_key() internal pure returns(VerificationKey memory vk) {
        vk.domain_size = 262144;
        vk.num_inputs = 3;
        vk.omega = PairingsBn254.new_fr(0x0f60c8fe0414cb9379b2d39267945f6bd60d06a05216231b26a9fcf88ddbfebe);
        vk.selector_commitments[0] = PairingsBn254.new_g1(
            0x00bf9ee4fe76343d572d83824d087abfd5c009ea4e2ec18a0b15689e23de228e,
            0x072b38c714c6a6dc99a5de1e3bcd07e4585d03aacae46d7f517c41aa7d388254
        );
        vk.selector_commitments[1] = PairingsBn254.new_g1(
            0x196d3b870e9b2f118d7a2daa71dbcc9e36c9b2c8ca424dd889d11c8e865791d2,
            0x086f8800506137e242582616ad49b004f71deaac6079d0f9f6b177ceabacd242
        );
        vk.selector_commitments[2] = PairingsBn254.new_g1(
            0x1b61bbaf13f8ae43e844fdfdc4cea21415f17890dd77db65d98fbb63c213e29c,
            0x2eb9178d48734844491e6ac52428d295a55bcfe45f9ede853a52797f13126515
        );
        vk.selector_commitments[3] = PairingsBn254.new_g1(
            0x1cd1638c246b75df5f093f1af29ced6aace416d32382a6cdff26c3f0f86b09d1,
            0x027a3cf8cf72d860f10fcd678c720af83835e6009cb29558fe70411d04487833
        );
        vk.selector_commitments[4] = PairingsBn254.new_g1(
            0x2f5d69a89e0a7c72c7c8e71f0589f3bc7b423b6a0ec411e062fdd7ca8ebe881c,
            0x1b9caec9b3f57271adc6c2ebe31683639c564a9439f9977b607a9d457060c049
        );
        vk.selector_commitments[5] = PairingsBn254.new_g1(
            0x1b67dfc8e88ad534dbc1f806bf62a2541472bda740ea703cb0774c5357cac7e6,
            0x2329b35a8e6dad0227d4bed45fbb999ab93639c328a6e8f9701a0593cf3730e1
        );
        
        // we only have access to value of the d(x) witness polynomial on the next
        // trace step, so we only need one element here and deal with it in other places
        // by having this in mind
        vk.next_step_selector_commitments[0] = PairingsBn254.new_g1(
            0x2ca42360bb1c8c01182a69958b09bac9777064eb485e008f5b1e66212f65d90f,
            0x113c6f85ff8d31c1964bb1c1e1337247cbc849e97c973aa2048a8d2967ae80d0
        );
        
         vk.permutation_commitments[0] = PairingsBn254.new_g1(
            0x1b4e86c28bc11a69ab07fbf5f1091d63ca19d549554ebe24aff2d49776036297,
            0x00bd279b0d9297be21bc98d3dced0c758086a85d366b17dfca3cb941ac99f549
        );
        vk.permutation_commitments[1] = PairingsBn254.new_g1(
            0x2df519f68d6187ba16b77743bfe97ce36c479b036072ab0b6aeec2b40145c936,
            0x1e514ce77c7a46e7b8911b0ccad8dea37c775d98e063f11d416fafae668ef9c3
        );
        vk.permutation_commitments[2] = PairingsBn254.new_g1(
            0x11edb612f9cfa63c40a106c96fc7212bb8963a55e93b7f8a81fd11c6cfc273b0,
            0x28e292ab2d64ecd501c86abfa0dbd37fdd8381b60c10b0abf9ab9f2d249e0b60
        );
        vk.permutation_commitments[3] = PairingsBn254.new_g1(
            0x04658037b8ea493af7504bb3695373d7d37b6f4e76b13e641fb5f33bde3a6749,
            0x0a0d763cfd35cd363cd96c75293f89d5d8efe86f70c8ac4d61645a73a6023e76
        );
        
        vk.permutation_non_residues[0] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000005
        );
        vk.permutation_non_residues[1] = PairingsBn254.new_fr(
            0x0000000000000000000000000000000000000000000000000000000000000007
        );
        vk.permutation_non_residues[2] = PairingsBn254.new_fr(
            0x000000000000000000000000000000000000000000000000000000000000000a
        );
        
        vk.g2_x = PairingsBn254.new_g2(
            [0x260e01b251f6f1c7e7ff4e580791dee8ea51d87a358e038b4efe30fac09383c1,
             0x0118c4d5b837bcc2bc89b5b398b5974e9f5944073b32078b7e231fec938883b0],
            [0x04fc6369f7110fe3d25156c1bb9a72859cf2a04641f99ba4ee413c80da6a5fe4,
             0x22febda3c0c0632a56475b4214e5615e11e6dd3f96e6cea2854a87d4dacc5e55]
        );
    }


    function deserialize_proof(
        uint256[] memory public_inputs, 
        uint256[] memory serialized_proof
    ) internal pure returns(Proof memory proof) {
        require(serialized_proof.length == SERIALIZED_PROOF_LENGTH);
        proof.input_values = new uint256[](public_inputs.length);
        for (uint256 i = 0; i < public_inputs.length; i++) {
            proof.input_values[i] = public_inputs[i];
        }
 
        uint256 j = 0;
        for (uint256 i = 0; i < STATE_WIDTH; i++) {
            proof.wire_commitments[i] = PairingsBn254.new_g1_checked(
                serialized_proof[j],
                serialized_proof[j+1]
            );

            j += 2;
        }
        
        proof.grand_product_commitment = PairingsBn254.new_g1_checked(
                serialized_proof[j],
                serialized_proof[j+1]
        );
        j += 2;
        
        for (uint256 i = 0; i < STATE_WIDTH; i++) {
            proof.quotient_poly_commitments[i] = PairingsBn254.new_g1_checked(
                serialized_proof[j],
                serialized_proof[j+1]
            );

            j += 2;
        }
        
        for (uint256 i = 0; i < STATE_WIDTH; i++) {
            proof.wire_values_at_z[i] = PairingsBn254.new_fr(
                serialized_proof[j]
            );

            j += 1;
        }
        
        for (uint256 i = 0; i < proof.wire_values_at_z_omega.length; i++) {
            proof.wire_values_at_z_omega[i] = PairingsBn254.new_fr(
                serialized_proof[j]
            );

            j += 1;
        }
        
        proof.grand_product_at_z_omega = PairingsBn254.new_fr(
                serialized_proof[j]
            );

        j += 1;

        proof.quotient_polynomial_at_z = PairingsBn254.new_fr(
            serialized_proof[j]
        );

        j += 1;

        proof.linearization_polynomial_at_z = PairingsBn254.new_fr(
            serialized_proof[j]
        );

        j += 1;
    
        for (uint256 i = 0; i < proof.permutation_polynomials_at_z.length; i++) {
            proof.permutation_polynomials_at_z[i] = PairingsBn254.new_fr(
                serialized_proof[j]
            );

            j += 1;
        }

        proof.opening_at_z_proof = PairingsBn254.new_g1_checked(
                serialized_proof[j],
                serialized_proof[j+1]
        );
        j += 2;

        proof.opening_at_z_omega_proof = PairingsBn254.new_g1_checked(
                serialized_proof[j],
                serialized_proof[j+1]
        );
    }
    
    function verify_serialized_proof(
        uint256[] memory public_inputs, 
        uint256[] memory serialized_proof
    ) public view returns (bool) {
        VerificationKey memory vk = get_verification_key();
        require(vk.num_inputs == public_inputs.length);

        Proof memory proof = deserialize_proof(public_inputs, serialized_proof);

        bool valid = verify(proof, vk);

        return valid;
    }  
}
