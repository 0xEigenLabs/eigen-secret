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
            20382280450404084069895151001897832188354586468754255558460695097878079587838,
            10778536763109347108202904359637262065195859376534916624484725962182372922680
        );                                      
        
        vk.IC[1] = Pairing.G1Point( 
            8327496377561468045764013435522268328507328026721136553176598147149425112976,
            2735004327041823942949065232619980063601887888287486053997579306459321541049
        );                                      
        
        vk.IC[2] = Pairing.G1Point( 
            6105347042869709449404817762708567157001738074860264027657525051727771602731,
            19334427447500596788613463442693688354969213512404904029141834763277729932946
        );                                      
        
        vk.IC[3] = Pairing.G1Point( 
            7226736014316563209510811402767982764867703015308268414170437534692057540222,
            15225530823315525705040560362213654540915225739706433557028691142428561909384
        );                                      
        
        vk.IC[4] = Pairing.G1Point( 
            9306476980842650136680612374698787187170827308836702200378458964612406496611,
            16403185382877626313643757770805166995595816404737131738726487627535660005745
        );                                      
        
        vk.IC[5] = Pairing.G1Point( 
            3059341189807494292160045666021869443864013076287061961479135115156487521469,
            12461238768403038115185158484985474202788097862567281492180334089294314158251
        );                                      
        
        vk.IC[6] = Pairing.G1Point( 
            13753551688125072219697801180138983731351236927888084068460291916845813963802,
            21862413686607499216278565310652279998615043584268953838314768356539674575328
        );                                      
        
        vk.IC[7] = Pairing.G1Point( 
            13742693045827681486178110590768820025023442741692287570632283569834968047762,
            8940267504430272905346484988286234436295295839384203733948542458126488709825
        );                                      
        
        vk.IC[8] = Pairing.G1Point( 
            6637210115032890304598032180959583415149706993146280198475534895832702073164,
            7967943587382201561723403484599661007884159196403901348231615226194796859130
        );                                      
        
        vk.IC[9] = Pairing.G1Point( 
            14156143936742037468223264579021283192532981035574645142522542529944998708847,
            7413720989205940823119466431855651440312183673047716248634836120154250093414
        );                                      
        
        vk.IC[10] = Pairing.G1Point( 
            4300266199334888076492846244006994224929311527922783823002400029064171356545,
            5406732976346786391516498194584423156506233310542929419166064972473532213952
        );                                      
        
        vk.IC[11] = Pairing.G1Point( 
            15705656701855017665475467300882914711784372373425908611412199104841167420010,
            18657520248624345724702197897797349508496592461578061842881421892779641542025
        );                                      
        
        vk.IC[12] = Pairing.G1Point( 
            12919829560296509310082199175906679568091818065698994213378135385021160465404,
            17908883105456088388033338806656203858552737871186998219617817725083473836431
        );                                      
        
        vk.IC[13] = Pairing.G1Point( 
            12929345558935328496889722221010576122411166013807318815726836842135033360152,
            14369788982866628524593906996895649460437585607861248769219005074771947093247
        );                                      
        
        vk.IC[14] = Pairing.G1Point( 
            2807133055059169849730525999965910055788180163982944139238384431321029435584,
            9135993688332365588024741319256720602990297333395372189768398047116972189341
        );                                      
        
        vk.IC[15] = Pairing.G1Point( 
            19558206810031891705225873510247103834264509898604550499647396879446630219308,
            18071462887666203185016738409221482373265023402381480380177850805485979024518
        );                                      
        
        vk.IC[16] = Pairing.G1Point( 
            5270955346343903534630842027527885649889952208615088861966015073270433961535,
            7441817194871409604347082075663717990891781358801572852107653004193402153109
        );                                      
        
        vk.IC[17] = Pairing.G1Point( 
            20738836496483143063863392973353909324292412049302517472138683888767959582365,
            12735994148158725763977522314077261106019331975782816767403546220613444011194
        );                                      
        
        vk.IC[18] = Pairing.G1Point( 
            8716665945357050555093953608896288851545195437891742889249783715832092868743,
            4356485057117346753057994095511399259207430924253925947518938124712597816916
        );                                      
        
        vk.IC[19] = Pairing.G1Point( 
            16279477820427992676815003768847430638052903336809147898031168246753837439821,
            11225294777484450284704447676456828210117869425956636419428241478162397131602
        );                                      
        
        vk.IC[20] = Pairing.G1Point( 
            7096969506307813145016778505665199287890759878806063954972223932981335275506,
            15014251978112911761616293942362213868626687034732787452435385666666702068078
        );                                      
        
        vk.IC[21] = Pairing.G1Point( 
            6721615367794894474658127926153197981615359275708830250613533651787899676701,
            3570673957938852904040977539126237816636736387185860265810012467427587886743
        );                                      
        
        vk.IC[22] = Pairing.G1Point( 
            11906822809053568034243724323576026887758095198154680572531850328642951331526,
            21098157656978643062865079927111630324970186318039688020108069481354740718874
        );                                      
        
        vk.IC[23] = Pairing.G1Point( 
            13102485900948719531047466542977853886393552871987138907076368184565333044720,
            20681182992926479294873615571953183906693574108907210552729331025301144407072
        );                                      
        
        vk.IC[24] = Pairing.G1Point( 
            18883017496515407192342962141128092179355718865529837941779418229257566493669,
            2284312170675312734745495676701492232314350776533158004410400592458502890383
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
