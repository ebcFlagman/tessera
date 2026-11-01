import { AppError } from '@tessera/domain';
import { defineRoute } from '../openapi/route';
import { z } from '../openapi/zod';
import { createProduct, toProductDto, updateProduct } from '../services/products';
import {
  IdParams,
  ProductInputSchema,
  ProductPatchSchema,
  ProductSchema,
  UserSchema,
} from './schemas';
import type { PrismaClient } from '@tessera/db';

export const listProducts = defineRoute(
  {
    method: 'get',
    path: '/products',
    summary: 'Produkte auflisten',
    tags: ['Produkte'],
    query: z.object({ includeArchived: z.enum(['true', 'false']).default('false') }),
    success: { status: 200, schema: z.array(ProductSchema), description: 'Produkte' },
  },
  async ({ db, query }) => {
    const rows = await db.product.findMany({
      where: query.includeArchived === 'true' ? {} : { archivedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map(toProductDto);
  },
);

export const postProduct = defineRoute(
  {
    method: 'post',
    path: '/products',
    summary: 'Produkt anlegen (Administrator)',
    tags: ['Produkte'],
    body: ProductInputSchema,
    success: { status: 201, schema: ProductSchema, description: 'Erstellt' },
    errors: [409],
  },
  async ({ db, user, body }) => toProductDto(await createProduct(db, user, body)),
);

export const patchProduct = defineRoute(
  {
    method: 'patch',
    path: '/products/{id}',
    summary: 'Produkt umbenennen oder archivieren (Administrator des Produkts)',
    tags: ['Produkte'],
    params: IdParams,
    body: ProductPatchSchema,
    success: { status: 200, schema: ProductSchema, description: 'Aktualisiert' },
    errors: [404],
  },
  async ({ db, user, params, body }) =>
    toProductDto(await updateProduct(db, user, params.id, body)),
);

export const listUsers = defineRoute(
  {
    method: 'get',
    path: '/users',
    summary: 'Benutzer suchen (z. B. für die Auswahl des Verantwortlichen)',
    tags: ['Benutzer'],
    query: z.object({ q: z.string().optional() }),
    success: { status: 200, schema: z.array(UserSchema), description: 'Benutzer' },
  },
  async ({ db, query }: { db: PrismaClient; query: { q?: string } }) => {
    if (query.q && query.q.length > 100)
      throw new AppError('validation_failed', 'Suchbegriff zu lang');
    const rows = await db.user.findMany({
      where: query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { name: 'asc' },
      take: 50,
    });
    return rows.map((u) => ({ id: u.id, name: u.name, email: u.email }));
  },
);
