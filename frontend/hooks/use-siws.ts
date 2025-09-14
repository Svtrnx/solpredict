// hooks/useSiws.ts
import { useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getNonce, verifySiws } from "@/lib/services/auth/siwsService";

type BytesLike = Uint8Array | ArrayBuffer | ArrayBufferView;
function asU8(v: BytesLike) { if (v instanceof Uint8Array) return v; if (v instanceof ArrayBuffer) return new Uint8Array(v); if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength); throw new TypeError(`Expected bytes-like, got ${Object.prototype.toString.call(v)}`); }
function unwrapSignIn<T = any>(raw: T): any { const x = Array.isArray(raw) ? raw[0] : raw; return (x as any)?.result ?? (x as any)?.output ?? (x as any)?.value ?? x; }

type SolanaSignInInput = { domain: string; uri?: string; statement?: string; nonce: string; version?: string; issuedAt?: string; expirationTime?: string; };

export function useSiws()
{
  const { wallet, publicKey, connected } = useWallet();

  const inFlightRef = useRef<Promise<boolean> | null>(null);

  async function signIn(): Promise<boolean>
  {
    if (!wallet) throw new Error("Wallet not connected");

    if (inFlightRef.current) return inFlightRef.current;

    const p: Promise<boolean> = (async () =>
    {
      try
      {
        const { nonce, ttlSec, ttl, ttl_sec } = await getNonce();
        const ttlSeconds = Number(ttl ?? ttlSec ?? ttl_sec ?? 300);
        const issuedAt = new Date().toISOString();
        const expirationTime = new Date(Date.now() + ttlSeconds * 1000).toISOString();

        const input = {
          domain: window.location.host,
          uri: window.location.origin,
          statement: "Sign in to SolPredict.",
          nonce,
          version: "1",
          issuedAt,
          expirationTime,
        };

        // @ts-ignore
        const feature = (wallet.adapter as any)?.wallet?.features?.["solana:signIn"];
        if (!feature || typeof feature.signIn !== "function")
        {
          throw new Error("Wallet does not expose Wallet Standard `solana:signIn` feature");
        }
        if (!connected && typeof (wallet.adapter as any)?.connect === "function")
        {
          await (wallet.adapter as any).connect();
        }

        const raw = await feature.signIn(input);
        const out = unwrapSignIn(raw);

        const pk =
          out?.account?.publicKey
            ? asU8(out.account.publicKey as BytesLike)
            : publicKey
              ? new Uint8Array(publicKey.toBytes())
              : null;

        if (!pk || !out?.signedMessage || !out?.signature)
        {
          throw new Error("Wallet returned incomplete signIn output");
        }

        const payload = {
          account: { publicKey: Array.from(asU8(pk)) },
          signedMessage: Array.from(asU8(out.signedMessage as BytesLike)),
          signature: Array.from(asU8(out.signature as BytesLike)),
        };

        await verifySiws(payload);
        return true; 
      } finally
      {
        inFlightRef.current = null; 
      }
    })();

    inFlightRef.current = p;
    return p;
  }

  return { signIn };
}