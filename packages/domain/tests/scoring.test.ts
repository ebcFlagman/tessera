import { describe, expect, it } from 'vitest';
import {
  AppError,
  computePriority,
  defaultCriteria,
  effectivePriority,
  recomputeFromScores,
  validateCriteria,
  validateScores,
  type Criterion,
} from '../src';

const criteria: Criterion[] = [
  { key: 'impact', name: 'Auswirkung', weight: 2, direction: 'up' },
  { key: 'effort', name: 'Aufwand', weight: 1, direction: 'down' },
];

describe('computePriority', () => {
  it('normalises to 0–100: worst-case scores give 100, best-case 0', () => {
    expect(computePriority(criteria, { impact: 5, effort: 1 }).priority).toBe(100);
    expect(computePriority(criteria, { impact: 1, effort: 5 }).priority).toBe(0);
  });

  it('weights criteria and inverts "down" criteria (high effort lowers priority)', () => {
    // impact 5 -> 1.0 (w2), effort 5 -> 0.0 (w1): (2*1 + 1*0) / 3 = 66.7
    expect(computePriority(criteria, { impact: 5, effort: 5 }).priority).toBeCloseTo(66.7, 1);
    // impact 3 -> 0.5 (w2), effort 3 -> 0.5 (w1): 50
    expect(computePriority(criteria, { impact: 3, effort: 3 }).priority).toBe(50);
  });

  it('returns a derivation per criterion that adds up to the priority', () => {
    const result = computePriority(criteria, { impact: 5, effort: 5 });
    expect(result.breakdown.map((b) => b.key)).toEqual(['impact', 'effort']);
    const sum = result.breakdown.reduce((s, b) => s + b.contribution, 0);
    expect(sum).toBeCloseTo(result.priority, 1);
    expect(result.breakdown[0]).toMatchObject({ score: 5, weight: 2, normalized: 1 });
  });

  it('ignores zero-weight criteria', () => {
    const c: Criterion[] = [
      ...criteria,
      { key: 'risk', name: 'Risiko', weight: 0, direction: 'up' },
    ];
    expect(computePriority(c, { impact: 5, effort: 1, risk: 1 }).priority).toBe(100);
  });
});

describe('validateScores', () => {
  it('requires an integer 1–5 for every criterion and no unknown keys', () => {
    expect(() => validateScores(criteria, { impact: 3, effort: 3 })).not.toThrow();
    expect(() => validateScores(criteria, { impact: 3 })).toThrow(AppError);
    expect(() => validateScores(criteria, { impact: 0, effort: 3 })).toThrow(AppError);
    expect(() => validateScores(criteria, { impact: 6, effort: 3 })).toThrow(AppError);
    expect(() => validateScores(criteria, { impact: 2.5, effort: 3 })).toThrow(AppError);
    expect(() => validateScores(criteria, { impact: 3, effort: 3, other: 1 })).toThrow(AppError);
  });
});

describe('validateCriteria', () => {
  it('accepts the default model', () => {
    expect(() => validateCriteria(defaultCriteria)).not.toThrow();
  });

  it('rejects empty, duplicate, negative or all-zero weights', () => {
    expect(() => validateCriteria([])).toThrow(AppError);
    expect(() => validateCriteria([criteria[0]!, criteria[0]!])).toThrow(/doppelt/);
    expect(() => validateCriteria([{ ...criteria[0]!, weight: -1 }])).toThrow(AppError);
    expect(() => validateCriteria([{ ...criteria[0]!, weight: 0 }])).toThrow(/Gewicht/);
  });
});

describe('recomputeFromScores', () => {
  it('recomputes with new weights, and gives null when a new criterion has no score yet', () => {
    const scores = { impact: 5, effort: 5 };
    const reweighted: Criterion[] = [
      { key: 'impact', name: 'Auswirkung', weight: 1, direction: 'up' },
      { key: 'effort', name: 'Aufwand', weight: 1, direction: 'down' },
    ];
    expect(recomputeFromScores(reweighted, scores)).toBe(50);
    const withNew: Criterion[] = [
      ...reweighted,
      { key: 'risk', name: 'Risiko', weight: 1, direction: 'up' },
    ];
    expect(recomputeFromScores(withNew, scores)).toBeNull();
  });
});

describe('effectivePriority', () => {
  it('prefers the manual override and falls back to the calculated value', () => {
    expect(effectivePriority({ calculated: 40, override: 90 })).toBe(90);
    expect(effectivePriority({ calculated: 40, override: null })).toBe(40);
    expect(effectivePriority({ calculated: null, override: null })).toBeNull();
    expect(effectivePriority({ calculated: 40, override: 0 })).toBe(0);
  });
});
