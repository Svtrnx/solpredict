import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { type Wallet as AnchorWallet } from "@coral-xyz/anchor";

export type AnchorWalletLike = AnchorWallet & { payer: unknown };

export function toAnchorWallet(wa: WalletContextState): AnchorWalletLike {
  if (!wa?.publicKey) throw new Error("Wallet not connected");
  if (!wa.signTransaction) throw new Error("Wallet does not support signTransaction()");

  const anchorWallet: AnchorWalletLike = {
    get publicKey(): PublicKey {
      return wa.publicKey!;
    },
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      return (await wa.signTransaction!(tx as any)) as T;
    },
    async signAllTransactions<T extends (Transaction | VersionedTransaction)[]>(txs: T): Promise<T> {
      if (wa.signAllTransactions) return (await wa.signAllTransactions(txs as any)) as T;
      const out: (Transaction | VersionedTransaction)[] = [];
      for (const t of txs) out.push(await this.signTransaction(t as any));
      return out as T;
    },
    get payer(): never {
      throw new Error("`payer` is only available in Node. Not used in browser.");
    },
  };

  return anchorWallet;
}
