'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import { PrimeProvider } from './PrimeProvider';
import { Notifier } from '../ui/Notifier';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  return (
    <SessionProvider>
      <PrimeProvider>
        <QueryClientProvider client={client}>
          {children}
          <Notifier />
        </QueryClientProvider>
      </PrimeProvider>
    </SessionProvider>
  );
}
