// modified from https://github.com/personaelabs/spartan-ecdsa/blob/main/packages/circuits/eff_ecdsa_membership/eff_ecdsa.circom
pragma circom 2.0.2;

include "./secp256k1/mul.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

/**
 *  EfficientECDSA
 *  ====================
 *  
 *  Converts inputted efficient ECDSA signature to an public key. There is no
 *  public key validation included.
 */
template EfficientECDSA() {
    var bits = 256;
    signal input enabled;
    signal input Tx; // T = r^-1 * R
    signal input Ty;
    signal input Ux; // U = -(m * r^-1 * G)
    signal input Uy;

    // private
    signal input s;
    signal input pubKeyX;
    signal input pubKeyY;

    // sMultT = s * T
    component sMultT = Secp256k1Mul();
    sMultT.scalar <== s;
    sMultT.xP <== Tx;
    sMultT.yP <== Ty;

    // pubKey = sMultT + U
    component pubKey = Secp256k1AddComplete();
    pubKey.xP <== sMultT.outX;
    pubKey.yP <== sMultT.outY;
    pubKey.xQ <== Ux;
    pubKey.yQ <== Uy;

    (pubKeyX - pubKey.outX) * enabled === 0;
    (pubKeyY - pubKey.outY) * enabled === 0;
}
