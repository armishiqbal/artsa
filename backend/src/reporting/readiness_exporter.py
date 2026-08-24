"""Go-live readiness report exporter — OWASP LLM / MITRE ATLAS mapped validation suite."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)


class ReadinessReportExporter:
    """Executive readiness artifact from Get Started validation + ingest smoke test."""

    def __init__(self, report: dict[str, Any]) -> None:
        self.report = report or {}
        self.generated_at = self.report.get("generated_at", datetime.now(UTC).isoformat())
        self.readiness_pct = int(self.report.get("readiness_pct", 0))
        self.suite = list(self.report.get("suite", []))
        self.ingest = self.report.get("ingest_smoke_test") or {}

    def _suite_pass_count(self) -> int:
        return sum(1 for row in self.suite if row.get("passed"))

    def _suite_total(self) -> int:
        return len(self.suite)

    def _sign_off_status(self) -> str:
        if self.readiness_pct >= 80:
            return "READY FOR PRODUCTION"
        if self.readiness_pct >= 55:
            return "CONDITIONAL — complete ingest verification"
        return "NOT READY — address failed tests"

    def export_json(self) -> dict[str, Any]:
        return {
            "generated_at": self.generated_at,
            "product": self.report.get("product", "ARTSA Containment"),
            "readiness_pct": self.readiness_pct,
            "sign_off_status": self._sign_off_status(),
            "suite_pass": self._suite_pass_count(),
            "suite_total": self._suite_total(),
            "suite": self.suite,
            "ingest_smoke_test": self.ingest or None,
            "owasp_coverage": [
                {
                    "id": row.get("owasp"),
                    "label": row.get("label"),
                    "passed": row.get("passed"),
                    "verdict": row.get("verdict"),
                    "risk": row.get("risk"),
                }
                for row in self.suite
                if row.get("owasp")
            ],
        }

    def export_markdown(self) -> str:
        passed = self._suite_pass_count()
        total = self._suite_total()
        ingest = self.ingest or {}
        rows = []
        for row in self.suite:
            status = "PASS" if row.get("passed") else "FAIL" if row.get("passed") is False else "—"
            rows.append(
                f"| {row.get('owasp', '—')} | {row.get('label', row.get('id', '—'))} | {status} | "
                f"{row.get('risk', '—')} | {row.get('verdict', '—')} | {row.get('atlas', '—')} |"
            )
        suite_table = "\n".join(rows) if rows else "| — | No tests run | — | — | — | — |"

        ingest_block = ""
        if ingest:
            ingest_block = f"""
## Ingest smoke test
- **Session**: `{ingest.get('sessionId', '—')}`
- **Latency**: {ingest.get('latencyMs', '—')} ms
- **Risk score**: {ingest.get('risk', '—')}
- **Verdict**: {ingest.get('verdict', '—')}
- **Action**: {ingest.get('action', '—')}
"""
        else:
            ingest_block = "\n## Ingest smoke test\nNot completed — send a test event from Get Started.\n"

        return f"""# ARTSA Go-Live Readiness Report

- **Generated**: {self.generated_at}
- **Readiness score**: **{self.readiness_pct}%**
- **Sign-off status**: **{self._sign_off_status()}**
- **Security tests**: {passed}/{total} passed

---

## Validation suite (OWASP LLM / MITRE ATLAS)

| OWASP | Scenario | Result | Risk | Verdict | MITRE ATLAS |
| :-- | :-- | :-- | :-- | :-- | :-- |
{suite_table}

{ingest_block}

---

## Recommendations
- Route production agent traffic via `POST /api/v1/ingest` on port **8000** (not the dashboard port).
- Outbound webhooks send alerts **out** — they do not populate Command Center.
- For RAG + Astra: guard queries and retrieved context before the LLM (see RAG integration guide).

---
*ARTSA Containment — automated readiness export*
"""

    @staticmethod
    def _pdf_safe(text: Any) -> str:
        value = str(text)
        try:
            value.encode("latin-1")
            return value
        except UnicodeEncodeError:
            return value.encode("latin-1", errors="replace").decode("latin-1")

    def export_pdf(self) -> bytes:
        from fpdf import FPDF

        passed = self._suite_pass_count()
        total = self._suite_total()
        ingest = self.ingest or {}

        pdf = FPDF()
        pdf.set_auto_page_break(auto=True, margin=18)
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 16)
        pdf.cell(0, 10, "ARTSA GO-LIVE READINESS REPORT", ln=True, align="C")
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 6, f"Generated {self._pdf_safe(self.generated_at)}", ln=True, align="C")
        pdf.ln(4)

        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, f"Readiness: {self.readiness_pct}% — {self._sign_off_status()}", ln=True)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 6, f"Security tests: {passed}/{total} passed", ln=True)
        pdf.ln(3)

        pdf.set_font("Helvetica", "B", 12)
        pdf.cell(0, 8, "Validation suite", ln=True)
        pdf.set_font("Helvetica", "", 9)
        for row in self.suite:
            status = "PASS" if row.get("passed") else "FAIL" if row.get("passed") is False else "—"
            line = f"{row.get('owasp', '—')} {self._pdf_safe(row.get('label', ''))} [{status}] risk={row.get('risk', '—')}"
            pdf.multi_cell(0, 5, line)

        if ingest:
            pdf.ln(3)
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, "Ingest smoke test", ln=True)
            pdf.set_font("Helvetica", "", 9)
            pdf.cell(0, 6, f"Session: {self._pdf_safe(ingest.get('sessionId', '—'))}", ln=True)
            pdf.cell(0, 6, f"Latency: {ingest.get('latencyMs', '—')} ms", ln=True)
            pdf.cell(0, 6, f"Verdict: {self._pdf_safe(ingest.get('verdict', '—'))} / Action: {self._pdf_safe(ingest.get('action', '—'))}", ln=True)

        raw = pdf.output(dest="S")
        if isinstance(raw, str):
            return raw.encode("latin-1", errors="replace")
        return bytes(raw)

    def export_json_bytes(self) -> bytes:
        return json.dumps(self.export_json(), indent=2).encode("utf-8")
