#!/usr/bin/env bash
# Fails when the committed OpenAPI spec or the generated API client no longer match the backend code
# (constitution VII). Regenerates both and compares them with what is checked in.
set -euo pipefail
cd "$(dirname "$0")/.."

files=(apps/api/openapi.generated.json packages/api-types/src/schema.d.ts)
before=$(cat "${files[@]}" 2>/dev/null | sha256sum || true)

pnpm openapi:generate >/dev/null
pnpm api-types:generate >/dev/null

after=$(cat "${files[@]}" | sha256sum)
if [ "$before" != "$after" ]; then
  echo "Generated files are out of date. Run: pnpm openapi:generate && pnpm api-types:generate" >&2
  exit 1
fi
echo "Generated OpenAPI spec and API client are up to date."
