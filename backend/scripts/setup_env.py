#!/usr/bin/env python3
"""Bootstrap .env from template while preserving existing values."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_EXAMPLE = REPO_ROOT / ".env.example"
ENV_FILE = REPO_ROOT / ".env"
FRONTEND_ENV = REPO_ROOT / "frontend" / ".env.local"
FRONTEND_EXAMPLE = REPO_ROOT / "frontend" / ".env.local.example"


def parse_env(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, val = line.partition("=")
            result[key.strip()] = val.strip()
    return result


def format_env(template: str, existing: dict[str, str]) -> str:
    # Never carry secret keys into NEXT_PUBLIC_* vars
    for key in list(existing.keys()):
        if key.startswith("NEXT_PUBLIC_") and any(x in key for x in ("KEY", "TOKEN", "SECRET", "PINECONE")):
            del existing[key]

    lines_out: list[str] = []
    for line in template.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if existing.get(key):
                lines_out.append(f"{key}={existing[key]}")
                continue
        lines_out.append(line)
    return "\n".join(lines_out) + "\n"


def main() -> int:
    if not ENV_EXAMPLE.exists():
        print(f"Missing {ENV_EXAMPLE}", file=sys.stderr)
        return 1

    existing: dict[str, str] = {}
    if ENV_FILE.exists():
        existing = parse_env(ENV_FILE.read_text(encoding="utf-8"))
        backup = ENV_FILE.parent / f"{ENV_FILE.name}.bak"
        shutil.copy(ENV_FILE, backup)
        print(f"Backed up existing .env → {backup.name}")

    template = ENV_EXAMPLE.read_text(encoding="utf-8")
    merged = format_env(template, existing)
    merged_keys = parse_env(merged)
    if existing and len(merged_keys) < max(3, len(existing) // 2):
        print("ERROR: merge would drop too many keys — aborting.", file=sys.stderr)
        return 1
    ENV_FILE.write_text(merged, encoding="utf-8")
    print(f"Wrote {ENV_FILE}")

    if FRONTEND_EXAMPLE.exists():
        if not FRONTEND_ENV.exists():
            shutil.copy(FRONTEND_EXAMPLE, FRONTEND_ENV)
            print(f"Created {FRONTEND_ENV}")
        else:
            print(f"Kept existing {FRONTEND_ENV}")

    configured = sum(1 for k, v in parse_env(merged).items() if v and ("KEY" in k or "TOKEN" in k or k == "DATABASE_URL"))
    print(f"\nDone. {configured} credential field(s) already set in {ENV_FILE}.")
    print("Verify status: curl http://localhost:8000/api/v1/config/keys")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
