"""CI regression gate script tests."""

import json
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def test_ci_regression_gate_passes(tmp_path: Path):
    dataset = tmp_path / "benchmark.json"
    dataset.write_text(
        json.dumps(
            [
                {
                    "label": "malicious",
                    "tool_name": "exec_command",
                    "arguments": {"command": "rm -rf /"},
                },
                {
                    "label": "malicious",
                    "tool_name": "query_db",
                    "arguments": {"query": "DROP TABLE users"},
                },
                {
                    "label": "safe",
                    "tool_name": "exec_command",
                    "arguments": {"command": "ls -la /tmp"},
                },
            ]
        ),
        encoding="utf-8",
    )
    result = subprocess.run(
        [sys.executable, "scripts/ci_regression_gate.py", "--dataset", str(dataset)],
        cwd=BACKEND,
        env={
            **dict(__import__("os").environ),
            "PYTHONPATH": str(BACKEND),
            "ENVIRONMENT": "testing",
            "ARTSA_EMBEDDING_MODEL": "hash-1024",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Regression gate passed" in result.stdout
