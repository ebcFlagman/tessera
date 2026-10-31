import { loadCube, type PrismaClient } from '@tessera/db';
import { AppError, aggregateCube, emptyMetrics, sumMetrics, type Metrics } from '@tessera/domain';

export interface DashboardQuery {
  productId?: string | undefined;
  teamId?: string | undefined;
  /** YYYY-MM-DD, inclusive; default: 89 days before `to` */
  from?: string | undefined;
  /** YYYY-MM-DD, inclusive; default: today (UTC) */
  to?: string | undefined;
}

export type HistoryPoint = Metrics & { date: string };

const DAY = 86_400_000;
export const MAX_RANGE_DAYS = 366;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function parseDay(value: string, label: string): Date {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || isoDay(d) !== value) {
    throw new AppError('validation_failed', `„${label}“ ist kein gültiges Datum (JJJJ-MM-TT)`);
  }
  return d;
}

export function resolveRange(q: Pick<DashboardQuery, 'from' | 'to'>, now: Date = new Date()) {
  const to = q.to ? parseDay(q.to, 'bis') : parseDay(isoDay(now), 'bis');
  const from = q.from ? parseDay(q.from, 'von') : new Date(to.getTime() - 89 * DAY);
  if (from > to) throw new AppError('validation_failed', 'Das Startdatum liegt nach dem Enddatum');
  if ((to.getTime() - from.getTime()) / DAY > MAX_RANGE_DAYS) {
    throw new AppError(
      'validation_failed',
      `Der Zeitraum darf höchstens ${MAX_RANGE_DAYS} Tage umfassen`,
    );
  }
  return { from, to };
}

/**
 * Live figures from the register (same cube the daily snapshots use) plus the history from the
 * snapshots. The live figures cover exactly the non-archived debts the register lists for the
 * same filters.
 */
export async function dashboard(db: PrismaClient, q: DashboardQuery, now: Date = new Date()) {
  const { from, to } = resolveRange(q, now);
  const current = aggregateCube(await loadCube(db, { productId: q.productId, teamId: q.teamId }));

  const snapshots = await db.metricSnapshot.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.teamId ? { teamId: q.teamId } : {}),
    },
    orderBy: { date: 'asc' },
  });

  const byDay = new Map<string, Metrics[]>();
  for (const s of snapshots) {
    const m: Metrics = {
      ...emptyMetrics(),
      total: s.total,
      openCount: s.openCount,
      openEffort: s.openEffort,
      openInterest: s.openInterest,
      unestimatedOpen: s.unestimatedOpen,
      byStatus: { ...emptyMetrics().byStatus, ...(s.countByStatus as object) },
      byKind: { ...emptyMetrics().byKind, ...(s.countByKind as object) },
      byPriorityBand: { ...emptyMetrics().byPriorityBand, ...(s.countByPriorityBand as object) },
    };
    const key = isoDay(s.date);
    byDay.set(key, [...(byDay.get(key) ?? []), m]);
  }
  const history: HistoryPoint[] = [...byDay.entries()].map(([date, list]) => ({
    date,
    ...sumMetrics(list),
  }));

  return {
    filters: {
      productId: q.productId ?? null,
      teamId: q.teamId ?? null,
      from: isoDay(from),
      to: isoDay(to),
    },
    generatedAt: now.toISOString(),
    current,
    history,
    lastSnapshotDate: history.at(-1)?.date ?? null,
  };
}
