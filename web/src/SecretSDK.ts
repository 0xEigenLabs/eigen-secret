import { useState } from "react";
import { ethers } from "ethers";
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist-browser/account";
import { SecretSDK } from "@eigen-secret/core/dist-browser/sdk";
import { buildEddsa } from "circomlibjs";
import createBlakeHash from "blake-hash";
import { Buffer } from "buffer"


import {
  defaultCircuitPath,
  defaultContractABI,
  defaultServerEndpoint,
  defaultContractFile as contractJson
} from "./config";

function useInitializeSecretSDK(alias: string, signer: ethers.Signer, account: string) {
  const [secretSDK, setSecretSDK] = useState<SecretSDK | null>(null);

  const initializeSecretSDK = async () => {
    const eddsa = await buildEddsa();

    const key = createBlakeHash("blake256").update(Buffer.from('<your password>')).digest();
    const sa = SecretAccount.deserialize(eddsa, key, account); // .account.json.Alice

    const secretSDK = new SecretSDK(
      sa,
      defaultServerEndpoint,
      defaultCircuitPath,
      eddsa,
      signer,
      contractJson.spongePoseidon,
      contractJson.tokenRegistry,
      contractJson.poseidon2,
      contractJson.poseidon3,
      contractJson.poseidon6,
      contractJson.rollup,
      contractJson.smtVerifier
    );

    await secretSDK.initialize(defaultContractABI);
    setSecretSDK(secretSDK);
  };

  const handleInitializeSecretSDK = async () => {
    await initializeSecretSDK();
  };

  return [secretSDK, handleInitializeSecretSDK] as const;
}

export default useInitializeSecretSDK;

export async function signEOASignature(
  signer: ethers.Signer,
  rawMessage: string,
  userAddress: string,
  alias: string,
  timestamp: string
) {
  const message = {
    raw: rawMessage,
    userAddress: userAddress,
    alias: alias,
    timestamp: timestamp,
  };

  const messageBytes = ethers.utils.toUtf8Bytes(JSON.stringify(message));
  const messageHash = ethers.utils.keccak256(messageBytes);

  const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
  return signature;
}
