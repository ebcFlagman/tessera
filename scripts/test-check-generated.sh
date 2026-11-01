#!/usr/bin/env bash
# Verifies that scripts/check-generated.sh fails for a stale spec and passes for a fresh one.
set -euo pipefail
cd "$(dirname "$0")/.."
spec=apps/api/openapi.generated.json
backup=$(mktemp)
cp "$spec" "$backup"
trap 'cp "$backup" "$spec"; rm -f "$backup"' EXIT

bash scripts/check-generated.sh >/dev/null
echo '{}' > "$spec"
if bash scripts/check-generated.sh >/dev/null 2>&1; then
  echo "FAIL: stale spec was not detected" >&2
  exit 1
fi
echo "OK: stale spec detected, fresh spec accepted"
