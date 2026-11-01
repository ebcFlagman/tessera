import { defineRoute } from '../openapi/route';
import {
  assessDebt,
  clearPriorityOverride,
  getActiveModel,
  listAssessments,
  replaceModel,
  setPriorityOverride,
  toModelDto,
} from '../services/assessment';
import { toDebtDto } from '../services/debts';
import { attachSource } from '../services/sources';
import { priorityList } from '../services/priority-list';
import { z } from '../openapi/zod';
import {
  AssessmentInputSchema,
  AssessmentModelInputSchema,
  AssessmentModelSchema,
  AssessmentSchema,
  DebtSchema,
  IdParams,
  ModelUpdateResultSchema,
  PriorityListQuery,
  PriorityListSchema,
  PriorityOverrideInputSchema,
} from './schemas';

export const getModel = defineRoute(
  {
    method: 'get',
    path: '/assessment-model',
    summary: 'Aktives Bewertungsmodell',
    tags: ['Bewertung'],
    success: { status: 200, schema: AssessmentModelSchema, description: 'Aktives Modell' },
  },
  async ({ db }) => toModelDto(await getActiveModel(db)),
);

export const putModel = defineRoute(
  {
    method: 'put',
    path: '/assessment-model',
    summary: 'Neue Modellversion anlegen und Prioritäten neu berechnen (Administrator)',
    tags: ['Bewertung'],
    body: AssessmentModelInputSchema,
    success: { status: 200, schema: ModelUpdateResultSchema, description: 'Neue Version' },
  },
  async ({ db, user, body }) => {
    const r = await replaceModel(db, user, body.criteria);
    return { model: toModelDto(r.model), updated: r.updated, needReassessment: r.needReassessment };
  },
);

export const getAssessments = defineRoute(
  {
    method: 'get',
    path: '/debts/{id}/assessments',
    summary: 'Bewertungshistorie einer Schuld (neueste zuerst)',
    tags: ['Bewertung'],
    params: IdParams,
    success: { status: 200, schema: z.array(AssessmentSchema), description: 'Historie' },
    errors: [404],
  },
  ({ db, params }) => listAssessments(db, params.id),
);

export const postAssessment = defineRoute(
  {
    method: 'post',
    path: '/debts/{id}/assessments',
    summary: 'Schuld bewerten (Bearbeiter des Produkts)',
    tags: ['Bewertung'],
    params: IdParams,
    body: AssessmentInputSchema,
    success: { status: 201, schema: AssessmentSchema, description: 'Bewertung angelegt' },
    errors: [404],
  },
  async ({ db, user, params, body }) => {
    await assessDebt(db, user, params.id, body);
    const [latest] = await listAssessments(db, params.id);
    return latest;
  },
);

export const putOverride = defineRoute(
  {
    method: 'put',
    path: '/debts/{id}/priority-override',
    summary: 'Priorität mit Begründung überschreiben',
    tags: ['Bewertung'],
    params: IdParams,
    body: PriorityOverrideInputSchema,
    success: { status: 200, schema: DebtSchema, description: 'Überschrieben' },
    errors: [404],
  },
  async ({ db, user, params, body }) =>
    attachSource(db, toDebtDto(await setPriorityOverride(db, user, params.id, body))),
);

export const deleteOverride = defineRoute(
  {
    method: 'delete',
    path: '/debts/{id}/priority-override',
    summary: 'Überschreibung entfernen (zurück zum berechneten Wert)',
    tags: ['Bewertung'],
    params: IdParams,
    success: { status: 200, schema: DebtSchema, description: 'Entfernt' },
    errors: [404],
  },
  async ({ db, user, params }) =>
    attachSource(db, toDebtDto(await clearPriorityOverride(db, user, params.id))),
);

export const getPriorityList = defineRoute(
  {
    method: 'get',
    path: '/priority-list',
    summary: 'Priorisierte Tilgungsliste; nicht bewertete Schulden getrennt',
    tags: ['Bewertung'],
    query: PriorityListQuery,
    success: { status: 200, schema: PriorityListSchema, description: 'Rangfolge' },
  },
  ({ db, query }) => priorityList(db, query),
);
