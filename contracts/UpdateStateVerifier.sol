//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// 2019 OKIMS
//      ported to solidity 0.6
//      fixed linter warnings
//      added requiere error messages
//
//
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.16;
import "./Pairing.sol";
contract UpdateStateVerifier {
    using Pairing for *;
    struct VerifyingKey {
        Pairing.G1Point alfa1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[] IC;
    }
    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }
    function verifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alfa1 = Pairing.G1Point(
            20491192805390485299153009773594534940189261866228447918068658471970481763042,
            9383485363053290200918347156157836566562967994039712273449902621266178545958
        );

        vk.beta2 = Pairing.G2Point(
            [4252822878758300859123897981450591353533073413197771768651442665752259397132,
             6375614351688725206403948262868962793625744043794305715222011528459656738731],
            [21847035105528745403288232691147584728191162732299865338377159692350059136679,
             10505242626370262277552901082094356697409835680220590971873171140371331206856]
        );
        vk.gamma2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.delta2 = Pairing.G2Point(
            [11559732032986387107991004021392285783925812861821192530917403151452391805634,
             10857046999023057135944570762232829481370756359578518086990519993285655852781],
            [4082367875863433681332203403145435568316851327593401208105741076214120093531,
             8495653923123431417604973247489272438418190587263600148770280649306958101930]
        );
        vk.IC = new Pairing.G1Point[](25);
        
        vk.IC[0] = Pairing.G1Point( 
            20306064257867394121701204843723221825292608108852147677758624862164872411643,
            16652199503391271811727945814727577959617952648658600385639124896139363713787
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            18402153447409183854140238464219494477644602559802564126124682197395144482284,
            20496119033901746970518834228919620771456662673394200373941568589577873331994
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            15874120537716219197316832385594348551232355780677362207477710878317978219457,
            21063268775008172626160042542074837540337363724220400973581793160952788645230
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            8311800000363672726280596999489101608128281135918929647217842008400905994885,
            19110953908139294616651999330393143336641567157297507045000692948618952549755
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            8798335821901108425886008240647457030958084282589214634067873473228637101018,
            4393816488678680872007740687365770398753191378101196497725944329406628375322
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            8999570916034989714132569768178751108138952388667707217484580409765052383513,
            17405130733383450438748336107898567585305506814815924708508195665122826554878
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            5627498225483128248445467549715174014320119284190469684965412410996693830653,
            17425991591906186865618429265902160020045587705168788330062387269748958376304
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            20251831000427235832380801458582998515388747241895602363564322500445712300234,
            3126729013749850640558658443776753786449943353408788816555311490359724664368
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            19397068583291135421917007371191270115771517801328036845317373074657747347443,
            14330254371451957846364639285328268802379272778640478213294915468023908197145
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            8556638274345588588825098069985480151342227446679073407395294627009231279683,
            562254725585990425741503495500996166627007718591794406323458061037971403354
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            15464693746438249226676803983095065854193348225715747015717109422556084828234,
            3311825638554832851276392709223442904736006483278218769491191525846183588576
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            13097530125243454345505716678695763465783326718059099991359119274696963528975,
            20947356445895253708689497099604334145724718740919294270327152413418240211472
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            14414907900099377884314066791044965817576361417292675589564523404321329668872,
            1497146259381204673135271284768184568986671717183835946985637376966757100359
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            352317466932745746397835756894082067283726451998525078937713333051927834847,
            14479781480184039224948305515944832900298691075297400123975912828417926122300
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            9662659625547639144728213960378657823306176485164571434621050253506937073468,
            5492527229015998390642964431622619704098165655979093477483994747523840049089
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            13320684591508040823909776773667653602515952568642634737138264364525741914772,
            5587747126250904063793229875184867298773918851950927133948153527446404175202
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            8497622095516322809257639543621391807164463038114773914154769840593763037578,
            19888054660792358902170540278382952556599922005997201663218869000337772952806
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            21245394545778559327246444063372820286570218596226395952477323830947942589309,
            11063546138789821493085218538926037054471974405851664154286161678379806828083
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            11295059165574611264047652021909655181317119578997045543745171821005936043857,
            14203041847621891131976964534672135971098820302177233336340776572633249788275
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            9436030689115271082777133890388265023406074366895613670153186470223837158189,
            76464097302351533161109949250998851924232873894917650402794569774024058538
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            7572294685582853645261545267511071088807211344202915117083026931553425411625,
            3902632963974982962118960591470490430705810909062350618945226951120891609656
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            517632893000197231947385634909729865674402504847912998869492589144077668732,
            6768366924430368311903959942944191794293926840053507960514729672503560305212
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            6295336634995719839346874851798354671363193103968488434933019005953558531117,
            20535508566653748150061605582915026524533900460751942775082216740417260662112
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            8362851452178549488114085118190167023130543621655810983475833030694366737923,
            6676163464801306135778362280703599368646871647492121173293222167229277558423
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            5153460194754780368063341957140944395943977643751055960621055948105160680538,
            11083530944924204040914195189361998593787927188510727543504872992100602775642
        );                                      
        
    }
    function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.IC.length,"verifier-bad-input");
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint i = 0; i < input.length; i++) {
            require(input[i] < snark_scalar_field,"verifier-gte-snark-scalar-field");
            vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
        }
        vk_x = Pairing.addition(vk_x, vk.IC[0]);
        if (!Pairing.pairingProd4(
            Pairing.negate(proof.A), proof.B,
            vk.alfa1, vk.beta2,
            vk_x, vk.gamma2,
            proof.C, vk.delta2
        )) return 1;
        return 0;
    }
    /// @return r  bool true if proof is valid
    function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[24] memory input
        ) public view returns (bool r) {
        Proof memory proof;
        proof.A = Pairing.G1Point(a[0], a[1]);
        proof.B = Pairing.G2Point([b[0][0], b[0][1]], [b[1][0], b[1][1]]);
        proof.C = Pairing.G1Point(c[0], c[1]);
        uint[] memory inputValues = new uint[](input.length);
        for(uint i = 0; i < input.length; i++){
            inputValues[i] = input[i];
        }
        if (verify(inputValues, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }
}
