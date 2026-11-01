#!/usr/bin/env bash
# Verifies that the documentation link check rejects a broken link and accepts a valid one.
set -euo pipefail
cd "$(dirname "$0")/.."
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT

printf '# ok\n[self](./ok.md)\n```\n[ignored](./missing.md)\n```\n' > "$dir/ok.md"
node scripts/check-doc-links.mjs "$dir" >/dev/null

printf '[broken](./missing.md)\n' > "$dir/bad.md"
if node scripts/check-doc-links.mjs "$dir" >/dev/null 2>&1; then
  echo "FAIL: broken link was not detected" >&2
  exit 1
fi
echo "OK: broken link detected, valid links and code fences accepted"
