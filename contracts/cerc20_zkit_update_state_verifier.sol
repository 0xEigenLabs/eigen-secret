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
            0x17c5d25b17ea3f5555dd5e734eef96388d9ad01e5426cdd5d2cdeb2670ce7c1e,
            0x2eed6c5a58e0f1ec5239854ea53bbb3bf55abaf0d3ed5e00dde5c343d2ad6793
        );
        vk.selector_commitments[1] = PairingsBn254.new_g1(
            0x219036028da0f8e3c2c702ba04c7b5e5cb21e7c75280fe4a6872983f149659be,
            0x0f16f15f3f03804e6514a8ea43b8ab0ca36339d3086c6768e80cfc2d1318b89f
        );
        vk.selector_commitments[2] = PairingsBn254.new_g1(
            0x11fa86c6ba8bb11979428a0ed7e39761220d0560f399f8f4b6dd935b28a278b1,
            0x02331bd7fdba080516a45e0d46b61b058458338fc2509acb086dc1454c8910c0
        );
        vk.selector_commitments[3] = PairingsBn254.new_g1(
            0x2a3047922c362f51364d5fb737b0ffe029f8494a2f21409ce68c8b7ec29fed1f,
            0x24e08cedd2af3de7fe212bc996051365cf2bf654870204699fb83989468591f6
        );
        vk.selector_commitments[4] = PairingsBn254.new_g1(
            0x0f90ab46d7930838cd9d1f819594e9821e1cf7571130ab8aacd4522d364bf585,
            0x28f43b111989aa37c746578f61d9544802ed2ec9fd1fafb2d0829b908e6a9596
        );
        vk.selector_commitments[5] = PairingsBn254.new_g1(
            0x0503f28d6443e5352b5cd7fde740770b163fcaa6f475c7ac311455d7b78f1616,
            0x0fe6e890de00e8e316015d755962298cffbc6b4ae544c495fa609a07d35409c9
        );
        
        // we only have access to value of the d(x) witness polynomial on the next
        // trace step, so we only need one element here and deal with it in other places
        // by having this in mind
        vk.next_step_selector_commitments[0] = PairingsBn254.new_g1(
            0x2ec64de9c98fdc3dc35a134d952f3f15a327af64340278a7179eca96daa8d4fe,
            0x2b80bc3922a811400dcead024b50b8dccde33ae222a240b24f01cf5cfcffd86c
        );
        
         vk.permutation_commitments[0] = PairingsBn254.new_g1(
            0x1c0875d36c5a9a03ca790f1a02be4dba5d0a82f5ca0c2fd2b3f4596a7f95f66e,
            0x0831ede39636228e56d32bac6cc699bc16b46f6ff76bebf171655b31713c8ca3
        );
        vk.permutation_commitments[1] = PairingsBn254.new_g1(
            0x1e6b598e79c359d1f1006f8a0f234e10d947b78da7828fdb593a9fa36951cfff,
            0x077a07ae5e12367ee2bf939ebc898e46a2c3795b77fc73e13a34d698348df464
        );
        vk.permutation_commitments[2] = PairingsBn254.new_g1(
            0x2a21905420caeb0533523a41c28950578fd9e3b2b0e03f08949b3918f4f37960,
            0x2ba9b308bed30a2bfe9eede3f94a9acfb82e6cc10cf15c8ad332c47092944a30
        );
        vk.permutation_commitments[3] = PairingsBn254.new_g1(
            0x1757e6a29a1bbbf0995dd01b06b8bce849d5b9451caa99b9f23c06aa0863259f,
            0x224f63bbc99d300dd42f61756ae4c1c0b727b42fbb1b00214343c07a00763057
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
