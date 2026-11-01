import { describe, expect, it } from 'vitest';
import { kindLooks, priorityLooks, sourceLooks, statusLooks } from './labels';

describe('tag looks', () => {
  it.each([
    ['status', statusLooks],
    ['kind', kindLooks],
    ['priority', priorityLooks],
    ['source', sourceLooks],
  ])('every %s value has text, severity and symbol', (_name, looks) => {
    for (const look of Object.values(looks)) {
      expect(look.label.length).toBeGreaterThan(0);
      expect(look.severity.length).toBeGreaterThan(0);
      expect(look.symbol.length).toBeGreaterThan(0);
    }
  });
});
