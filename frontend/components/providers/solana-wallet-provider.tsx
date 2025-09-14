"use client"

import { ReactNode, useMemo } from "react"
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets"
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
import { clusterApiUrl } from "@solana/web3.js"

import "@solana/wallet-adapter-react-ui/styles.css"

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const network = WalletAdapterNetwork.Devnet
  const endpoint = clusterApiUrl(network)

  const wallets = useMemo(() => [new PhantomWalletAdapter({ network })], [network])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
