import { useState } from "react";
import "./App.css";
import { connectMetaMask } from "./metaMask";
import { ethers } from "ethers";
import useInitializeSecretSDK from "./SecretSDK";
import { createSecretAccount } from "./account";
import { rawMessage, signEOASignature } from "@eigen-secret/core/dist-browser/utils";
import { defaultContractABI } from "./config";
import { Buffer } from "buffer";
import { SecretAccount } from "@eigen-secret/core/dist-browser/account";
import { buildEddsa } from "circomlibjs";
import createBlakeHash from "blake-hash";

const assetId = 2
const Alice = "Alice"
const AliceAccount = "CKCRW1G+fKMxEVg9fKukRPitQFq4X7qNYZRk/BGfQBRkUYzsjUrNavs6jnttApm8qNZ0g45df4pr05syJZsVGj8bf5M6ERJYcgvE3U2w6iwfe53jkx9m724MCsB0MincSvdTDSAErxn80XRjvX6qaIBhU7sdcJ9ZUiJus6ZOpMM7jQCDaefVyx5h8cJagc8UX6IlsDjM6zZQuH3/OgDLKCMO2nPyJntinS9lWsBmHIRLmgQxSfpvRkbcSmdDSaRXBbkqYkOpH8O1RrK/uYw2+FyefHUkb1Zob/1GD0aooQqAg/pB4uFuQkdIPAuXKVmFhnZM8Zv8Ja9wDKaOV+dZHVhx8ciMIFgVydnpzhkRmB5mtZ+WNziujL0Klqg9GGEKnzWVdKwkCmOIth+pt6qVhHLqEJf+jc9wdTQSEq80Yvk=,1c8eed5455318bcf7c461f3e,f03ae7106aa3dbae77bb2d2b16814416";

const TOKEN = "0x0165878A594ca255338adfa4d48449f69242Eb8F"

const BobAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

function App() {
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [secretSDK, initializeSecretSDK] = useInitializeSecretSDK(Alice, signer, AliceAccount);


  const handleConnectMetaMask = async () => {
    const newSigner = await connectMetaMask();
    setSigner(newSigner);
    await getAddress(newSigner);
  };

  const getAddress = async (currentSigner: ethers.Signer | null) => {
    if (currentSigner) {
      const newAddress = await currentSigner.getAddress();
      setAddress(newAddress);
    }
  };

  const handleCreateSecretAccount = async () => {
    if (!signer || !address || !secretSDK) {
      return;
    }
    const proof = await createSecretAccount(signer, address, secretSDK, "Anonymous");
    setProof(proof);
  };

  const getBalance = async () => {
    const timestamp = Math.floor(Date.now()/1000).toString();

    const signature = await signEOASignature(signer, rawMessage, address, Alice, timestamp);

    const ctx = {
      alias: Alice,
      ethAddress: address, // hardhat node address
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature
    };

    let balance = await secretSDK.getNotesValue(ctx, assetId);
    console.log("L2 balance", balance.toString());

    const secretAddress = await secretSDK.getRegisteredToken(BigInt(assetId));
    const tokenIns = new ethers.Contract(
      secretAddress,
      defaultContractABI.testTokenContractABI,
      signer
    );

    balance = await tokenIns.balanceOf(address);
    console.log("L1 balance", balance.toString());
  }

  const deposit = async (value: number) => {
    const timestamp = Math.floor(Date.now()/1000).toString();

    const signature = await signEOASignature(signer, rawMessage, address, Alice, timestamp);

    const eddsa = await buildEddsa();

    const key = createBlakeHash("blake256").update(Buffer.from('<your password>')).digest();
    const sa = SecretAccount.deserialize(eddsa, key, AliceAccount); // .account.json.Alice

    const ctx = {
      alias: Alice,
      ethAddress: address,
      rawMessage: rawMessage,
      timestamp: timestamp,
      signature: signature
    };

    const nonce = 0; // TODO: get nonce from Metamask
    const receiver = sa.accountKey.pubKey.pubKey;

    // get tokenAddress by asset id
    const tokenAddress = await secretSDK.getRegisteredToken(BigInt(assetId)) // todo return 0x0000000000000000000000000000000000000000
    console.log("token", tokenAddress.toString());

    // approve
    const approveTx = await secretSDK.approve(tokenAddress.toString(), value);
    await approveTx.wait();

    const proofAndPublicSignals = await secretSDK.deposit(ctx, receiver, BigInt(value), Number(assetId), nonce);
    console.log(proofAndPublicSignals);
  }

  const sendL1 = async (value: number) => {
    // const [admin] = await ethers.getSigners();
    const admin = signer;

    // get token address
    const tokenAddress = await secretSDK.getRegisteredToken(BigInt(assetId));
    const tokenIns = new ethers.Contract(
      tokenAddress,
      defaultContractABI.testTokenContractABI,
      admin
    );

    const tx = await tokenIns.transfer(BobAddress, BigInt(value));
    await tx.wait();

    const balance = await tokenIns.balanceOf(BobAddress);
    console.log("sendL1 balance", balance.toString());
  }

  const setupRollup = async () => {
    await secretSDK.setRollupNC();
  }

  const registerToken = async () => {
    await secretSDK.registerToken(TOKEN);
    console.log("register token done")
    const assetId = await secretSDK.approveToken(TOKEN);
    console.log("approve token done, assetId is", assetId.toString())
  }

  return (
    <>
      <div className="card">
        {signer ? (
          <p>
            MetaMask connected, current account address:
            {address}
          </p>
        ) : (
          <button onClick={handleConnectMetaMask}>Connect MetaMask</button>
        )}
      </div>

      <div className="card">
        {secretSDK ? (
          <p>Alice SecretSDK initialized</p>
        ) : (
          <button onClick={initializeSecretSDK}>Initialize Alice SecretSDK</button>
        )}
      </div>

      <div className="card">
        <button onClick={setupRollup}>setup-rollup</button>
      </div>

      <div className="card">
        <button onClick={registerToken}>register-token for assetId 2</button>
      </div>

      <div className="card">
        <button onClick={() => deposit(10)}>Alice deposit value 10</button>
      </div>

      <div className="card">
        <button onClick={() => sendL1(100)}>Alice send L1 to receiver Bob with value 100</button>
      </div>

      <div className="card">
        <button onClick={getBalance}>Alice getBalance</button>
      </div>

      <div className="card">
        {proof ? (
          <>
            <p>createSecretAccount:</p>
            <p>{proof}</p>
          </>
        ) : (
          <button onClick={handleCreateSecretAccount}>Create Secret Account For Anonymous</button>
        )}
      </div>
    </>
  );
}

export default App;
