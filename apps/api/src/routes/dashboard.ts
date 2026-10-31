import { defineRoute } from '../openapi/route';
import { z } from '../openapi/zod';
import { dashboard } from '../services/dashboard';
import { exportDashboard, exportDebts } from '../services/export';
import { DashboardQuerySchema, DashboardSchema, ExportDebtsQuery, TeamSchema } from './schemas';

export const getDashboard = defineRoute(
  {
    method: 'get',
    path: '/dashboard',
    summary: 'Kennzahlen und Zeitverlauf (Filter: Produkt, Team, Zeitraum)',
    tags: ['Dashboard'],
    query: DashboardQuerySchema,
    success: { status: 200, schema: DashboardSchema, description: 'Kennzahlen und Verlauf' },
  },
  ({ db, query }) => dashboard(db, query),
);

export const getTeams = defineRoute(
  {
    method: 'get',
    path: '/teams',
    summary: 'Teams (für Filter)',
    tags: ['Dashboard'],
    success: { status: 200, schema: z.array(TeamSchema), description: 'Teams' },
  },
  async ({ db }) =>
    (await db.team.findMany({ orderBy: { name: 'asc' } })).map((t) => ({ id: t.id, name: t.name })),
);

export const exportDebtsRoute = defineRoute(
  {
    method: 'get',
    path: '/exports/debts',
    summary: 'Register als CSV (gleiche Filter wie das Register)',
    tags: ['Export'],
    query: ExportDebtsQuery,
    success: { status: 200, description: 'CSV-Datei', contentType: 'text/csv' },
  },
  ({ db, query }) =>
    exportDebts(db, { ...query, includeArchived: query.includeArchived === 'true' }),
);

export const exportDashboardRoute = defineRoute(
  {
    method: 'get',
    path: '/exports/dashboard',
    summary: 'Dashboard-Kennzahlen und Verlauf als CSV',
    tags: ['Export'],
    query: DashboardQuerySchema,
    success: { status: 200, description: 'CSV-Datei', contentType: 'text/csv' },
  },
  ({ db, query }) => exportDashboard(db, query),
);
