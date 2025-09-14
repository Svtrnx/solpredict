"use client";

import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wallet, Loader2, LogOut, ChevronDown, KeyRound } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { disconnectWallet as disconnectWalletAction } from "@/lib/features/wallet/walletSlice";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useSiws } from "@/hooks/use-siws";
import { useAuthSession } from "@/hooks/use-auth-session";

export function WalletConnectButton({ className = "" }) {
  const dispatch = useAppDispatch();
  const { connected, connecting, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { balance } = useAppSelector((s) => s.wallet);
  const { signIn } = useSiws();
  const { user, status, refresh } = useAuthSession();
  console.log('balance', balance)
  const shortAddress = useMemo(
    () => (publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : ""),
    [publicKey]
  );

    const sessionReady =
    status === "authenticated" &&
    !!publicKey &&
    user?.walletAddress === publicKey.toBase58();


  const [wantSiws, setWantSiws] = useState(false);
  const signingRef = useRef(false);                  
  const lastOkAddrRef = useRef<string | null>(null);
  useEffect(() => {
  console.log({
    status,
    apiUserAddr: user?.walletAddress,
    walletAddr: publicKey?.toBase58(),
    sessionReady
  });
}, [status, user?.walletAddress, publicKey, sessionReady]);

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
      } catch (e) {
        console.error(e);
      } finally {
        signingRef.current = false;
        setWantSiws(false);
      }
    })();
  }, [wantSiws, connected, publicKey, sessionReady, signIn, refresh]);

  if (connected && publicKey) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="default" className={`${className} group hover:bg-primary/5`}>
            <Wallet className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">
              {sessionReady ? `${balance ?? "0"} SOL` : "Sign in"}
            </span>
            <span className="sm:hidden">{shortAddress || "Connected"}</span>
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2 text-xs opacity-70">{shortAddress}</div>

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
