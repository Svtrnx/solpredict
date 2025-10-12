'use client';

import { ReactNode } from 'react';
import { SolanaWalletProvider } from '@/components/providers/solana-wallet-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { ReduxProvider } from '@/components/providers/redux-provider';
import { AuthSessionProvider } from '@/hooks/use-auth-session';
import { ScrollToTop } from '@/components/scroll-to-top';
import { Navbar } from '@/components/navbar';

export default function ClientRoot({ children }: { children: ReactNode }) {
  return (
    <SolanaWalletProvider>
      <QueryProvider>
         <AuthSessionProvider>
          <ReduxProvider>
            <ScrollToTop />
            <Navbar />
            {children}
          </ReduxProvider>
        </AuthSessionProvider>
      </QueryProvider>
    </SolanaWalletProvider>
  );
}
