import type { ConnectorType } from '@tessera/connectors';
import { AppError } from '@tessera/domain';
import { defineRoute } from '../openapi/route';
import { z } from '../openapi/zod';
import {
  createIntegration,
  deleteIntegration,
  getSyncRun,
  listAttention,
  listIntegrations,
  listSyncRuns,
  requestSync,
  testIntegration,
  toIntegrationDto,
  toSyncRunDto,
  updateIntegration,
} from '../services/integrations';
import {
  IdParams,
  IntegrationInputSchema,
  IntegrationPatchSchema,
  IntegrationSchema,
  SyncRunSchema,
  TestResultSchema,
} from './schemas';

export const getProductIntegrations = defineRoute(
  {
    method: 'get',
    path: '/products/{id}/integrations',
    summary: 'Integrationen eines Produkts (ohne Zugangsdaten)',
    tags: ['Integrationen'],
    params: IdParams,
    success: { status: 200, schema: z.array(IntegrationSchema), description: 'Integrationen' },
    errors: [404],
  },
  async ({ db, params }) => {
    if (!(await db.product.findUnique({ where: { id: params.id } }))) {
      throw new AppError('not_found', 'Produkt nicht gefunden');
    }
    return listIntegrations(db, params.id);
  },
);

export const postProductIntegration = defineRoute(
  {
    method: 'post',
    path: '/products/{id}/integrations',
    summary: 'Quelle mit einem Produkt verbinden (Administrator des Produkts)',
    tags: ['Integrationen'],
    params: IdParams,
    body: IntegrationInputSchema,
    success: { status: 201, schema: IntegrationSchema, description: 'Verbunden' },
    errors: [404, 409],
  },
  async ({ deps, user, params, body }) =>
    toIntegrationDto(
      await createIntegration(deps, user, params.id, { ...body, type: body.type as ConnectorType }),
    ),
);

export const getAttention = defineRoute(
  {
    method: 'get',
    path: '/integrations',
    summary:
      'Integrationen mit Fehler in Produkten, die der Benutzer administriert (Hinweis in der Anwendung)',
    tags: ['Integrationen'],
    query: z.object({ status: z.literal('error') }),
    success: {
      status: 200,
      schema: z.array(IntegrationSchema),
      description: 'Integrationen im Fehlerzustand',
    },
  },
  async ({ db, user }) => listAttention(db, user),
);

export const patchIntegration = defineRoute(
  {
    method: 'patch',
    path: '/integrations/{id}',
    summary: 'Einstellungen, Zeitplan oder Zugangsdaten ändern, Integration deaktivieren',
    tags: ['Integrationen'],
    params: IdParams,
    body: IntegrationPatchSchema,
    success: { status: 200, schema: IntegrationSchema, description: 'Aktualisiert' },
    errors: [404],
  },
  async ({ deps, user, params, body }) =>
    toIntegrationDto(await updateIntegration(deps, user, params.id, body)),
);

export const removeIntegration = defineRoute(
  {
    method: 'delete',
    path: '/integrations/{id}',
    summary: 'Quelle trennen (importierte Schulden bleiben erhalten)',
    tags: ['Integrationen'],
    params: IdParams,
    success: { status: 204, description: 'Getrennt' },
    errors: [404],
  },
  async ({ db, user, params }) => {
    await deleteIntegration(db, user, params.id);
  },
);

export const postTest = defineRoute(
  {
    method: 'post',
    path: '/integrations/{id}/test',
    summary: 'Verbindung testen',
    tags: ['Integrationen'],
    params: IdParams,
    success: { status: 200, schema: TestResultSchema, description: 'Ergebnis des Tests' },
    errors: [404],
  },
  ({ deps, user, params }) => testIntegration(deps, user, params.id),
);

export const postSync = defineRoute(
  {
    method: 'post',
    path: '/integrations/{id}/sync',
    summary: 'Import anstoßen; liefert den (neuen oder bereits laufenden) Importlauf',
    tags: ['Integrationen'],
    params: IdParams,
    success: { status: 202, schema: SyncRunSchema, description: 'Importlauf angenommen' },
    errors: [404, 409],
  },
  async ({ deps, user, params }) => toSyncRunDto(await requestSync(deps, user, params.id)),
);

export const getRuns = defineRoute(
  {
    method: 'get',
    path: '/integrations/{id}/sync-runs',
    summary: 'Letzte Importläufe',
    tags: ['Integrationen'],
    params: IdParams,
    success: {
      status: 200,
      schema: z.array(SyncRunSchema),
      description: 'Importläufe, neueste zuerst',
    },
    errors: [404],
  },
  async ({ db, params }) => (await listSyncRuns(db, params.id)).map(toSyncRunDto),
);

export const getRun = defineRoute(
  {
    method: 'get',
    path: '/sync-runs/{id}',
    summary: 'Status und Fortschritt eines Importlaufs',
    tags: ['Integrationen'],
    params: IdParams,
    success: { status: 200, schema: SyncRunSchema, description: 'Importlauf' },
    errors: [404],
  },
  async ({ db, params }) => toSyncRunDto(await getSyncRun(db, params.id)),
);
