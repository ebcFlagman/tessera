import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { errorBodySchema } from '@tessera/domain';
import { z } from './zod';

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

export const ErrorSchema = registry.register('Error', errorBodySchema.extend({}).openapi('Error'));
export { z };

/** Builds the OpenAPI document from everything registered via defineRoute. */
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: 'Tessera API', version: '0.1.0' },
    servers: [{ url: '/api/v1' }],
    security: [{ bearerAuth: [] }],
  });
}
