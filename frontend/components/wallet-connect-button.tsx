"use client";

import { useCallback, useMemo, useEffect, useRef, useState } from "react";

import { Wallet, Loader2, LogOut, ChevronDown, KeyRound } from "lucide-react";

import { disconnectWallet as disconnectWalletAction, updateBalance, setAuthorized, setConnecting } from "@/lib/features/wallet/walletSlice";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useAuthSession } from "@/hooks/use-auth-session";
import { Button } from "@/components/ui/button";
import { PublicKey } from "@solana/web3.js";
import { useSiws } from "@/hooks/use-siws";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";


export function shortenAddress(
  input: string | PublicKey | null | undefined,
  start = 4,
  end = 4
): string {
  const base58 = typeof input === 'string' ? input : input?.toBase58();
  if (!base58) return '';
  if (base58.length <= start + end + 1) return base58;
  return `${base58.slice(0, start)}…${base58.slice(-end)}`;
}

export function useShortAddress(
  input: string | PublicKey | null | undefined,
  start = 4,
  end = 4
) {
  return useMemo(() => shortenAddress(input, start, end), [input, start, end]);
}

async function fetchSplBalanceByMint(connection: any, ownerPk: PublicKey, mintStr: string) {
  const mint = new PublicKey(mintStr);
  const ata = await getAssociatedTokenAddress(
    mint,
    ownerPk,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const info = await connection.getTokenAccountBalance(ata).catch(() => null);
  // If ATA is not created or is empty, there will be an error/zero balance.
  if (!info) return { uiAmount: 0, decimals: undefined as number | undefined };
  return { uiAmount: info.value.uiAmount ?? 0, decimals: info.value.decimals };
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}


export function WalletConnectButton({ className = "" }) {
  const dispatch = useAppDispatch();
  const mounted = useMounted();

  const { connection } = useConnection(); 
  const { setVisible } = useWalletModal();
  const { signIn } = useSiws();

  const { connected, connecting, publicKey, disconnect } = useWallet();
  const { balance } = useAppSelector((s) => s.wallet);
  const { user, status, refresh } = useAuthSession();
  
  const [wantSiws, setWantSiws] = useState(false);
  const signingRef = useRef(false);                  
  const lastOkAddrRef = useRef<string | null>(null);
  
  const [uiReady, setUiReady] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const short4  = useShortAddress(publicKey, 4, 4);
  const short12 = useShortAddress(publicKey, 12, 12);

  const waitingAutoConnect = !uiReady;
  const sessionReady =
    status === "authenticated" &&
    !!publicKey &&
    user?.walletAddress === publicKey?.toBase58();

  useEffect(() => {
    if (!mounted) return;
    const hasStored = typeof window !== 'undefined' && !!localStorage.getItem('walletAdapter');

    if (connected || !hasStored) { setUiReady(true); return; }
    const t = setTimeout(() => setUiReady(true), 400);
    return () => clearTimeout(t);
  }, [mounted, connected]);


  useEffect(() => {
    if (!publicKey) {
      // no key: we don't write 0, but simply consider the balance to be “unknown” for now
      setBalanceLoading(false);
      dispatch(updateBalance(undefined as any));
      return;
    }
    (async () => {
      try {
        setBalanceLoading(true);
        const res = await fetchSplBalanceByMint(connection, publicKey, `${process.env.NEXT_PUBLIC_PREDICT_USDC_MINT}`);
        dispatch(updateBalance(Number(res.uiAmount ?? 0)));
      } catch (e) {
        console.error("Failed to load balance:", e);
        dispatch(updateBalance(0));
      } finally {
        setBalanceLoading(false);
      }
    })();
  }, [publicKey, connection, dispatch]);

  useEffect(() => {
    if (
      status === "authenticated" &&
      publicKey &&
      user?.walletAddress === publicKey.toBase58()
    ) {
      dispatch(setAuthorized(true));
      dispatch(setConnecting(false));
    } else {
      dispatch(setConnecting(false));
      dispatch(setAuthorized(false));
    }
  }, [status, user?.walletAddress, publicKey, dispatch]);


  const handleConnect = useCallback(() => {
    // open wallet modal and ask to run SIWS after connect
    setWantSiws(true);
    setVisible(true);
  }, [setVisible]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
    } finally {
      lastOkAddrRef.current = null;
      dispatch(disconnectWalletAction());
      void refresh(); // refresh /auth/me
    }
  }, [disconnect, dispatch, refresh]);

  const handleSignIn = useCallback(async () => {
    if (signingRef.current) return;
    signingRef.current = true;
    try {
      await signIn();   // nonce + wallet signIn + verify
      lastOkAddrRef.current = publicKey?.toBase58() ?? null;
      await refresh();  // pull /auth/me
    } catch (e) {
      console.error(e);
    } finally {
      signingRef.current = false;
    }
  }, [signIn, refresh, publicKey]);

  // Auto-SIWS once after connect
  useEffect(() => {
    if (!wantSiws || !connected || !publicKey) return;

    const nowPk = publicKey.toBase58();
    if (sessionReady || lastOkAddrRef.current === nowPk) {
      setWantSiws(false);
      return;
    }

    if (signingRef.current) return;

    signingRef.current = true;
    (async () => {
      try {
        await signIn();
        lastOkAddrRef.current = nowPk;
        await refresh();
        dispatch(setAuthorized(true));
      } catch (e) {
        console.error(e);
        dispatch(setAuthorized(false));
      } finally {
        signingRef.current = false;
        setWantSiws(false);
      }
    })();
  }, [wantSiws, connected, publicKey, sessionReady, signIn, refresh]);
  
  if (!mounted || waitingAutoConnect) {
    return (
      <Button variant="ghost" size="default" disabled className="opacity-70">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Loading…</span>
        <span className="sm:hidden">…</span>
      </Button>
    );
  }
  if (connected && publicKey) {
    const label = sessionReady
      ? (balanceLoading ? (
          <span className="inline-flex items-center">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            <h2 className="text-gray-300">Fetching…</h2>
          </span>
        ) : `${balance ?? 0} USDC`)
      : "Sign in";
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="default" className={`group hover:bg-primary/5`}>
            <Wallet className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">
              {label}
            </span>
            <span className="sm:hidden">{short4 || "Connected"}</span>
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2 text-xs opacity-70">{short12}</div>

          {!sessionReady && (
            <DropdownMenuItem onClick={handleSignIn}>
              <KeyRound className="mr-2 h-4 w-4" />
              Sign In
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleDisconnect} className="text-red-500 focus:text-red-400">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect Wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Disconnected state UI
  return (
    <Button
      onClick={handleConnect}
      disabled={connecting}
      variant="default"
      size="default"
      className={`${className} bg-gradient-to-r from-purple-500/80 to-purple-600/80 hover:from-purple-500 hover:to-purple-600`}
    >
      {connecting ? (
        <Loader2 className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4 animate-spin" />
      ) : (
        <Wallet className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4 text-white" />
      )}
      <span className="hidden sm:inline text-white">
        {connecting ? "Connecting..." : "Connect Wallet"}
      </span>
      <span className="sm:hidden">{connecting ? "Connecting" : "Connect"}</span>
    </Button>
  );
}
