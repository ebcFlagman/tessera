import { describe, expect, it } from 'vitest';
import {
  aggregateByPartition,
  aggregateCube,
  priorityBand,
  sumMetrics,
  type CubeRow,
} from '../src';

const row = (over: Partial<CubeRow> = {}): CubeRow => ({
  productId: 'p1',
  teamId: null,
  status: 'open',
  kind: 'technical',
  band: 'low',
  count: 1,
  effort: 0,
  interest: 0,
  unestimated: 0,
  ...over,
});

describe('priorityBand', () => {
  it('splits the effective priority at 40 and 70, and keeps unassessed apart', () => {
    expect(priorityBand(null)).toBe('unassessed');
    expect(priorityBand(0)).toBe('low');
    expect(priorityBand(39.9)).toBe('low');
    expect(priorityBand(40)).toBe('medium');
    expect(priorityBand(69.9)).toBe('medium');
    expect(priorityBand(70)).toBe('high');
    expect(priorityBand(100)).toBe('high');
  });
});

describe('aggregateCube', () => {
  it('counts by status, kind and band and sums effort only for debts still to repay', () => {
    const m = aggregateCube([
      row({ status: 'open', count: 2, effort: 3, interest: 0.5, unestimated: 1, band: 'high' }),
      row({ status: 'in_progress', kind: 'architectural', count: 1, effort: 5, band: 'medium' }),
      row({ status: 'repaid', count: 4, effort: 100, band: 'unassessed' }),
      row({ status: 'accepted', count: 1, effort: 50 }),
    ]);
    expect(m.total).toBe(8);
    expect(m.byStatus).toMatchObject({
      open: 2,
      in_progress: 1,
      repaid: 4,
      accepted: 1,
      planned: 0,
    });
    expect(m.byKind).toEqual({ architectural: 1, technical: 7 });
    expect(m.byPriorityBand).toEqual({ high: 2, medium: 1, low: 1, unassessed: 4 });
    expect(m.openCount).toBe(3);
    expect(m.openEffort).toBe(8); // repaid and accepted debts do not count
    expect(m.openInterest).toBe(0.5);
    expect(m.unestimatedOpen).toBe(1);
  });

  it('is zero for an empty register', () => {
    expect(aggregateCube([]).total).toBe(0);
  });
});

describe('partitions and sums', () => {
  it('splits by product and team, and the parts add up to the whole', () => {
    const rows = [
      row({ productId: 'p1', teamId: 't1', count: 2, effort: 1 }),
      row({ productId: 'p1', teamId: null, count: 3, effort: 2 }),
      row({ productId: 'p2', teamId: 't1', status: 'planned', count: 1, effort: 4 }),
    ];
    const parts = aggregateByPartition(rows);
    expect(parts).toHaveLength(3);
    expect(sumMetrics(parts.map((p) => p.metrics))).toEqual(aggregateCube(rows));
  });
});
