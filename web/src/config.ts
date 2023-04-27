import * as spongePoseidonContract from "../../artifacts/contracts/libs/Poseidon.sol/SpongePoseidon.json";
import * as tokenRegistryContract from "../../artifacts/contracts/TokenRegistry.sol/TokenRegistry.json";
import * as rollupContract from "../../artifacts/contracts/Rollup.sol/Rollup.json";
import * as testTokenContract from "../../artifacts/contracts/TestToken.sol/TestToken.json";
import * as SMT from "../../artifacts/contracts/SMT.sol/SMT.json";
import * as defaultContractFile from "../../.contract.json";


// export const defaultAccountFile = path.join(__dirname, "../.account.json")
export const defaultCircuitPath = "../circuits/";
export const defaultServerEndpoint = "http://127.0.0.1:3000";

export { defaultContractFile };

export const defaultContractABI = {
  spongePoseidonContractABI: spongePoseidonContract.abi,
  tokenRegistryContractABI: tokenRegistryContract.abi,
  rollupContractABI: rollupContract.abi,
  testTokenContractABI: testTokenContract.abi,
  smtVerifierContractABI: SMT.abi
};

// export const accountFile = (alias) => {
//     return `${defaultAccountFile}.${alias}`;
// }
