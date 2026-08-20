"""Phase 3.2 — independent scoring vs external guardrails (Lakera / Azure).

Runs the SAME independent-set samples through ARTSA and, when provider keys are
configured, through Lakera Guard and Microsoft Azure AI Content Safety, then
writes a comparison table to ``docs/COMPARISON.md``.

A real comparison table, not marketing: every provider scores the identical
samples; recall/FPR are computed per provider on the same ground truth.

Usage:
    ARTSA_EMBEDDING_MODEL=local-bge-multilingual PYTHONPATH=. \
        python scripts/external_comparison.py [--limit N]

Optional provider keys (absent → that provider is skipped and marked n/a):
    LAKERA_API_KEY=...                     # https://platform.lakera.ai
    AZURE_CS_ENDPOINT=https://<res>.cognitiveservices.azure.com
    AZURE_CS_KEY=...                       # Ocp-Apim-Subscription-Key

Without any external keys the script still produces ARTSA's honest numbers and
the methodology table — the comparison column is only as real as the keys.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

import httpx
from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent

INDEPENDENT = Path(__file__).resolve().parent.parent / "benchmarks" / "independent_set.json"
COMPARISON_OUT = Path(__file__).resolve().parent.parent.parent / "docs" / "COMPARISON.md"

MAX_SAMPLES = 200  # external API budget guard (cost + rate limits)


def _samples(limit: int) -> list[dict]:
    data = json.loads(INDEPENDENT.read_text(encoding="utf-8"))
    return data["samples"][:limit]


def _args_text(s: dict) -> str:
    return str(s.get("arguments", {}))


def artsa_scores(samples: list[dict]) -> list[float]:
    engine = ContainmentEngine()
    scores: list[float] = []
    for s in samples:
        event = ToolCallEvent(
            session_id=uuid.uuid4(),
            agent_id="cmp",
            tool_name=s["tool_name"],
            arguments=s["arguments"],
        )
        risk, _, _ = engine.evaluate_event(event)
        scores.append(risk.overall_score)
    return scores


def lakera_flags(samples: list[dict], key: str) -> list[bool | None]:
    """Lakera Guard /prompt_injection — flagged = the API judged the content
    to contain a prompt injection."""
    flags: list[bool | None] = []
    with httpx.Client(timeout=30.0) as client:
        for s in samples:
            try:
                r = client.post(
                    "https://api.lakera.ai/v1/prompt_injection",
                    headers={"Authorization": f"Bearer {key}"},
                    json={"messages": [{"role": "user", "content": _args_text(s)}]},
                )
                r.raise_for_status()
                data = r.json()
                flagged = bool(data.get("results", [{}])[0].get("flagged"))
                flags.append(flagged)
            except Exception as exc:
                print(f"  [lakera] sample failed: {exc}", file=sys.stderr)
                flags.append(None)
    return flags


def azure_flags(samples: list[dict], endpoint: str, key: str) -> list[bool | None]:
    """Azure AI Content Safety analyze — flagged = any category severity >= 2."""
    flags: list[bool | None] = []
    url = f"{endpoint.rstrip('/')}/contentsafety/text:analyze?api-version=2023-10-01"
    with httpx.Client(timeout=30.0) as client:
        for s in samples:
            try:
                r = client.post(
                    url,
                    headers={"Ocp-Apim-Subscription-Key": key},
                    json={"text": _args_text(s)},
                )
                r.raise_for_status()
                cats = r.json().get("categoriesAnalysis", [])
                flagged = any(int(c.get("severity", 0)) >= 2 for c in cats)
                flags.append(flagged)
            except Exception as exc:
                print(f"  [azure] sample failed: {exc}", file=sys.stderr)
                flags.append(None)
    return flags


def _metrics(
    labels: list[str], scores: list[float], flags: list[bool | None], provider: str
) -> dict:
    mal_idx = [i for i, l in enumerate(labels) if l == "malicious"]
    safe_idx = [i for i, l in enumerate(labels) if l == "safe"]
    out: dict = {}
    if provider == "artsa":
        out["recall@80"] = round(sum(1 for i in mal_idx if scores[i] >= 80) / len(mal_idx), 4)
        out["recall@50"] = round(sum(1 for i in mal_idx if scores[i] >= 50) / len(mal_idx), 4)
        out["fpr@50"] = round(sum(1 for i in safe_idx if scores[i] >= 50) / len(safe_idx), 4)
    else:
        ok = [i for i in mal_idx if flags[i] is not None]
        ok_safe = [i for i in safe_idx if flags[i] is not None]
        out["recall_flagged"] = round(sum(1 for i in ok if flags[i]) / len(ok), 4) if ok else None
        out["fpr_flagged"] = (
            round(sum(1 for i in ok_safe if flags[i]) / len(ok_safe), 4) if ok_safe else None
        )
        out["scored"] = len(ok) + len(ok_safe)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="ARTSA vs external guardrail comparison")
    parser.add_argument(
        "--limit",
        type=int,
        default=MAX_SAMPLES,
        help=f"cap samples (default {MAX_SAMPLES}; external APIs are rate-limited)",
    )
    args = parser.parse_args()

    samples = _samples(args.limit)
    labels = [s["label"] for s in samples]
    print(
        f"Comparison set: {len(samples)} samples "
        f"({labels.count('malicious')} malicious / {labels.count('safe')} safe)"
    )

    scores = artsa_scores(samples)
    artsa = _metrics(labels, scores, [], "artsa")

    lakera_key = os.environ.get("LAKERA_API_KEY")
    azure_ep = os.environ.get("AZURE_CS_ENDPOINT")
    azure_key = os.environ.get("AZURE_CS_KEY")

    lakera = {"recall_flagged": None, "fpr_flagged": None, "scored": 0}
    if lakera_key:
        print("Scoring Lakera Guard…")
        flags = lakera_flags(samples, lakera_key)
        lakera = _metrics(labels, [], flags, "external")
    else:
        print("  (no LAKERA_API_KEY — Lakera column n/a)")

    azure = {"recall_flagged": None, "fpr_flagged": None, "scored": 0}
    if azure_ep and azure_key:
        print("Scoring Azure AI Content Safety…")
        flags = azure_flags(samples, azure_ep, azure_key)
        azure = _metrics(labels, [], flags, "external")
    else:
        print("  (no AZURE_CS_ENDPOINT/AZURE_CS_KEY — Azure column n/a)")

    rows = [
        ("ARTSA", artsa),
        ("Lakera Guard", lakera),
        ("Azure AI Content Safety", azure),
    ]
    md = [
        "# ARTSA vs External Guardrails — Comparison",
        "",
        (
            f"**Generated:** 2026-08-20  ·  **Set:** `benchmarks/independent_set.json` "
            f"({labels.count('malicious')} malicious / {labels.count('safe')} safe samples, first {len(samples)})"
        ),
        "",
        "> Honesty rule: ARTSA scores every sample with its calibrated engine; external",
        "> providers are scored via their public APIs on the IDENTICAL samples. ARTSA",
        "> recall@80/FPR@50 use its calibrated KILL/review bands; external providers",
        "> report their binary 'flagged' decision at any severity. Columns marked n/a",
        "> mean no API key was configured for this run.",
        "",
        "| Provider | recall | FPR | notes |",
        "|---|---|---|---|",
    ]
    for name, m in rows:
        if name == "ARTSA":
            md.append(
                f"| {name} | recall@80 **{m['recall@80']}** / recall@50 {m['recall@50']} "
                f"| fpr@50 {m['fpr@50']} | calibrated bands; embedding "
                f"`local-bge-multilingual` |"
            )
        else:
            scored = m.get("scored", 0)
            md.append(
                f"| {name} | {m['recall_flagged'] if m['recall_flagged'] is not None else 'n/a'} "
                f"| {m['fpr_flagged'] if m['fpr_flagged'] is not None else 'n/a'} "
                f"| binary flagged; {scored} samples scored |"
            )
    md.append("")
    md.append("## Methodology")
    md.append(
        "- Same samples, same order, per provider. ARTSA: "
        "`backend/scripts/external_comparison.py` → ContainmentEngine (see "
        "`docs/BENCHMARK_METHODOLOGY.md`)."
    )
    md.append(
        "- Lakera: `POST https://api.lakera.ai/v1/prompt_injection` (Bearer key). "
        "Azure: `POST /contentsafety/text:analyze` (Ocp-Apim-Subscription-Key); "
        "flagged = any category severity ≥ 2."
    )
    md.append("- External providers are black-boxed: no calibration, binary decisions only.")
    COMPARISON_OUT.write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"Comparison written to {COMPARISON_OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
