import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

/**
 * The one place for Tessera's look (FR-013): neutral Aura base, indigo accent.
 * Change the accent by pointing `primary` at another palette, e.g. '{teal.500}'.
 */
export const TesseraPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
  },
});

/** Same selector the inline script in the root layout and the dashboard colours use. */
export const DARK_MODE_SELECTOR = ":root[data-theme='dark']";
