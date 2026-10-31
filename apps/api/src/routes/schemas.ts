import { debtKinds, debtStatuses } from '@tessera/domain';
import { z } from '../openapi/zod';

export const KindSchema = z.enum(debtKinds).openapi('DebtKind');
export const StatusSchema = z.enum(debtStatuses).openapi('DebtStatus');

export const IdParams = z.object({ id: z.string().min(1) });

export const DebtSchema = z
  .object({
    id: z.string(),
    productId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    kind: KindSchema,
    status: StatusSchema,
    ownerId: z.string().nullable(),
    teamId: z.string().nullable(),
    effortEstimate: z.number().nullable().openapi({ description: 'Personentage' }),
    interestEstimate: z.number().nullable().openapi({ description: 'Personentage pro Monat' }),
    acceptedReason: z.string().nullable(),
    reviewDate: z.string().datetime().nullable(),
    archivedAt: z.string().datetime().nullable(),
    priorityCalculated: z
      .number()
      .nullable()
      .openapi({ description: '0–100, null = nicht bewertet' }),
    priorityOverride: z.number().nullable(),
    priorityOverrideReason: z.string().nullable(),
    priorityEffective: z
      .number()
      .nullable()
      .openapi({ description: 'Überschreibung, sonst berechneter Wert' }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi('Debt');

export const DebtEventSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    actorId: z.string().nullable(),
    actorName: z.string().nullable(),
    changes: z.record(z.unknown()),
    at: z.string().datetime(),
  })
  .openapi('DebtEvent');

export const DebtDetailSchema = DebtSchema.extend({ events: z.array(DebtEventSchema) }).openapi(
  'DebtDetail',
);

export const DebtInputSchema = z
  .object({
    productId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    description: z.string().nullish(),
    kind: KindSchema,
    ownerId: z.string().nullish(),
    teamId: z.string().nullish(),
    effortEstimate: z.number().min(0).nullish(),
    interestEstimate: z.number().min(0).nullish(),
  })
  .openapi('DebtInput');

export const DebtPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    kind: KindSchema.optional(),
    status: StatusSchema.optional(),
    ownerId: z.string().nullable().optional(),
    teamId: z.string().nullable().optional(),
    effortEstimate: z.number().min(0).nullable().optional(),
    interestEstimate: z.number().min(0).nullable().optional(),
    acceptedReason: z.string().nullable().optional(),
    reviewDate: z.string().datetime().nullable().optional(),
    archived: z
      .boolean()
      .optional()
      .openapi({ description: 'true archiviert, false stellt wieder her' }),
  })
  .openapi('DebtPatch');

export const DebtListQuery = z.object({
  q: z.string().optional(),
  kind: KindSchema.optional(),
  status: StatusSchema.optional(),
  productId: z.string().optional(),
  ownerId: z.string().optional(),
  includeArchived: z.enum(['true', 'false']).default('false'),
  sort: z
    .enum([
      'createdAt',
      '-createdAt',
      'title',
      '-title',
      'status',
      '-status',
      'priority',
      '-priority',
    ])
    .default('-createdAt'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const DebtListSchema = z
  .object({ items: z.array(DebtSchema), nextCursor: z.string().nullable() })
  .openapi('DebtList');

export const ProductSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    archivedAt: z.string().datetime().nullable(),
  })
  .openapi('Product');

export const ProductInputSchema = z
  .object({ name: z.string().trim().min(1).max(100), description: z.string().nullish() })
  .openapi('ProductInput');

export const ProductPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().nullable().optional(),
    archived: z.boolean().optional(),
  })
  .openapi('ProductPatch');

export const UserSchema = z
  .object({ id: z.string(), name: z.string(), email: z.string().nullable() })
  .openapi('User');

export const CriterionSchema = z
  .object({
    key: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(80),
    weight: z.number().min(0),
    direction: z.enum(['up', 'down']).openapi({
      description:
        'up: höherer Wert = dringender; down: höherer Wert senkt die Priorität (z. B. Aufwand)',
    }),
  })
  .openapi('Criterion');

export const AssessmentModelSchema = z
  .object({
    id: z.string(),
    version: z.number().int(),
    criteria: z.array(CriterionSchema),
    active: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .openapi('AssessmentModel');

export const AssessmentModelInputSchema = z
  .object({ criteria: z.array(CriterionSchema).min(1) })
  .openapi('AssessmentModelInput');

export const ModelUpdateResultSchema = z
  .object({
    model: AssessmentModelSchema,
    updated: z.number().int().describe('Schulden, deren Priorität neu berechnet wurde'),
    needReassessment: z
      .number()
      .int()
      .describe('Schulden ohne Wert für ein neues Kriterium: müssen neu bewertet werden'),
  })
  .openapi('ModelUpdateResult');

export const BreakdownItemSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    score: z.number(),
    weight: z.number(),
    normalized: z.number(),
    contribution: z.number(),
  })
  .openapi('BreakdownItem');

export const AssessmentSchema = z
  .object({
    id: z.string(),
    modelVersion: z.number().int(),
    scores: z.record(z.number()),
    priorityCalculated: z.number(),
    breakdown: z.array(BreakdownItemSchema),
    comment: z.string().nullable(),
    assessedBy: z.string().nullable(),
    assessedByName: z.string().nullable(),
    assessedAt: z.string().datetime(),
  })
  .openapi('Assessment');

export const AssessmentInputSchema = z
  .object({
    scores: z.record(z.number()).openapi({ description: 'Kriterium → ganze Zahl 1–5' }),
    comment: z.string().max(2000).nullish(),
  })
  .openapi('AssessmentInput');

export const PriorityOverrideInputSchema = z
  .object({ value: z.number().min(0).max(100), reason: z.string().trim().min(1).max(1000) })
  .openapi('PriorityOverrideInput');

export const PriorityListQuery = z.object({
  productId: z.string().optional(),
  teamId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const PriorityListSchema = z
  .object({
    ranked: z.array(DebtSchema.extend({ rank: z.number().int() })),
    unassessed: z.array(DebtSchema),
    unassessedTotal: z.number().int(),
  })
  .openapi('PriorityList');
