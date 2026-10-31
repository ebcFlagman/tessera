import { describe, expect, it } from 'vitest';
import { AppError, canTransition, validateTransition } from '../src';

describe('debt status transitions', () => {
  it.each([
    ['open', 'planned'],
    ['planned', 'in_progress'],
    ['in_progress', 'repaid'],
    ['open', 'accepted'],
    ['planned', 'accepted'],
    ['repaid', 'open'],
    ['accepted', 'open'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['repaid', 'planned'],
    ['repaid', 'in_progress'],
    ['in_progress', 'accepted'],
    ['accepted', 'repaid'],
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => validateTransition({ from, to })).toThrow(AppError);
  });

  it('treats an unchanged status as no transition', () => {
    expect(() => validateTransition({ from: 'open', to: 'open' })).not.toThrow();
  });

  it('requires a reason when accepting a debt (FR-019)', () => {
    expect(() => validateTransition({ from: 'open', to: 'accepted' })).toThrowError(/Begründung/);
    expect(() =>
      validateTransition({ from: 'open', to: 'accepted', acceptedReason: '  ' }),
    ).toThrow(AppError);
    expect(() =>
      validateTransition({ from: 'open', to: 'accepted', acceptedReason: 'Wird abgelöst' }),
    ).not.toThrow();
  });
});
