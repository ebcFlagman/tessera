import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

type Json = Record<string, unknown>;
const spec = JSON.parse(
  readFileSync(resolve(__dirname, '../../openapi.generated.json'), 'utf8'),
) as Json & { components: { schemas: Record<string, unknown> } };

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'spec', components: spec.components });

function resolveRefs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(resolveRefs);
  if (node && typeof node === 'object') {
    const o = node as Json;
    if (typeof o.$ref === 'string') return { $ref: `spec${o.$ref}` };
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, resolveRefs(v)]));
  }
  return node;
}

/**
 * Asserts that a response body matches the response schema in the generated OpenAPI document
 * (the contract produced from the backend code).
 */
export function assertMatchesContract(
  method: string,
  path: string,
  status: number,
  body: unknown,
): void {
  const paths = spec.paths as Record<string, Record<string, Json>>;
  const op = paths[path]?.[method.toLowerCase()];
  if (!op) throw new Error(`Operation ${method} ${path} not in generated spec`);
  const responses = op.responses as Record<string, Json>;
  const res = responses[String(status)];
  if (!res) throw new Error(`Status ${status} not documented for ${method} ${path}`);
  const content = res.content as Record<string, { schema: unknown }> | undefined;
  const schema = content?.['application/json']?.schema;
  if (!schema) return;
  const validate = ajv.compile(resolveRefs(schema) as object);
  if (!validate(body)) {
    throw new Error(
      `Response of ${method} ${path} (${status}) violates the contract: ${ajv.errorsText(validate.errors)}`,
    );
  }
}
