const { expect } = require("chai");
const { ethers } = require("hardhat");

const input = require("../circuits/public.json");
const proof = require("../circuits/proof.json");

describe("Plonk verifier test", function() {
  it("Should return true when proof is correct", async function() {
    const verifierFactory = await ethers.getContractFactory("KeyedVerifier");
    const verifier = await verifierFactory.deploy();

    await verifier.deployed();

    expect(await verifier.verify_serialized_proof(input, proof)).to.equal(true);
  });
});
