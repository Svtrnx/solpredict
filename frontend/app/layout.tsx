import { Geist, Geist_Mono } from "next/font/google"
import type { Metadata } from "next"
import type React from "react"

import { SolanaWalletProvider } from "@/components/providers/solana-wallet-provider"
import { ReduxProvider } from "@/components/providers/redux-provider"
import { ScrollToTop } from "@/components/scroll-to-top"
import { Toaster } from "@/components/ui/sonner"
import { Navbar } from "@/components/navbar"
import "./globals.css"


const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "SolPredict - Decentralized Prediction Markets",
  description: "Trade predictions on Solana blockchain",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased dark`}>
      <body suppressHydrationWarning>
        <SolanaWalletProvider>
          <ReduxProvider>
            {/* <div className="blockchain-network">
              <div className="network-grid"></div>
              <div className="network-nodes">
                <div className="network-node"></div>
                <div className="network-node"></div>
                <div className="network-node"></div>
                <div className="network-node"></div>
                <div className="network-node"></div>
                <div className="network-node"></div>
                <div className="network-node"></div>
                <div className="network-node"></div>
                <div className="network-line"></div>
                <div className="network-line"></div>
                <div className="network-line"></div>
                <div className="network-line"></div>
                <div className="network-line"></div>
              </div>
            </div> */}
            <ScrollToTop />
            <Navbar />
            {children}
          </ReduxProvider>

        </SolanaWalletProvider>
        <Toaster  />
      </body>
    </html>
  )
}
