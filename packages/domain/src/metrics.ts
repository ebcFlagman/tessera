import { debtKinds, debtStatuses, type DebtKind, type DebtStatus } from './debt-status';

export const priorityBands = ['high', 'medium', 'low', 'unassessed'] as const;
export type PriorityBand = (typeof priorityBands)[number];

/** Effective priority (0–100) at or above this value is "high" / "medium". */
export const HIGH_PRIORITY_FROM = 70;
export const MEDIUM_PRIORITY_FROM = 40;

export function priorityBand(effective: number | null): PriorityBand {
  if (effective === null) return 'unassessed';
  if (effective >= HIGH_PRIORITY_FROM) return 'high';
  if (effective >= MEDIUM_PRIORITY_FROM) return 'medium';
  return 'low';
}

/** Debts that still have to be repaid; their effort and running cost make up the open backlog. */
export const openStatuses: readonly DebtStatus[] = ['open', 'planned', 'in_progress'];

/** One cell of the (product, team, status, kind, band) cube, as counted in the database. */
export interface CubeRow {
  productId: string;
  teamId: string | null;
  status: DebtStatus;
  kind: DebtKind;
  band: PriorityBand;
  count: number;
  /** person-days, sum over debts with an estimate */
  effort: number;
  /** person-days per month */
  interest: number;
  /** debts without an effort estimate */
  unestimated: number;
}

export interface Metrics {
  total: number;
  openCount: number;
  openEffort: number;
  openInterest: number;
  /** open debts without an effort estimate: the open effort is a lower bound */
  unestimatedOpen: number;
  byStatus: Record<DebtStatus, number>;
  byKind: Record<DebtKind, number>;
  byPriorityBand: Record<PriorityBand, number>;
}

const zero = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function emptyMetrics(): Metrics {
  return {
    total: 0,
    openCount: 0,
    openEffort: 0,
    openInterest: 0,
    unestimatedOpen: 0,
    byStatus: zero(debtStatuses),
    byKind: zero(debtKinds),
    byPriorityBand: zero(priorityBands),
  };
}

export function aggregateCube(rows: CubeRow[]): Metrics {
  const m = emptyMetrics();
  for (const r of rows) {
    m.total += r.count;
    m.byStatus[r.status] += r.count;
    m.byKind[r.kind] += r.count;
    m.byPriorityBand[r.band] += r.count;
    if (openStatuses.includes(r.status)) {
      m.openCount += r.count;
      m.openEffort += r.effort;
      m.openInterest += r.interest;
      m.unestimatedOpen += r.unestimated;
    }
  }
  m.openEffort = round2(m.openEffort);
  m.openInterest = round2(m.openInterest);
  return m;
}

/** Metrics per (product, team) partition, as stored in the daily snapshots. */
export function aggregateByPartition(
  rows: CubeRow[],
): { productId: string; teamId: string | null; metrics: Metrics }[] {
  const groups = new Map<string, CubeRow[]>();
  for (const r of rows) {
    const key = `${r.productId}\u0000${r.teamId ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map((list) => ({
    productId: list[0]!.productId,
    teamId: list[0]!.teamId,
    metrics: aggregateCube(list),
  }));
}

/** Sums stored partition metrics, e.g. all teams of a product on one day. */
export function sumMetrics(list: Metrics[]): Metrics {
  const m = emptyMetrics();
  for (const x of list) {
    m.total += x.total;
    m.openCount += x.openCount;
    m.openEffort += x.openEffort;
    m.openInterest += x.openInterest;
    m.unestimatedOpen += x.unestimatedOpen;
    for (const k of debtStatuses) m.byStatus[k] += x.byStatus[k];
    for (const k of debtKinds) m.byKind[k] += x.byKind[k];
    for (const k of priorityBands) m.byPriorityBand[k] += x.byPriorityBand[k];
  }
  m.openEffort = round2(m.openEffort);
  m.openInterest = round2(m.openInterest);
  return m;
}
