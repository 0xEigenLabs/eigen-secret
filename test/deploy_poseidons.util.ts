import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const { poseidonContract } = require("circomlibjs");
import { Contract } from "ethers";

export async function deploySpongePoseidon(ethers: any, poseidon6ContractAddress: string): Promise<Contract> {
  const SpongePoseidonFactory = await ethers.getContractFactory("SpongePoseidon", {
    libraries: {
      PoseidonUnit6L: poseidon6ContractAddress,
    },
  });

  const spongePoseidon = await SpongePoseidonFactory.deploy();
  await spongePoseidon.deployed();
  console.log("SpongePoseidon deployed to:", spongePoseidon.address);
  return spongePoseidon;
}

export async function deployPoseidons(
  ethers: any,
  deployer: SignerWithAddress,
  poseidonSizeParams: number[]
): Promise<Contract[]> {
  poseidonSizeParams.forEach((size) => {
    if (![1, 2, 3, 4, 5, 6].includes(size)) {
      throw new Error(
        `Poseidon should be integer in a range 1..6. Poseidon size provided: ${size}`
      );
    }
  });

  const deployPoseidon = async (ethers: any, params: number) => {
    const abi = poseidonContract.generateABI(params);
    const code = poseidonContract.createCode(params);
    const PoseidonElements = new ethers.ContractFactory(abi, code, deployer);
    const poseidonElements = await PoseidonElements.deploy();
    await poseidonElements.deployed();
    console.log(`Poseidon${params}Elements deployed to:`, poseidonElements.address);
    return poseidonElements;
  };

  const result: Contract[] = [];
  for (const size of poseidonSizeParams) {
    result.push(await deployPoseidon(ethers, size));
  }

  return result;
}

export async function deployPoseidonFacade(ethers: any, account: any): Promise<Contract> {
  const poseidonContracts = await deployPoseidons(
      ethers,
      account,
      new Array(6).fill(6).map((_, i) => i + 1)
  );

  const spongePoseidon = await deploySpongePoseidon(ethers, poseidonContracts[5].address);

  const PoseidonFacade = await ethers.getContractFactory("PoseidonFacade", {
    libraries: {
      PoseidonUnit1L: poseidonContracts[0].address,
      PoseidonUnit2L: poseidonContracts[1].address,
      PoseidonUnit3L: poseidonContracts[2].address,
      PoseidonUnit4L: poseidonContracts[3].address,
      PoseidonUnit5L: poseidonContracts[4].address,
      PoseidonUnit6L: poseidonContracts[5].address,
      SpongePoseidon: spongePoseidon.address,
    },
  });

  const poseidonFacade = await PoseidonFacade.deploy();
  await poseidonFacade.deployed();
  console.log("PoseidonFacade deployed to:", poseidonFacade.address);
  return poseidonFacade;
}
