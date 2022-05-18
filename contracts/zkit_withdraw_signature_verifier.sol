// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "./plonkit.sol";

contract WithdrawSignatureKeyedVerifier is Plonk4VerifierWithAccessToDNext {
    uint256 constant SERIALIZED_PROOF_LENGTH = 33;

    function get_verification_key() internal pure returns(VerificationKey memory vk) {
        vk.domain_size = 16384;
        vk.num_inputs = 3;
        vk.omega = PairingsBn254.new_fr(0x2337acd19f40bf2b2aa212849e9a0c07d626d9ca335d73a09119dbe6eaab3cac);
        vk.selector_commitments[0] = PairingsBn254.new_g1(
            0x231c1e51add4d5f6bd1cd66949a0c826d0da068a8aa450c4b910af2723c31a51,
            0x27028417323b54c6276a2d96c053172af54b1f0519ad2bb5db2b784f059dd0bb
        );
        vk.selector_commitments[1] = PairingsBn254.new_g1(
            0x11da099ae1a4985ae32a03fdbb97c2a1cb01ef699cc2d50215c0444737cb4964,
            0x0ddf4c9185e6120ccb58d6e9f379bab948845872394839c501ee56c7afd64e59
        );
        vk.selector_commitments[2] = PairingsBn254.new_g1(
            0x20e65148062f6f99ec3f867ec4ee244c089f5335ef71f783af103ff98f63bae7,
            0x2b5c4a2c9a672fbc2ff0c6506d4dd536bd306840f49cc90e3b138aebbcffc9c4
        );
        vk.selector_commitments[3] = PairingsBn254.new_g1(
            0x1a2a6887029420c5a7a27152c1b3fb8808047ae0591870b560df431fbd8b242d,
            0x1c6be97981fb344af0d9fa3b80cc1cdc25960ec939bbe66b95dfe7f75fdd4e25
        );
        vk.selector_commitments[4] = PairingsBn254.new_g1(
            0x19db1bfa3bd755d28ac423de59511ba280b979a59070db6fb4f4fd1b64ffbd91,
            0x0b7fb2519d15410ce76f202e832f5bbdc4f069df9d54ffdfab309fcdb70370e7
        );
        vk.selector_commitments[5] = PairingsBn254.new_g1(
            0x2c96cfe2874240ba834079924a6dbf2dfb7ea98e199c501a5f14345e0aeef690,
            0x25c13e38aaa3c2c0b30772dbf2a4fdc289a221deb2762f11435a68739561b02e
        );
        
        // we only have access to value of the d(x) witness polynomial on the next
        // trace step, so we only need one element here and deal with it in other places
        // by having this in mind
        vk.next_step_selector_commitments[0] = PairingsBn254.new_g1(
            0x018200c21af09ae5e1f5f35422117b0d012ff224ff1e306a9cf53ac682f6c14d,
            0x2fef6bfafbb8e8bb8a6ee8683ac696fe419ce86fad734b9aea5392b8053c1ce0
        );
        
         vk.permutation_commitments[0] = PairingsBn254.new_g1(
            0x227173afa7b62aa1eae6e82370a8eda93726625493aff7205b53f717b21a7620,
            0x012fdfa0436e59f249829ba253a3ee732b7cf5ef9f94356831882bd4b6a4fa53
        );
        vk.permutation_commitments[1] = PairingsBn254.new_g1(
            0x17024ade5e72f4121bace0e1b1fc5ce57800ad1928a8bc4005e819f839336793,
            0x06772d03ee37f2d02a2f8ffb1f24f22f3b883814e1f2ab778b60e919598940ae
        );
        vk.permutation_commitments[2] = PairingsBn254.new_g1(
            0x217e239e463927fa95a98a3b20f73df26241c6d25db3ee9246a9dface4b3f5da,
            0x1e26c860a1b896c46b20267953400d0a0c65db9019299630f75f5f0de561c0d7
        );
        vk.permutation_commitments[3] = PairingsBn254.new_g1(
            0x1df7f13fe81d055d2790ff1c1eb09a97ba9c647cd18414da5d394e470ae1dbe3,
            0x18a5740ebc4dbafbaa5a284e9dc343d9adb4371cae6ced1d561b94316ed0d04c
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
