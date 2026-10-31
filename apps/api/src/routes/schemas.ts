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
    .enum(['createdAt', '-createdAt', 'title', '-title', 'status', '-status'])
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
