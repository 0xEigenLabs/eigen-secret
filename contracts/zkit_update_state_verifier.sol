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
            0x07a2500a02a3c700575bbdf9ce68d2d2fa34f59e8b4fb1f2106f57b06b44dfb9,
            0x19da586c93f7a6f3c606db83d4b5f8e71e090388e87e061a88b5c8e63f0d3f10
        );
        vk.selector_commitments[1] = PairingsBn254.new_g1(
            0x17dfbae9413b8085833c8f746746bfaa966a6c8eecd85f98ac204dd7742b338a,
            0x0414f8982d3530a6286878b62ef0f39d1ef7e82364c0adeb04a07a0cc4d3afcd
        );
        vk.selector_commitments[2] = PairingsBn254.new_g1(
            0x23a2f2444defe163f1c6132e04f40959f622906c75d4d00fa8c5a49fc974d8a2,
            0x26261a2335550d65bbb23d4b8a2a3413a59b2318d5965787891d69160bdcf9ab
        );
        vk.selector_commitments[3] = PairingsBn254.new_g1(
            0x02a0e7dfa3eca906a2a5a11159f1a22ac220bee48b6688748d43447b0a287193,
            0x2f9a60325609a300aa4ee950259efdfd6a9230edd31c707b7cc644bc546e144e
        );
        vk.selector_commitments[4] = PairingsBn254.new_g1(
            0x2f6c45a1315890697c19ec9f100091ec74b79bcd60c912a6629b3d16b901f622,
            0x09e02a956a4ed115456d244745f5481aaa7fcbf5831daa4680dd86d0493657f4
        );
        vk.selector_commitments[5] = PairingsBn254.new_g1(
            0x22ef2303cf3ab5e318356a6703349be4d9139cd39e8947bc1f6d699874662919,
            0x13504d754583bd3306cd062af83b3d431c62eb5ef0daa59a938093d0096f310c
        );
        
        // we only have access to value of the d(x) witness polynomial on the next
        // trace step, so we only need one element here and deal with it in other places
        // by having this in mind
        vk.next_step_selector_commitments[0] = PairingsBn254.new_g1(
            0x21f7e4cc01d78bfd7842ecce919a4bcf10d0e60d1df410cbc4c1c36bbbd65bf5,
            0x099f07b7570685ad7acda6c6ab04e7147174f34d44f4557e69a78936d9bfe6a8
        );
        
         vk.permutation_commitments[0] = PairingsBn254.new_g1(
            0x21d11a107479085922a28345a8785d1efa4a8eff0e0e8a7ae12682af4c4f0ecd,
            0x0fb85ab87d1aac5ecf0e55c419ab22d25caeb5a119b3f93ab2ab758f5b9fa174
        );
        vk.permutation_commitments[1] = PairingsBn254.new_g1(
            0x17d1a8e420010708d44fcf8a77f989961d40abd462c7f3e65e97cac24d424de3,
            0x2fc78d4a6a97e44fdc05f2e0d7d722957d792bcc9947eb6d8441c47c18f3c2cc
        );
        vk.permutation_commitments[2] = PairingsBn254.new_g1(
            0x2d2cbbd94cb09ab605728cdfbcd472a4b340660668777fe43837a3247614fcf1,
            0x25e8182804017eec94081baa033788b10a784ff0ffd68e21989447cc2a4f7a6c
        );
        vk.permutation_commitments[3] = PairingsBn254.new_g1(
            0x19dda0458db0137cee97a31689e10ec915417521848de537e44adc4e9755d6e5,
            0x0026f7abbe154ed1bdd78baab90ce1ec62f91537da73c5f5542240452d946fd0
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
