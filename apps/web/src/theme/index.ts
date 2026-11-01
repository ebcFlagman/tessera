import type { PrimeReactProvider } from '@primereact/core';
import type { ComponentProps } from 'react';
import { DARK_MODE_SELECTOR, TesseraPreset } from './preset';
import { localeDe } from './locale-de';

/** Everything the PrimeReactProvider needs; the only place that wires look and texts together. */
export const primeReactConfig = {
  theme: { preset: TesseraPreset, options: { darkModeSelector: DARK_MODE_SELECTOR } },
  locale: 'de',
  locales: { de: localeDe } as unknown as NonNullable<
    ComponentProps<typeof PrimeReactProvider>
  >['locales'],
};
