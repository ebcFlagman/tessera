import { defineRoute } from '../openapi/route';
import { dashboard } from '../services/dashboard';
import { exportDashboard, exportDebts } from '../services/export';
import { DashboardQuerySchema, DashboardSchema, ExportDebtsQuery } from './schemas';

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
