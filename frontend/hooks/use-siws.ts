// hooks/useSiws.ts
import { useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getNonce, verifySiws } from "@/lib/services/auth/siwsService";

type BytesLike = Uint8Array | ArrayBuffer | ArrayBufferView;
function asU8(v: BytesLike) { if (v instanceof Uint8Array) return v; if (v instanceof ArrayBuffer) return new Uint8Array(v); if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength); throw new TypeError(`Expected bytes-like, got ${Object.prototype.toString.call(v)}`); }
function unwrapSignIn<T = any>(raw: T): any { const x = Array.isArray(raw) ? raw[0] : raw; return (x as any)?.result ?? (x as any)?.output ?? (x as any)?.value ?? x; }

type SolanaSignInInput = { domain: string; uri?: string; statement?: string; nonce: string; version?: string; issuedAt?: string; expirationTime?: string; };

function buildSiwsMessage(params: Required<SolanaSignInInput> & { address: string }) {
  const { domain, address, statement, uri, version, nonce, issuedAt, expirationTime } = params;
  return (
    `${domain} wants you to sign in with your Solana account:\n` +
    `${address}\n\n` +
    `${statement}\n\n` +
    `URI: ${uri}\n` +
    `Version: ${version}\n` +
    `Nonce: ${nonce}\n` +
    `Issued At: ${issuedAt}\n` +
    `Expiration Time: ${expirationTime}`
  );
}

export function useSiws() {
  const { wallet, publicKey, connected } = useWallet();
  const inFlightRef = useRef<Promise<boolean> | null>(null);

  async function signIn(): Promise<boolean> {
    if (!wallet) throw new Error("Wallet not connected");
    if (!publicKey) {
      if (typeof (wallet.adapter as any)?.connect === "function") {
        await (wallet.adapter as any).connect();
      }
    }
    if (inFlightRef.current) return inFlightRef.current;

    const p: Promise<boolean> = (async () => {
      try {
        const { nonce, ttl, ttlSec, ttl_sec } = await getNonce();
        const ttlSeconds = Number(ttl ?? ttlSec ?? ttl_sec ?? 300);
        const issuedAt = new Date().toISOString();
        const expirationTime = new Date(Date.now() + ttlSeconds * 1000).toISOString();

        const input: Required<SolanaSignInInput> = {
          domain: window.location.host,
          uri: window.location.origin,
          statement: "Sign in to SolPredict.",
          nonce,
          version: "1",
          issuedAt,
          expirationTime,
        };

        // --- Wallet Standard ---
        // @ts-ignore
        const feature = (wallet.adapter as any)?.wallet?.features?.["solana:signIn"];
        if (feature && typeof feature.signIn === "function") {
          if (!connected && typeof (wallet.adapter as any)?.connect === "function") {
            await (wallet.adapter as any).connect();
          }
          const raw = await feature.signIn(input);
          const out = unwrapSignIn(raw);

          const pkBytes =
            out?.account?.publicKey
              ? asU8(out.account.publicKey as BytesLike)
              : publicKey
              ? new Uint8Array(publicKey.toBytes())
              : null;

          if (!pkBytes || !out?.signedMessage || !out?.signature) {
            throw new Error("Wallet returned incomplete signIn output");
          }

          const payload = {
            account: { publicKey: Array.from(pkBytes) },
            signedMessage: Array.from(asU8(out.signedMessage as BytesLike)),
            signature: Array.from(asU8(out.signature as BytesLike)),
          };
          await verifySiws(payload);
          return true;
        }

        // --- Fallback for Solflare and other without `solana:signIn` ---
        const address = (publicKey ?? (wallet.adapter as any)?.publicKey)?.toBase58?.();
        if (!address) throw new Error("No public key available");

        const messageStr = buildSiwsMessage({ ...input, address });
        const messageBytes = new TextEncoder().encode(messageStr);

        // New Wallet Standard
        // @ts-ignore
        const stdSign = (wallet.adapter as any)?.wallet?.features?.["standard:signMessage"]?.signMessage;
        if (typeof stdSign === "function") {
          const res = unwrapSignIn(await stdSign({ message: messageBytes }));
          const sig = asU8(res?.signature ?? res);
          const pkBytes = new Uint8Array((publicKey as any).toBytes());

          await verifySiws({
            account: { publicKey: Array.from(pkBytes) },
            signedMessage: Array.from(messageBytes),
            signature: Array.from(sig),
          });
          return true;
        }

        // classical adapter method
        if (typeof (wallet.adapter as any)?.signMessage === "function") {
          if (!connected && typeof (wallet.adapter as any)?.connect === "function") {
            await (wallet.adapter as any).connect();
          }
          const sig: Uint8Array = await (wallet.adapter as any).signMessage(messageBytes);
          const pkBytes = new Uint8Array((publicKey as any).toBytes());

          await verifySiws({
            account: { publicKey: Array.from(pkBytes) },
            signedMessage: Array.from(messageBytes),
            signature: Array.from(sig),
          });
          return true;
        }

        throw new Error(
          "Wallet does not support `solana:signIn` or message signing. Try Phantom or enable signMessage."
        );
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = p;
    return p;
  }

  return { signIn };
}