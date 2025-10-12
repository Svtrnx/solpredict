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

type TxResult =
  | { status: "success"; signature: string; message: string }
  | { status: "warning"; signature?: string; message: string }
  | { status: "error";   signature?: string; message: string };


function isSoftSimulationFailure(err: any): boolean {
  const m = String(err?.message ?? err).toLowerCase();
  if (m.includes("this transaction has already been processed")) return true;
  return false;
}

function errMsg(e: any): string {
  if (typeof e === "string") return e;
  if (e?.message) return String(e.message);
  return String(e);
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

export async function signAndSendBase64TxV2(
  b64: string,
  wallet: WalletContextState,
  connection: Connection,
): Promise<TxResult> {
  if (!wallet?.publicKey) {
    return { status: "error", message: "Wallet not connected" };
  }
  if (!wallet?.signTransaction) {
    return { status: "error", message: "Wallet does not support signTransaction()" };
  }

  let signature: string | undefined;

  try {
    const tx = decodeTx(b64);
    const signed = await wallet.signTransaction(tx as any);
    const raw =
      "serialize" in (signed as any)
        ? (signed as any).serialize()
        : (signed as VersionedTransaction).serialize();

    try {
      signature = await connection.sendRawTransaction(raw, { skipPreflight: false });
    } catch (e) {
      const soft = isSoftSimulationFailure(e);
      const message = errMsg(e);
      return soft
        ? { status: "warning", signature, message }
        : { status: "error",   signature, message };
    }

    const latest = await connection.getLatestBlockhash();
    try {
      await connection.confirmTransaction(
        { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight });
      return { status: "success", signature, message: "ok" };
    } catch (e) {
      const soft = isSoftSimulationFailure(e);
      const message = errMsg(e);
      return soft
        ? { status: "warning", signature, message }
        : { status: "error",   signature, message };
    }
  } catch (e) {
    const soft = isSoftSimulationFailure(e);
    const message = errMsg(e);
    return soft
      ? { status: "warning", signature, message }
      : { status: "error",   signature, message };
  }
}