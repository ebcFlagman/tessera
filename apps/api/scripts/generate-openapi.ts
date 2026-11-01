import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../src/routes';
import { buildOpenApiDocument } from '../src/openapi/registry';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../openapi.generated.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(buildOpenApiDocument(), null, 2) + '\n');
console.log(`wrote ${out}`);
