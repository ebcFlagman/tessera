import { defineRoute } from '../openapi/route';
import { queryDebts } from '../services/debt-query';
import { createDebt, getDebtWithHistory, toDebtDto, updateDebt } from '../services/debts';
import {
  DebtDetailSchema,
  DebtInputSchema,
  DebtListQuery,
  DebtListSchema,
  DebtPatchSchema,
  DebtSchema,
  IdParams,
} from './schemas';

export const listDebts = defineRoute(
  {
    method: 'get',
    path: '/debts',
    summary: 'Schuldenregister (Suche, Filter, Sortierung, Paginierung)',
    tags: ['Schulden'],
    query: DebtListQuery,
    success: { status: 200, schema: DebtListSchema, description: 'Seite des Registers' },
  },
  ({ db, query }) =>
    queryDebts(db, { ...query, includeArchived: query.includeArchived === 'true' }),
);

export const postDebt = defineRoute(
  {
    method: 'post',
    path: '/debts',
    summary: 'Schuld anlegen (Bearbeiter des Produkts)',
    tags: ['Schulden'],
    body: DebtInputSchema,
    success: { status: 201, schema: DebtSchema, description: 'Erstellt' },
    errors: [404, 409],
  },
  async ({ db, user, body }) => toDebtDto(await createDebt(db, user, body)),
);

export const getDebt = defineRoute(
  {
    method: 'get',
    path: '/debts/{id}',
    summary: 'Schuld mit Verlauf',
    tags: ['Schulden'],
    params: IdParams,
    success: { status: 200, schema: DebtDetailSchema, description: 'Schuld mit Verlauf' },
    errors: [404],
  },
  ({ db, params }) => getDebtWithHistory(db, params.id),
);

export const patchDebt = defineRoute(
  {
    method: 'patch',
    path: '/debts/{id}',
    summary: 'Schuld ändern (inkl. Status; „akzeptiert“ erfordert Begründung)',
    tags: ['Schulden'],
    params: IdParams,
    body: DebtPatchSchema,
    success: { status: 200, schema: DebtSchema, description: 'Aktualisiert' },
    errors: [404],
  },
  async ({ db, user, params, body }) => toDebtDto(await updateDebt(db, user, params.id, body)),
);
