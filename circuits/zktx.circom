pragma circom 2.0.0;
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/escalarmulany.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/babyjub.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";

// check if low <= m < high;
template RangeProof (n) {
    signal input low; // [low,
    signal input high; // high)
    signal input m;
    signal output out;

    component lessor = LessThan(n);
    lessor.in[0] <== m;
    lessor.in[1] <== high;

    lessor.out === 1;

    component greater = GreaterEqThan(n);
    greater.in[0] <== m;
    greater.in[1] <== low;
    1 === greater.out;
    out <== lessor.out * greater.out;
}

template TEEncryption() {
    signal input amount;
    signal input r1;
    signal input r2;
    signal input H[2];
    signal input pubkey[2][2];
    signal input C_S[2];
    signal input C_R[2];
    component escalarMul_rG;
    component escalarMul_vH;
    component escalarMul_pk;
    component escalarMul_rG_2;
    component escalarMul_pk_2;
    component n2b;
    component n2b_2;
    component n2b_g;
    component n2b_g_2;
    component n2b_h;
    component babyAdd;
    component babyAdd_2;

    // babyjubjub base point
    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    // pk_s^r1
    n2b = Num2Bits(253);
    r1 ==> n2b.in;
    escalarMul_pk = EscalarMulAny(253);
    escalarMul_pk.p[0] <== pubkey[0][0]; // identity
    escalarMul_pk.p[1] <== pubkey[0][1];
    for  (var i=0; i<253; i++) {
        n2b.out[i] ==> escalarMul_pk.e[i];
    }

    // pk_r^r2
    n2b_2 = Num2Bits(253);
    r2 ==> n2b_2.in;
    escalarMul_pk_2 = EscalarMulAny(253);
    escalarMul_pk_2.p[0] <== pubkey[1][0]; // identity
    escalarMul_pk_2.p[1] <== pubkey[1][1];
    for  (var i=0; i<253; i++) {
        n2b_2.out[i] ==> escalarMul_pk_2.e[i];
    }

    // g^r1
    n2b_g = Num2Bits(253);
    r1 ==> n2b_g.in;
    escalarMul_rG = EscalarMulAny(253);
    escalarMul_rG.p[0] <== BASE8[0];
    escalarMul_rG.p[1] <== BASE8[1];
    for  (var i=0; i<253; i++) {
        n2b_g.out[i] ==> escalarMul_rG.e[i];
    }

    // g^r2
    n2b_g_2 = Num2Bits(253);
    r2 ==> n2b_g_2.in;
    escalarMul_rG_2 = EscalarMulAny(253);
    escalarMul_rG_2.p[0] <== BASE8[0];
    escalarMul_rG_2.p[1] <== BASE8[1];
    for  (var i=0; i<253; i++) {
        n2b_g_2.out[i] ==> escalarMul_rG_2.e[i];
    }

    // h^v
    n2b_h = Num2Bits(253);
    amount ==> n2b_h.in;
    escalarMul_vH = EscalarMulAny(253);
    escalarMul_vH.p[0] <== H[0];
    escalarMul_vH.p[1] <== H[1];
    for  (var i=0; i<253; i++) {
        n2b_h.out[i] ==> escalarMul_vH.e[i];
    }

    // g^r1 * h^v
    babyAdd = BabyAdd();
    babyAdd.x1 <== escalarMul_rG.out[0];
    babyAdd.y1 <== escalarMul_rG.out[1];
    babyAdd.x2 <== escalarMul_vH.out[0];
    babyAdd.y2 <== escalarMul_vH.out[1];

    C_S[0] === babyAdd.xout;
    C_S[1] === babyAdd.yout;

    // g^r1 * h^v
    babyAdd_2 = BabyAdd();
    babyAdd_2.x1 <== escalarMul_rG_2.out[0];
    babyAdd_2.y1 <== escalarMul_rG_2.out[1];
    babyAdd_2.x2 <== escalarMul_vH.out[0];
    babyAdd_2.y2 <== escalarMul_vH.out[1];

    C_R[0] === babyAdd_2.xout;
    C_R[1] === babyAdd_2.yout;
}

template ZKTX() {
    signal input senderPubkey[2];
    signal input receiverPubkey[2];

    signal input Max;
    signal input senderBalance;
    signal input r1;
    signal input r2;
    signal input amount;
    signal input H[2];

    signal input C_S[2];
    signal input C_R[2];

    // 0 <= amount < Max
    component rp = RangeProof(252);
    rp.low <== 0;
    rp.high <== Max;
    rp.m <== amount;
    1 === rp.out;

    // amount = senderBalance
    component greater = GreaterEqThan(252);
    greater.in[0] <== senderBalance;
    greater.in[1] <== amount;
    1 === greater.out;

    // check if sender encryption executed correctly
    component tee = TEEncryption();
    tee.amount <== amount;
    tee.r1 <== r1;
    tee.r2 <== r2;
    tee.H[0] <== H[0];
    tee.H[1] <== H[1];
    tee.pubkey[0][0] <== senderPubkey[0];
    tee.pubkey[0][1] <== senderPubkey[1];
    tee.pubkey[1][0] <== receiverPubkey[0];
    tee.pubkey[1][1] <== receiverPubkey[1];

    for (var i=0; i<2; i ++) {
        tee.C_S[i] <== C_S[i];
        tee.C_R[i] <== C_R[i];
    }
}

component main {
    public [
        senderPubkey,
        receiverPubkey,
        Max,
        H,
        C_S,
        C_R
    ]
} = ZKTX();
