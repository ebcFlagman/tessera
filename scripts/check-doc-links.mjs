// Fails when a relative link in the documentation points to a file that does not exist.
// Usage: node scripts/check-doc-links.mjs [dir-or-file ...]   (default: README.md docs specs)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const roots = process.argv.slice(2);
const targets = roots.length ? roots : ['README.md', 'docs', 'specs'];

function* markdownFiles(path) {
  if (!existsSync(path)) return;
  if (statSync(path).isFile()) {
    if (path.endsWith('.md')) yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    yield* markdownFiles(join(path, entry));
  }
}

/** Links outside fenced code blocks and inline code. */
function* links(text) {
  let inFence = false;
  for (const [i, rawLine] of text.split('\n').entries()) {
    if (/^\s*(```|~~~)/.test(rawLine)) inFence = !inFence;
    if (inFence) continue;
    const line = rawLine.replace(/`[^`]*`/g, '');
    for (const m of line.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      yield { line: i + 1, href: m[1] };
    }
  }
}

let broken = 0;
let checked = 0;
for (const target of targets) {
  for (const file of markdownFiles(target)) {
    for (const { line, href } of links(readFileSync(file, 'utf8'))) {
      if (/^(https?:|mailto:|#)/.test(href)) continue;
      const path = decodeURIComponent(href.split('#')[0] ?? '');
      if (!path) continue;
      checked++;
      if (!existsSync(resolve(dirname(file), path))) {
        console.error(`${file}:${line}: broken link -> ${href}`);
        broken++;
      }
    }
  }
}
if (broken) {
  console.error(`${broken} broken link(s).`);
  process.exit(1);
}
console.log(`All ${checked} relative documentation links resolve.`);
