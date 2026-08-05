#!/usr/bin/env bash
# Sync Agentic Risk Framework JSON: backend config → frontend public (offline fallback).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/backend/configs/agentic_risk_framework.json"
DST="$ROOT/frontend/public/agentic_risk_framework.json"

if [[ ! -f "$SRC" ]]; then
  echo "Missing source: $SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$DST")"
cp "$SRC" "$DST"
echo "Synced $SRC → $DST"
