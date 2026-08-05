#!/usr/bin/env bash
# Fail if frontend public risk framework drifts from backend config.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/backend/configs/agentic_risk_framework.json"
DST="$ROOT/frontend/public/agentic_risk_framework.json"

if [[ ! -f "$DST" ]]; then
  echo "Missing $DST — run scripts/sync_risk_framework.sh" >&2
  exit 1
fi

if ! cmp -s "$SRC" "$DST"; then
  echo "ERROR: agentic_risk_framework.json out of sync." >&2
  echo "Run: bash scripts/sync_risk_framework.sh && git add frontend/public/agentic_risk_framework.json" >&2
  diff -u "$SRC" "$DST" || true
  exit 1
fi

echo "OK: risk framework JSON in sync"
