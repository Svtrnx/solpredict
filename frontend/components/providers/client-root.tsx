'use client';

import { ReactNode } from 'react';
import { SolanaWalletProvider } from '@/components/providers/solana-wallet-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { ReduxProvider } from '@/components/providers/redux-provider';
import { ScrollToTop } from '@/components/scroll-to-top';
import { Navbar } from '@/components/navbar';

export default function ClientRoot({ children }: { children: ReactNode }) {
  return (
    <SolanaWalletProvider>
      <QueryProvider>
        <ReduxProvider>
          <ScrollToTop />
          <Navbar />
          {children}
        </ReduxProvider>
      </QueryProvider>
    </SolanaWalletProvider>
  );
}
