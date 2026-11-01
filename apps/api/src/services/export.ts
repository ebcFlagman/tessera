import type { PrismaClient } from '@tessera/db';
import { AppError } from '@tessera/domain';
import { debtWhere, type DebtQuery } from './debt-query';
import { csvResponse, toCsv } from './csv';
import { dashboard, type DashboardQuery } from './dashboard';
import { attachSources } from './sources';
import { toDebtDto } from './debts';

const MAX_ROWS = 50_000;

const kindLabels = { architectural: 'Architektur', technical: 'Technisch' } as const;
const statusLabels = {
  open: 'Offen',
  planned: 'Geplant',
  in_progress: 'In Bearbeitung',
  repaid: 'Getilgt',
  accepted: 'Akzeptiert',
} as const;
const sourceLabels = { sonarcloud: 'SonarCloud', gitlab: 'GitLab Cloud' } as const;

const filename = (kind: string, now: Date) =>
  `tessera-${kind}-${now.toISOString().slice(0, 10)}.csv`;

/** The register as CSV, with the same filters as the register itself. */
export async function exportDebts(
  db: PrismaClient,
  query: Pick<
    DebtQuery,
    'q' | 'kind' | 'status' | 'productId' | 'ownerId' | 'teamId' | 'source' | 'includeArchived'
  >,
  now: Date = new Date(),
): Promise<Response> {
  const where = debtWhere(query);
  const count = await db.debtItem.count({ where });
  if (count > MAX_ROWS) {
    throw new AppError(
      'validation_failed',
      `Der Export umfasst ${count} Zeilen, erlaubt sind ${MAX_ROWS}. Bitte die Filter eingrenzen.`,
    );
  }
  const debts = await db.debtItem.findMany({
    where,
    orderBy: [
      { priorityEffective: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
  });
  const [products, users, teams] = await Promise.all([
    db.product.findMany({ select: { id: true, name: true } }),
    db.user.findMany({ select: { id: true, name: true } }),
    db.team.findMany({ select: { id: true, name: true } }),
  ]);
  const name = (list: { id: string; name: string }[]) => new Map(list.map((x) => [x.id, x.name]));
  const productName = name(products);
  const userName = name(users);
  const teamName = name(teams);
  const withSource = await attachSources(db, debts.map(toDebtDto));

  const body = toCsv(
    [
      'Titel',
      'Produkt',
      'Art',
      'Status',
      'Verantwortlicher',
      'Team',
      'Priorität (berechnet)',
      'Priorität (überschrieben)',
      'Priorität (gilt)',
      'Aufwand (Personentage)',
      'Folgekosten (Personentage/Monat)',
      'Quelle',
      'Quelle (Link)',
      'Erstellt',
      'Aktualisiert',
      'ID',
    ],
    withSource.map((d) => [
      d.title,
      productName.get(d.productId),
      kindLabels[d.kind],
      statusLabels[d.status],
      d.ownerId ? userName.get(d.ownerId) : null,
      d.teamId ? teamName.get(d.teamId) : null,
      d.priorityCalculated,
      d.priorityOverride,
      d.priorityEffective,
      d.effortEstimate,
      d.interestEstimate,
      d.source ? sourceLabels[d.source.type] : 'manuell',
      d.source?.url,
      d.createdAt,
      d.updatedAt,
      d.id,
    ]),
  );
  return csvResponse(body, filename('schulden', now));
}

/** The dashboard figures as CSV: the live row first, then the history. */
export async function exportDashboard(
  db: PrismaClient,
  query: DashboardQuery,
  now: Date = new Date(),
): Promise<Response> {
  const data = await dashboard(db, query, now);
  const row = (label: string, m: typeof data.current) => [
    label,
    m.total,
    m.openCount,
    m.openEffort,
    m.openInterest,
    m.byPriorityBand.high,
    m.byPriorityBand.medium,
    m.byPriorityBand.low,
    m.byPriorityBand.unassessed,
  ];
  const body = toCsv(
    [
      'Datum',
      'Schulden gesamt',
      'Davon offen',
      'Offener Aufwand (Personentage)',
      'Offene Folgekosten (Personentage/Monat)',
      'Priorität hoch',
      'Priorität mittel',
      'Priorität niedrig',
      'Nicht bewertet',
    ],
    [row('aktuell', data.current), ...data.history.map((h) => row(h.date, h))],
  );
  return csvResponse(body, filename('dashboard', now));
}
