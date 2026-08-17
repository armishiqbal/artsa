#!/usr/bin/env bash
# WS-4.2: Fail CI when README-documented thresholds / routes / SLO drift from
# the code and configuration they describe. A security product whose docs claim
# one thing and whose engine enforces another is a trust problem for auditors.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
README="$ROOT/README.md"
SEVERITY="$ROOT/backend/src/core/severity.py"
CONFIG="$ROOT/backend/src/core/config.py"
HEALTH="$ROOT/backend/src/api/routes/health.py"
failures=0

fail() { echo "ERROR: $1" >&2; failures=$((failures + 1)); }

check_doc_matches_code() {
  local doc_label="$1" doc_pattern="$2" file="$3" code_pattern="$4" what="$5"
  if ! grep -Eq "$doc_pattern" "$README"; then
    fail "README no longer documents '$doc_label'"
  fi
  if ! grep -Eq "$code_pattern" "$file"; then
    fail "$what: code no longer matches README claim '$doc_label'"
  fi
}

# 1. Verdict bands: README says ">= 80 KILL, >= 50 QUARANTINE".
check_doc_matches_code "KILL band >= 80" '>= 80|80 - 100' \
  "$SEVERITY" 'CRITICAL_RISK_THRESHOLD = 80\.0' "severity.py"
check_doc_matches_code "QUARANTINE band >= 50" '>= 50|50 - 79' \
  "$SEVERITY" 'HIGH_RISK_THRESHOLD = 50\.0' "severity.py"

# 2. Proxy is deliberately stricter: README says ARTSA_PROXY_BLOCK_THRESHOLD=60.
check_doc_matches_code "proxy block threshold 60" 'ARTSA_PROXY_BLOCK_THRESHOLD=60|ARTSA_PROXY_BLOCK_THRESHOLD`\s*=\s*60|`>= 60`' \
  "$CONFIG" 'ARTSA_PROXY_BLOCK_THRESHOLD: float = 60\.0' "config.py"

# 3. Liveness/readiness probes documented in README must exist in code.
check_doc_matches_code "/health route" 'GET /health|`/health`' \
  "$HEALTH" '@router.get\("/health"\)' "health.py"
check_doc_matches_code "/ready route" 'GET /ready|`/ready`' \
  "$HEALTH" '@router.get\("/ready"\)' "health.py"

# 4. Latency SLO: README claims "less than 0.05 seconds" (50 ms).
check_doc_matches_code "latency SLO 50ms / 0.05s" '0\.05|50 ms|50ms' \
  "$CONFIG" 'EDS_LATENCY_THRESHOLD_MS: float = 50\.0' "config.py"

if [[ $failures -gt 0 ]]; then
  echo "doc↔config sync check FAILED ($failures drift(s)). Fix the docs or the code — they must agree." >&2
  exit 1
fi

echo "OK: README thresholds/routes/SLO match backend code and config"
