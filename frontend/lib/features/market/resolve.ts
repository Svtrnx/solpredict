"use client";

import type { InstructionWithEphemeralSigners } from "@pythnetwork/pyth-solana-receiver";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { resolveMarketIx } from "@/lib/services/market/marketService";
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  AccountMeta,
  VersionedTransaction,
} from "@solana/web3.js";

import { Buffer } from "buffer";

// ─────────────────────────────────────────────────────────────
// Shims
// ─────────────────────────────────────────────────────────────
declare global {
  interface Window { Buffer: typeof Buffer }
}
let PYTH_SHIMS_INSTALLED = false;
function installPythShimsOnce() {
  if (PYTH_SHIMS_INSTALLED) return;
  PYTH_SHIMS_INSTALLED = true;
  if (typeof window === "undefined") return;

  if (!(window as any).Buffer) (window as any).Buffer = Buffer;

  const B: any = Buffer.prototype as any;
  if (!B.readUint8) B.readUint8 = B.readUInt8;
  if (!B.readUint16BE) B.readUint16BE = B.readUInt16BE;
  if (!B.readUint32BE) B.readUint32BE = B.readUInt32BE;
  if (!B.readBigUint64BE) {
    if ((B as any).readBigUInt64BE) B.readBigUint64BE = (B as any).readBigUInt64BE;
    else B.readBigUint64BE = function (offset = 0) {
      const hi = BigInt(this.readUInt32BE(offset));
      const lo = BigInt(this.readUInt32BE(offset + 4));
      return (hi << BigInt(32)) | lo;
    };
  }

  const U8P: any = Uint8Array.prototype as any;
  const dv = (u8: Uint8Array, off = 0, len = 8) =>
    new DataView(u8.buffer, u8.byteOffset + off, Math.min(len, u8.byteLength - off));
  if (!U8P.readUint8) U8P.readUint8 = function (o = 0) { return this[o] as number; };
  if (!U8P.readUint16BE) U8P.readUint16BE = function (o = 0) { return dv(this, o, 2).getUint16(0, false); };
  if (!U8P.readUint32BE) U8P.readUint32BE = function (o = 0) { return dv(this, o, 4).getUint32(0, false); };
  if (!U8P.readBigUint64BE) U8P.readBigUint64BE = function (o = 0) {
    const view = dv(this, o, 8);
    if (typeof view.getBigUint64 === "function") return view.getBigUint64(0, false);
    const hi = BigInt(view.getUint32(0, false));
    const lo = BigInt(view.getUint32(4, false));
    return (hi << BigInt(32)) | lo;
  };
}

// ─────────────────────────────────────────────────────────────
type IxAccountMetaJson = { pubkey: string; is_signer: boolean; is_writable: boolean };
type IxJson = { program_id: string; accounts: IxAccountMetaJson[]; data_b64: string };

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function ixFromJson(
  j: IxJson,
  opts?: {
    override?: { idx: number; pubkey: PublicKey; forceIsSignerFalse?: boolean };
    forceSignerFalseByPubkey?: Set<string>; // base58
  }
): TransactionInstruction {
  const programId = new PublicKey(j.program_id);
  const keys: AccountMeta[] = j.accounts.map((a, i) => {
    const isOverride = !!opts?.override && opts!.override!.idx === i;
    const pk = isOverride ? opts!.override!.pubkey : new PublicKey(a.pubkey);
    const pkStr = pk.toBase58();
    const forceFalse =
      (isOverride && opts!.override!.forceIsSignerFalse === true) ||
      (opts?.forceSignerFalseByPubkey?.has(pkStr) ?? false) ||
      pkStr === "11111111111111111111111111111111" ||
      pkStr === "Sysvar1111111111111111111111111111111111";

    return { pubkey: pk, isSigner: forceFalse ? false : a.is_signer, isWritable: a.is_writable };
  });
  const data = Buffer.from(j.data_b64, "base64");
  return new TransactionInstruction({ programId, keys, data });
}

async function signOneTx(
  connection: Connection,
  wallet: WalletContextState,
  wrap: { tx: VersionedTransaction; signers?: Array<{ publicKey: PublicKey; secretKey: Uint8Array }> },
  label: string
): Promise<string> {
  let signed = await wallet.signTransaction!(wrap.tx as any);
  if (wrap.signers?.length) {
    const vtx: any = signed as any;
    if (typeof vtx.sign === "function") vtx.sign(wrap.signers);
    else if (typeof vtx.partialSign === "function") vtx.partialSign(...wrap.signers);
    else throw new Error(`[${label}] neither sign() nor partialSign() present`);
  }
  const sigsArr: Uint8Array[] = (signed as any).signatures ?? [];
  for (let i = 0; i < sigsArr.length; i++) {
    const s = sigsArr[i];
    if (!s || s.length !== 64 || s.every((b: number) => b === 0)) {
      throw new Error(`[${label}] missing/zero signature at index ${i}`);
    }
  }
  const sig = await connection.sendRawTransaction((signed as any).serialize(), { skipPreflight: false });
  return sig;
}

