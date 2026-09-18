"""Phase 1.2/1.5 tests — canary label-hash decode + gate plumbing + audit smoke."""

import hashlib
import json
from pathlib import Path

CANARY = Path(__file__).resolve().parent.parent / "benchmarks" / "canary_set.json"


def _hash(label: str) -> str:
    return hashlib.sha256(f"canary:{label}:artsa".encode()).hexdigest()


def test_canary_labels_are_hashed_and_decodable():
    data = json.loads(CANARY.read_text(encoding="utf-8"))
    samples = data["samples"]
    assert len(samples) >= 20
    labels = set()
    for s in samples:
        assert s["label_hash"] not in ("malicious", "safe"), (
            "labels must not be stored in plaintext"
        )
        for candidate in ("malicious", "safe"):
            if s["label_hash"] == _hash(candidate):
                labels.add(candidate)
    assert labels == {"malicious", "safe"}, "both classes must be represented"


def test_canary_gate_runs_and_reports_aggregates_only():
    """The gate prints only aggregate metrics — no sample-level ground truth."""
    import subprocess
    import sys

    result = subprocess.run(
        [sys.executable, "scripts/canary_gate.py"],
        capture_output=True,
        text=True,
        check=False,
        env={"ENVIRONMENT": "testing", "PYTHONPATH": "."},
        cwd=str(Path(__file__).resolve().parent.parent),
    )
    out = result.stdout + result.stderr
    assert "recall@80" in out
    # Ground truth is never printed: no tool_name/arguments of the samples.
    assert "label_hash" not in out
    # The held-out canary set now meets the documented release floors.
    assert result.returncode == 0
    assert "Canary gate passed." in out


def test_contamination_audit_smoke():
    import subprocess
    import sys

    result = subprocess.run(
        [sys.executable, "scripts/contamination_audit.py"],
        capture_output=True,
        text=True,
        check=False,
        env={"ENVIRONMENT": "testing", "PYTHONPATH": "."},
        cwd=str(Path(__file__).resolve().parent.parent),
    )
    assert result.returncode == 0
    assert "self-referentiality" in result.stdout.lower()


def test_independence_check_and_gate_smoke(tmp_path: Path):
    import subprocess
    import sys

    backend = str(Path(__file__).resolve().parent.parent)
    benchmark_path = tmp_path / "benchmark.json"
    independent_path = tmp_path / "independent.json"
    benchmark_path.write_text(
        json.dumps(
            [
                {
                    "label": "safe",
                    "tool_name": "read_file",
                    "arguments": {"path": "/docs/guide.txt"},
                },
                {
                    "label": "malicious",
                    "tool_name": "exec_command",
                    "arguments": {"command": "rm -rf /"},
                },
            ]
        ),
        encoding="utf-8",
    )
    independent_path.write_text(
        json.dumps(
            {
                "samples": [
                    {
                        "label": "safe",
                        "tool_name": "read_file",
                        "arguments": {"path": "/reports/status.txt"},
                    },
                    {
                        "label": "malicious",
                        "class": "destructive",
                        "tool_name": "exec_command",
                        "arguments": {"command": "rm -rf /tmp/isolated"},
                    },
                ]
            }
        ),
        encoding="utf-8",
    )

    common = {"ENVIRONMENT": "testing", "PYTHONPATH": ".", "ARTSA_EMBEDDING_MODEL": "hash-1024"}
    independence = subprocess.run(
        [
            sys.executable,
            "scripts/check_independence.py",
            "--benchmark",
            str(benchmark_path),
            "--independent",
            str(independent_path),
        ],
        capture_output=True,
        text=True,
        check=False,
        env=common,
        cwd=backend,
    )
    assert independence.returncode == 0, independence.stdout + independence.stderr

    result = subprocess.run(
        [sys.executable, "scripts/independent_gate.py", "--dataset", str(independent_path)],
        capture_output=True,
        text=True,
        check=False,
        env=common,
        cwd=backend,
    )
    assert "recall@80" in result.stdout
    assert "No floor applied" in result.stdout
