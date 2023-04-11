pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
component main { public [ Ax, Ay, M ] } = EdDSAPoseidonVerifier();
