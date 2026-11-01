'use client';

import { PrimeReactProvider, PrimeReactStyleSheet } from '@primereact/core';
import { useServerInsertedHTML } from 'next/navigation';
import { useState } from 'react';
import { primeReactConfig } from '@/theme';

/** Collects the library's styles during server rendering so the first paint is already styled. */
export function PrimeProvider({ children }: { children: React.ReactNode }) {
  const [styleSheet] = useState(() => new PrimeReactStyleSheet());
  useServerInsertedHTML(() => {
    const styles = styleSheet.getAllElements();
    styleSheet.clear();
    return <>{styles}</>;
  });
  return (
    <PrimeReactProvider
      {...primeReactConfig}
      license={process.env.NEXT_PUBLIC_PRIMEUI_LICENSE}
      stylesheet={styleSheet}
    >
      {children}
    </PrimeReactProvider>
  );
}
