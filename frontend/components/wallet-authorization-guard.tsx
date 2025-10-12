"use client"

import type React from "react"

import { Shield, AlertCircle, Lock, Zap, Network } from "lucide-react"
import { WalletConnectButton } from "./wallet-connect-button"

import { Card, CardContent } from "@/components/ui/card"
import { useAppSelector } from "@/lib/hooks"

interface WalletAuthorizationGuardProps {
  children: React.ReactNode
}

export function WalletAuthorizationGuard({ children }: WalletAuthorizationGuardProps) {
  const { isAuthorized, isConnecting } = useAppSelector((state) => state.wallet)

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
        <div className="absolute inset-0 radial-glow"></div>
        <div className="relative z-10 max-w-2xl mx-auto p-6">
          <Card className="glass glow text-center">
            <CardContent className="pt-12 pb-12">
              <div className="animate-spin w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full mx-auto mb-6"></div>
              <h2 className="text-2xl font-bold gradient-text mb-4">Connecting Wallet</h2>
              <p className="text-muted-foreground">Please wait while we establish a connection to your wallet...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
        <div className="absolute inset-0 radial-glow"></div>
        <div className="relative z-10 max-w-2xl mx-auto p-6">
          <Card className="glass glow text-center">
            <CardContent className="pt-12 pb-12">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
                <Shield className="w-10 h-10 text-purple-400" />
              </div>

              <h2 className="text-3xl font-bold gradient-text mb-4">Wallet Authorization Required</h2>
              <p className="text-lg text-muted-foreground mb-4 max-w-md mx-auto">
                To access your dashboard and start trading predictions, please connect your wallet.
              </p>

              <div className="flex items-center justify-center gap-2 mb-8">
                <img src="images/solana.svg" alt="Phantom" className="w-5 h-5" />
                <span className="text-sm text-purple-400 font-medium">Compatible with Solana Wallets</span>
              </div>

              <div className="space-y-4">
                <WalletConnectButton className="text-lg px-12 py-6" />

                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  <span>Your wallet will be used to sign transactions and manage your predictions</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                      <Lock className="w-4 h-4 text-green-400" />
                    </div>
                    <span className="text-green-400 font-medium">Secure</span>
                    <span className="text-muted-foreground text-xs">Your keys, your crypto</span>
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Zap className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-blue-400 font-medium">Fast</span>
                    <span className="text-muted-foreground text-xs">Solana-powered transactions</span>
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <Network className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-purple-400 font-medium">Decentralized</span>
                    <span className="text-muted-foreground text-xs">No central authority</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
