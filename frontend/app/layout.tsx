// app/layout.tsx (SERVER)
import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import type React from "react";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

import ClientRoot from "@/components/providers/client-root";

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
