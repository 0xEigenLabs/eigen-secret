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
            5731749241016105653468842577582889801224137615865883838143237091243541019920,
            10999007072209490349256218812815360857654025994191367309560670293147883114713
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            312431079496964355994571745545173254982716419270347774694913645165892629916,
            16856844557751954518187164551791446599239264199289513138323740402438099018474
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            3721267668562345973882896084774165614473868813737686127639463368763671480068,
            2307369295039841620053136820864515957887165498310396846563634821554666230145
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            13033923967581705138525353931194645081551603772668287745974981478807761649626,
            14750363417714351620716494886433126210279127656220443915477448863650207192044
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            4884836682455414139559254891601782737310592929154020719109571068634598255735,
            8328351189442868074745404671479114171246294469406215049136523424706078050553
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            13030986715855540855638750507016022957940620899956676271358047322739566487902,
            14006493476260239761034989738189645534297572862240081560340622089769400541643
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            4563169003231134961408716817821194520099597449906131853964902270377198714327,
            7269013734938225862675881383040386473198293413279848699962958448009442221582
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            1853539943816574829538584978868108956398824679898805933223093175679372070190,
            21293868637523108259423266199357415683708314099555920980378582282473681412168
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            18137030953067944421136426114266094769915398606953771386964155319013426152993,
            744294781695871821333063264657023114256001741683122754826793182019146174292
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            11173789314926037721704620552204473178908760081784844695974446149910364445442,
            14986904059512897519708755000261395086521149594535806722829402964637966271005
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            4897565957279900473987655261975581112625659200662705789725960685555652927939,
            20180705878938439362828207318170813646828912341433934015558147959488870774485
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            12895057582500753177852800865488083062110234671503466427723309592282705856887,
            4507460071420559962959308337723057916331729387780015244964506978409562821525
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            8845926865083870038294127829656112117139282151607243193753825704749218815959,
            14997511894109759207216540723687399627521249025430185111271514551511048884866
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            14799739785730652833023474010077029804397476706467801874833180656915559511078,
            15226817535260877300621911711509468452457234562655215195900639322857439827585
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            20511643237183577809877449800004097574266382730316297267328088297317933001981,
            10329089104487725459390522388772095967959827295742324891822115933311137137912
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            16855162976819257974105844232452894627721981833908781477434212594366501324668,
            14712286251036564753240065880458827759121129579675088856881733055925930017009
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            9323577270635833950964661053386272558796102034210618782307479222988148830382,
            2639857787292152159378025206404284960478703482395164384321960635678145157460
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            9039858728291904518799752883322198899167313996712931351719263867202780394128,
            20380649485293136897393428163482157277114051299347612519619163692739123131627
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            13024246785185272826539431107687535692636985099718719316307025151444595132288,
            8782486300131230114361304974868634465828319539007278910024364879771239983773
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            20438020664135569912380224062178657507554931928980688400898501483283276440174,
            20751537913111123550231943549681416666558996526453747715487915346567112081096
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            10949988525045753058053581275265103202481649444890216148266982926268401620000,
            12820415460876983981890213208356506416826782030200700576914158382409341801933
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            7296716363330849858934929754869160358921553211118075903485654199395801353714,
            10914892430377697513282257363038439502541940966046791412416218408543535754474
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            16763284897281430687012689406823850681734465191331159238627108505421157929820,
            8861610585401749217771901014860054328575419289095075962998099335539311398887
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            11528374801784444578941997513376256281689400270266300934989860366926561284650,
            17455003671222319716321006604396815018954420330225446477862383444697277230788
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            7417671024913212878452673208332017388746270655003396390761562103177591116063,
            17585092388716686822717489844680253390218781249257400110306242360047696220407
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
