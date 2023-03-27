import { ethers } from "hardhat";
import { Contract } from "ethers";
import { expect } from "chai";
const cls = require("circomlibjs");

describe("poseidon", () => {
  let spongePoseidon: Contract;
  let accounts: any;
  let poseidon3: Contract;
  let poseidon6: Contract;

  before(async () => {
    accounts = await ethers.getSigners();
    const Poseidon6 = new ethers.ContractFactory(
        cls.poseidonContract.generateABI(6),
        cls.poseidonContract.createCode(6),
        accounts[0]
    );
    poseidon6 = await Poseidon6.deploy();
    console.log("poseidon6 address:", poseidon6.address);
    const Poseidon3 = new ethers.ContractFactory(
        cls.poseidonContract.generateABI(3),
        cls.poseidonContract.createCode(3),
        accounts[0]
    );
    poseidon3 = await Poseidon3.deploy();
    console.log("poseidon6 address:", poseidon3.address);
    const SpongePoseidonFactory = await ethers.getContractFactory("SpongePoseidon", {
        libraries: {
            PoseidonUnit6L: poseidon6.address,
            PoseidonUnit3L: poseidon3.address,
        },
    });
    spongePoseidon = await SpongePoseidonFactory.deploy();
    console.log("spongePoseidon address:", spongePoseidon.address);
  });

  it("check poseidon hash function with inputs [1, 2, 3, 4, 5, 6]", async () => {
    // poseidon goiden3 [extracted using go-iden3-crypto/poseidon implementation]
    const resGo = "20400040500897583745843009878988256314335038853985262692600694741116813247201";
    // poseidon smartcontract
    const resSC = await poseidon6["poseidon(uint256[6])"]([1, 2, 3, 4, 5, 6]);
    console.log(resSC)
    expect(resSC).to.be.equal(resGo);
  });

  it("check poseidon hash function with inputs [1, 2, 3, 4, 5, 6, 7, 8]", async () => {
    // poseidon goiden3 [extracted using go-iden3-crypto/poseidon implementation]
    const resGo = "18604317144381847857886385684060986177838410221561136253933256952257712543953";
    // poseidon smartcontract
    const resSC = await spongePoseidon.hash([1, 2, 3, 4, 5, 6, 7, 8]);
    console.log(resSC)
    expect(resSC).to.be.equal(resGo);
  });
});
