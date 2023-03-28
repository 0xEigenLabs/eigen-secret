import { ethers } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
const cls = require("circomlibjs");
import { deployPoseidonFacade } from "./deploy_poseidons.util";

describe("poseidon", () => {
    let spongePoseidon: Contract;

    before(async () => {
        spongePoseidon = await deployPoseidonFacade();
    });

    it("check poseidon hash function with inputs [1, 2, 3, 4, 5, 6]", async () => {
        // poseidon goiden3 [extracted using go-iden3-crypto/poseidon implementation]
        const resGo = "20400040500897583745843009878988256314335038853985262692600694741116813247201";
        const resSC = await spongePoseidon.poseidon6([1, 2, 3, 4, 5, 6]);
        console.log(resSC)
        expect(resSC).to.be.equal(resGo);
    });

    it("check with input 1", async() => {
        const resGo = "18586133768512220936620570745912940619677854269274689475585506675881198879027";
        const resSC = await spongePoseidon.poseidon1([1]);
        console.log(resSC)
        expect(resSC).to.be.equal(resGo);
    })

    it("check poseidon hash function with inputs [1, 2, 3, 4, 5, 6, 7, 8]", async () => {
        const resGo = "1152305401687934645444055619201663931885907446826162025284948369145242973368";
        const resSC = await spongePoseidon.poseidonSponge([1, 2, 3, 4, 5, 6, 7, 8]);

        console.log(resSC)
        expect(resSC).to.be.equal(resGo);
    });
});
