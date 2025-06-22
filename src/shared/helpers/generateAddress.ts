import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export function createUmiWallet() {
  const keypair = new Ed25519Keypair();
  const publicKey = keypair.getPublicKey();

  // Bech32-encoded secret key string
  const privateKey = keypair.getSecretKey();
  const address = publicKey.toSuiAddress();

  return {
    address,
    privateKey,
  };
}
