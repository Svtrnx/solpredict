import type React from "react";
import type { Metadata } from "next";

import ClientRoot from "@/components/providers/client-root";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

import '@solana/wallet-adapter-react-ui/styles.css';
import '@solana/wallet-adapter-react-ui/styles.css';

const geistSans = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "SolPredict - Decentralized Prediction Markets",
  description: "Trade predictions on Solana blockchain",
  icons: { icon: "/images/solpredict.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased dark`}
    >
      <body suppressHydrationWarning>
        <ClientRoot>{children}</ClientRoot>
        <Toaster />
      </body>
    </html>
  );
}
