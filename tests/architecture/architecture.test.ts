import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The structural rules of the constitution that can be checked mechanically. They fail the build
 * when someone crosses a boundary (see docs/architecture/context-and-building-blocks.md).
 */
const root = join(__dirname, '../..');

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !name.endsWith('.d.ts')) yield path;
  }
}

const imports = (code: string) =>
  [...code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);

function violations(dir: string, rule: (file: string, code: string) => string | null): string[] {
  const found: string[] = [];
  for (const file of sourceFiles(join(root, dir))) {
    const msg = rule(relative(root, file), readFileSync(file, 'utf8'));
    if (msg) found.push(`${relative(root, file)}: ${msg}`);
  }
  return found;
}

describe('architecture rules', () => {
  it('I: the domain package is pure (no database, HTTP, framework or environment access)', () => {
    const forbidden =
      /^(@tessera\/(?!domain)|@prisma|next|react|pg|pg-boss|node:(fs|http|https|net|child_process)|fs|http)/;
    expect(
      violations('packages/domain/src', (_f, code) => {
        const bad = imports(code).find((i) => forbidden.test(i));
        if (bad) return `imports ${bad}`;
        if (/\bfetch\s*\(/.test(code)) return 'calls fetch';
        if (/process\.env/.test(code)) return 'reads process.env (pass the environment in)';
        return null;
      }),
    ).toEqual([]);
  });

  it('II: connectors never touch the database; they only know the domain types', () => {
    expect(
      violations('packages/connectors/src', (_f, code) => {
        const bad = imports(code).find((i) => /^(@tessera\/(db|api|web)|@prisma|pg)/.test(i));
        return bad ? `imports ${bad}` : null;
      }),
    ).toEqual([]);
  });

  it('VII: the frontend talks to the backend only through the generated client', () => {
    expect(
      violations('apps/web/src', (f, code) => {
        const bad = imports(code).find((i) =>
          /^(@tessera\/(db|domain|connectors)|@prisma|axios|ky)/.test(i),
        );
        if (bad) return `imports ${bad}`;
        const allowed = ['apps/web/src/lib/api.ts', 'apps/web/src/lib/auth.ts'];
        if (!allowed.includes(f) && /\bfetch\s*\(/.test(code)) return 'calls fetch directly';
        return null;
      }),
    ).toEqual([]);
  });

  it('I: Next.js route files only delegate to the route definitions (no logic in them)', () => {
    expect(
      violations('apps/api/src/app/api', (_f, code) => {
        const lines = code
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const ok = lines.every(
          (l) =>
            /^import \{[^}]+\} from '@\/routes\/[a-z-]+';$/.test(l) ||
            /^export const (GET|POST|PUT|PATCH|DELETE) = [A-Za-z]+\.handle;$/.test(l),
        );
        return ok ? null : 'contains more than imports from @/routes and handler exports';
      }),
    ).toEqual([]);
  });

  it('the apps do not depend on each other', () => {
    for (const [app, other] of [
      ['apps/api/src', '@tessera/(web|worker)'],
      ['apps/web/src', '@tessera/(api|worker)'],
      ['apps/worker/src', '@tessera/(api|web)'],
    ] as const) {
      expect(
        violations(app, (_f, code) => {
          const bad = imports(code).find((i) => new RegExp(`^${other}($|/)`).test(i));
          return bad ? `imports ${bad}` : null;
        }),
      ).toEqual([]);
    }
  });

  it('IV: no environment file with real values is tracked (only the example)', () => {
    const tracked = readdirSync(join(root, 'deploy')).filter((f) => f.startsWith('.env'));
    expect(tracked).toEqual(['.env.example']);
  });
});

describe('documentation (scenario 6 of the quickstart)', () => {
  const read = (p: string) => readFileSync(join(root, p), 'utf8');
  const adrFiles = readdirSync(join(root, 'docs/architecture/adr')).filter(
    (f) => /^\d{4}-.+\.md$/.test(f) && !f.startsWith('0000'),
  );

  it('the vision explains purpose, building blocks, integration approach and links every decision', () => {
    const vision = read('docs/architecture/vision.md');
    for (const heading of [
      '## Zweck',
      '## Zielbild',
      '## Leitprinzipien',
      '## Systemgrenzen',
      '## Abgrenzung Version 1',
      '## Umsetzungsstand',
    ]) {
      expect(vision, heading).toContain(heading);
    }
    expect(vision).toContain('context-and-building-blocks.md');
    expect(vision).toContain('integration-concept.md');
    expect(adrFiles.length).toBeGreaterThanOrEqual(5); // at least the five most important decisions (SC-008)
    for (const f of adrFiles) expect(vision, `vision links ${f}`).toContain(`adr/${f}`);
  });

  it('every decision record states its status, date and implementation state', () => {
    for (const f of adrFiles) {
      const adr = read(`docs/architecture/adr/${f}`);
      expect(adr, f).toMatch(/\*\*Status:\*\* (Akzeptiert|Vorgeschlagen|Abgelöst|Verworfen)/);
      expect(adr, f).toMatch(/\*\*Datum:\*\* \d{4}-\d{2}-\d{2}/);
      expect(adr, f).toMatch(/\*\*Umsetzungsstand:\*\* (umgesetzt|teilweise|geplant)/);
      for (const section of ['## Kontext', '## Entscheidung', '## Begründung', '## Konsequenzen'])
        expect(adr, `${f} ${section}`).toContain(section);
    }
  });
});
