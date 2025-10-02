import { Buffer } from "buffer";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Transaction, VersionedTransaction, Connection } from "@solana/web3.js";

function decodeTx(b64: string): Transaction | VersionedTransaction {
  if (!b64 || typeof b64 !== "string") {
    throw new Error("Empty tx: server didn't return base64 string");
  }
  const bytes = Buffer.from(b64, "base64");
  try { return Transaction.from(bytes); }
  catch { return VersionedTransaction.deserialize(bytes); }
}

export async function signAndSendBase64Tx(
  b64: string,
  wallet: WalletContextState,
  connection: Connection
): Promise<string> {
  if (!wallet.signTransaction) throw new Error("Wallet does not support signTransaction()");
  if (!wallet.publicKey) throw new Error("Wallet not connected");

  const tx = decodeTx(b64);
  const signed = await wallet.signTransaction(tx as any);
  const raw = (signed as any).serialize();

  const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
  return sig;
}