"""Load the Agentic AI Top 10 framework definition from configs.

Keep `frontend/public/agentic_risk_framework.json` in sync when editing the catalog
(offline UI fallback when the containment API is unreachable).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_FRAMEWORK_PATH = _BACKEND_ROOT / "configs" / "agentic_risk_framework.json"


@lru_cache(maxsize=1)
def load_risk_framework() -> list[dict[str, Any]]:
    with _FRAMEWORK_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise TypeError("agentic_risk_framework.json must be a JSON array")
    return data
