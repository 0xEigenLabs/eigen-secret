import { ethers } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
const cls = require("circomlibjs");
import { deployPoseidonFacade } from "./deploy_poseidons.util";
import { poseidonSponge } from "../src/sponge_poseidon";

describe("poseidon", () => {
    let spongePoseidon: Contract;
    let poseidon: any;

    before(async () => {
        spongePoseidon = await deployPoseidonFacade();
        poseidon = await cls.buildPoseidon();
    });

    it("check poseidon hash function with inputs [1, 2, 3, 4, 5, 6]", async () => {
        // poseidon goiden3 [extracted using go-iden3-crypto/poseidon implementation]
        const resGo = "20400040500897583745843009878988256314335038853985262692600694741116813247201";
        let values = [1n, 2n, 3n, 4n, 5n, 6n];
        const resSC = await spongePoseidon.poseidon6(values);
        let resJS = poseidon.F.toObject(poseidon(values));
        console.log(resSC)
        expect(resSC).to.be.equal(resGo);
        expect(resSC).to.be.equal(resJS);
    });

    it("check with input 1", async() => {
        const resGo = "18586133768512220936620570745912940619677854269274689475585506675881198879027";
        let values = [1n];
        const resSC = await spongePoseidon.poseidon1(values);
        let resJS = poseidon.F.toObject(poseidon(values));
        console.log(resSC)
        expect(resSC).to.be.equal(resGo);
        expect(resSC).to.be.equal(resJS);
    })

    it("check poseidon hash function with inputs [1, 2, 3, 4, 5, 6, 7, 8]", async () => {
        //let values = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
        //let values = [1n, 2n, 3n, 4n, 5n, 6n];
        let values = new Array(20).fill(0).map((_, i) => BigInt(i+1));
        const resSC = await spongePoseidon.poseidonSponge(values);
        const resJS = await poseidonSponge(values);

        expect(resSC).to.be.equal(resJS);
    });
});
