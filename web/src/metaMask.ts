import { ethers } from "ethers";

export async function connectMetaMask() {
  if (typeof window.ethereum === "undefined") {
    throw new Error("MetaMask is not installed");
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });

    const signer = new ethers.providers.Web3Provider(window.ethereum).getSigner();
    console.log(signer)
    return signer;
  } catch (err) {
    console.error(err);
  }
}