// ─────────────────────────────────────────────────────────────
export async function resolveMarketWithPyth(opts: {
  connection: Connection;
  walletAdapter: WalletContextState;
  marketPda: string;
  cuPriceMicroLamports?: number;
  closeUpdateAccounts?: boolean;
}): Promise<string[]> {
  const {
    connection,
    walletAdapter,
    marketPda,
    cuPriceMicroLamports = 50_000,
    closeUpdateAccounts = false,
  } = opts;
  
  if (!walletAdapter?.publicKey) throw new Error("Wallet not connected");
  if (!walletAdapter?.signTransaction) throw new Error("Wallet lacks signTransaction()");

  installPythShimsOnce();

  // import SDK after shims
  const { toAnchorWallet } = await import("@/lib/solana/anchorWalletAdapter");
  const { HermesClient } = await import("@pythnetwork/hermes-client");
  const { PythSolanaReceiver } = await import("@pythnetwork/pyth-solana-receiver");

  const anchorWallet = toAnchorWallet(walletAdapter);

  // ix bundle form backend
  const bundle = await resolveMarketIx({ market_pda: marketPda });
  if (!bundle?.ok || !bundle.instructions?.length) {
    throw new Error(`Backend not ok: ${bundle?.message ?? "no instructions"}`);
  }

  const hermes = new HermesClient("https://hermes.pyth.network", {});
  const resp = await hermes.getPriceUpdatesAtTimestamp(bundle.end_ts, [bundle.feed_id_hex], { encoding: "base64"});

  const priceUpdateData: string[] = resp?.binary?.data ?? [];
  if (!priceUpdateData.length) throw new Error("Hermes returned empty price updates");

  // Receiver
  const receiver = new PythSolanaReceiver({ connection, wallet: anchorWallet });

  // POST updates
  const postBuilder = receiver.newTransactionBuilder({ closeUpdateAccounts: false });
  await postBuilder.addPostPriceUpdates(priceUpdateData);
  const priceUpdatePubkey = postBuilder.getPriceUpdateAccount(bundle.feed_id_hex);
  const postWraps = await postBuilder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: cuPriceMicroLamports,
  });

  const sigs: string[] = [];
  for (let i = 0; i < postWraps.length; i++) {
    const sig = await signOneTx(connection, walletAdapter, postWraps[i], `post[${i}]`);
    await connection.confirmTransaction(sig, "confirmed");
    sigs.push(sig);
  }

  // RESOLVE
  const resolveBuilder = receiver.newTransactionBuilder({ closeUpdateAccounts });
  const makeConsumers = (priceUpdatePk: PublicKey) => async (): Promise<InstructionWithEphemeralSigners[]> => {
    const out: InstructionWithEphemeralSigners[] = [];
    const forceFalse = new Set<string>([bundle.market_id]); // market PDA NOT signer
    for (const j of bundle.instructions) {
      const acc = j.accounts?.[bundle.price_update_index];
      const isPlaceholder =
        !!acc &&
        (acc.pubkey === "11111111111111111111111111111111" ||
         acc.pubkey === "Sysvar1111111111111111111111111111111111");
      const override = isPlaceholder
        ? { idx: bundle.price_update_index, pubkey: priceUpdatePk, forceIsSignerFalse: true }
        : undefined;

      out.push({ instruction: ixFromJson(j, { override, forceSignerFalseByPubkey: forceFalse }), signers: [] });
    }
    return out;
  };
  await resolveBuilder.addPriceConsumerInstructions(makeConsumers(priceUpdatePubkey));

  const [resolveWrap] = await resolveBuilder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: cuPriceMicroLamports,
  });

  // local simulation to catch errors early
  try {
    await connection.simulateTransaction(resolveWrap.tx as any, {
      sigVerify: false,
      replaceRecentBlockhash: false,
    });
  } catch { /* ignore */ }

  const resolveSig = await signOneTx(connection, walletAdapter, resolveWrap, "resolve");
  await connection.confirmTransaction(resolveSig, "confirmed");
  sigs.push(resolveSig);

  return sigs;
}
