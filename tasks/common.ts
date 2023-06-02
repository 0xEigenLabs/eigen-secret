import spongePoseidonContract from "../artifacts/contracts/libs/Poseidon.sol/SpongePoseidon.json";
import tokenRegistryContract from "../artifacts/contracts/TokenRegistry.sol/TokenRegistry.json";
import rollupContract from "../artifacts/contracts/Rollup.sol/Rollup.json";
import testTokenContract from "../artifacts/contracts/TestToken.sol/TestToken.json";
import SMT from "../artifacts/contracts/SMT.sol/SMT.json";
import path from "path";

export const defaultContractFile = path.join(__dirname, "../.contract.json");
export const defaultAccountFile = path.join(__dirname, "../.account.json")
export const defaultCircuitPath = path.join(__dirname, "../circuits/");
export const defaultServerEndpoint = "http://127.0.0.1:3000";

export const defaultContractABI = {
    spongePoseidonContractABI: spongePoseidonContract.abi,
    tokenRegistryContractABI: tokenRegistryContract.abi,
    rollupContractABI: rollupContract.abi,
    testTokenContractABI: testTokenContract.abi,
    smtVerifierContractABI: SMT.abi
};

export const accountFile = (alias: string) => {
    return `${defaultAccountFile}.${alias}`;
}
