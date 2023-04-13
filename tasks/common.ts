import spongePoseidonContract from "../artifacts/contracts/libs/Poseidon.sol/SpongePoseidon.json";
import tokenRegistryContract from "../artifacts/contracts/TokenRegistry.sol/TokenRegistry.json";
import rollupContract from "../artifacts/contracts/Rollup.sol/Rollup.json";
import testTokenContract from "../artifacts/contracts/TestToken.sol/TestToken.json";

export const defaultContractFile = "../.contract.json";
export const defaultAccountFile = ".account.json"

export const defaultContractABI = {
    spongePoseidonContractABI: spongePoseidonContract.abi,
    tokenRegistryContractABI: tokenRegistryContract.abi,
    rollupContractABI: rollupContract.abi,
    testTokenContractABI: testTokenContract.abi
};

