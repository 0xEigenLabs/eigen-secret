import { ethers } from "ethers";
import { buildEddsa } from "circomlibjs";
import { signEOASignature, rawMessage } from "@eigen-secret/core/dist-browser/utils";
import { SigningKey, SecretAccount } from "@eigen-secret/core/dist-browser/account";

export const createSecretAccount = async (signer: ethers.Signer, address: string, secretSDK: any, alias: string) => {
  const eddsa = await buildEddsa();
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signature = await signEOASignature(signer, rawMessage, address, timestamp);

  const signingKey = new SigningKey(eddsa);
  const accountKey = new SigningKey(eddsa);
  const newSigningKey1 = new SigningKey(eddsa);
  const newSigningKey2 = new SigningKey(eddsa);

  const sa = new SecretAccount(alias, accountKey, signingKey, accountKey, newSigningKey1, newSigningKey2);

  const ctx = {
    alias,
    ethAddress: address,
    rawMessage,
    timestamp,
    signature,
  };
  const proofAndPublicSignals = await secretSDK.createAccount(ctx, sa.newSigningKey1, sa.newSigningKey2);
  return proofAndPublicSignals;
};
