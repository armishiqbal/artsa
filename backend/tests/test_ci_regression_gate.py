"""CI regression gate script tests."""

import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def test_ci_regression_gate_passes():
    result = subprocess.run(
        [sys.executable, "scripts/ci_regression_gate.py"],
        cwd=BACKEND,
        env={**dict(__import__("os").environ), "PYTHONPATH": str(BACKEND), "ENVIRONMENT": "testing"},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Regression gate passed" in result.stdout
