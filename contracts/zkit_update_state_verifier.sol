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
            0x07bcbfe31c69e1d5836f6fbf7a07de42e2a45e81f6fbe4f8ab523999f7a09717,
            0x087871b546f34c66bdfd334b067fd155f93eacfd869b1dc8f7c0fc948b1b9635
        );
        vk.selector_commitments[1] = PairingsBn254.new_g1(
            0x23d144044c98eaf91af6dd5c73c353ceb9b2db7e8b029bbb19e55618eaa6cd0d,
            0x0cfe9752d74a16fac9933abc870c744704534d2b2b0cfe461a11c0b057d2aba0
        );
        vk.selector_commitments[2] = PairingsBn254.new_g1(
            0x0eb56bc19f127e2548f797127692721e7f60219786bcb4691c6bfd86bc1c68b2,
            0x15ad82fcda20ee23163c86b5d92cfe5cbc92ae81b8c66d1238f5ff946b675454
        );
        vk.selector_commitments[3] = PairingsBn254.new_g1(
            0x2555aa9ea63f7d17cf97cfc5db80d9a46a2be997f06f962b112b62761beddaf9,
            0x2b761e912804cbec078519b237dd1914ec1ab4629d483711372fdba0e3f0f84e
        );
        vk.selector_commitments[4] = PairingsBn254.new_g1(
            0x1a641bebe4d3f4141a99356d5dd04d5d3d48c65a0eda41809a859d3d1cfb8533,
            0x242585511c58e37c7b35c0300f4e1cf6c7ca37222a167f7cb9b6292c69f08a58
        );
        vk.selector_commitments[5] = PairingsBn254.new_g1(
            0x0867eafc0271a302d63c4da6abf27c0920261ebbb3b7919ca0663901f40a3c5d,
            0x1279f2ead70298a78c7901ada46f024c92fca8cc628300132401898e556ad991
        );
        
        // we only have access to value of the d(x) witness polynomial on the next
        // trace step, so we only need one element here and deal with it in other places
        // by having this in mind
        vk.next_step_selector_commitments[0] = PairingsBn254.new_g1(
            0x1553f709b636202d0e66f9ee41906953dd6d00d349a1ecbaeb18e2e443357b5f,
            0x11e0cce81ea13ee6525b68cf8fe3ded5d4400326e58f89b48a9f6c78f42a3127
        );
        
         vk.permutation_commitments[0] = PairingsBn254.new_g1(
            0x0f1829ab78e05daf260f0f7da50faf376b088be9484ae70e8c8d125ac17f0f74,
            0x11c36f82a0190b96e425d2521a9064e9f497bc71a157778d070f70c441ed0530
        );
        vk.permutation_commitments[1] = PairingsBn254.new_g1(
            0x26b1f439bbaead8e73cbf0b7403ec6d30a6f8f68c5cc4987ec53d754b4c7fcac,
            0x1bc55dc39b2864a5dcf98b3f8c1a9853e3e18f4e74d0046437025d178ae5c961
        );
        vk.permutation_commitments[2] = PairingsBn254.new_g1(
            0x1f1254b3f5904e8c7888a0e2bc32a93fe892f9ff94da008863e62e832d4f0183,
            0x01d91bdc0759d8c77e3b30b2c8a96347111fd5c067589d0d92093788aa616716
        );
        vk.permutation_commitments[3] = PairingsBn254.new_g1(
            0x1d45de09618db85c39d61ca19a9d880dd103da90daedbbf25b6cc7754e1e0f0d,
            0x05d4210a5aef2f669894fef836c59983f4284db56092ee55215dca5501b712d5
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
