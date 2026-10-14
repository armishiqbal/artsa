"""EU AI Act, NIST AI RMF, OWASP Agentic & LLM Top 10, ISO 42001 & Cryptographic HMAC Audit Exporter.

Generates executive-ready audit artifacts in Markdown, JSON, and PDF formats
from campaign summaries, mapped to major AI governance frameworks with
mathematical HMAC non-repudiation cryptographic verification proofs.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

# OWASP Top 10 for Agentic Applications (ASI01–ASI10)
OWASP_AGENTIC_TOP10: list[dict[str, str]] = [
    {
        "id": "ASI01",
        "name": "Agent Goal Hijack",
        "control": "PromptInjectionDetector, GoalDriftDetector & Semantic Guardrails",
        "description": "Adversarial prompt injection diverting the agent from operator goals.",
    },
    {
        "id": "ASI02",
        "name": "Tool Misuse & Exploitation",
        "control": "Granular Tool Quarantine API & McpDestructiveToolDetector",
        "description": "Unauthorized execution or destructive parameter manipulation in tools.",
    },
    {
        "id": "ASI03",
        "name": "Identity & Privilege Abuse",
        "control": "RBAC Token Scoping & MCP Action Approval Gateway",
        "description": "Impersonation or escalation of privileges through downstream tool calls.",
    },
    {
        "id": "ASI04",
        "name": "Agentic Supply Chain Vulnerabilities",
        "control": "NVD Feed Ingestion & Model Hash Attestation",
        "description": "Compromised third-party packages, plugins, or unverified model checkpoints.",
    },
    {
        "id": "ASI05",
        "name": "Unexpected Code Execution",
        "control": "AST Code Validator & Subprocess Containment Sandbox",
        "description": "Arbitrary command execution or SQL injection triggered via generated outputs.",
    },
    {
        "id": "ASI06",
        "name": "Memory & Context Poisoning",
        "control": "DynamicSemanticRegistry & Session Context Isolation",
        "description": "Corrupting conversation context or RAG stores with malicious persistent memory.",
    },
    {
        "id": "ASI07",
        "name": "Insecure Inter-Agent Communication",
        "control": "HMAC-SHA256 Signed Envelopes with Redis Replay Nonces",
        "description": "Man-in-the-middle tampering or replay attacks on inter-agent handoffs.",
    },
    {
        "id": "ASI08",
        "name": "Cascading Failures",
        "control": "SessionCircuitBreaker with Fail-Closed Trip Thresholds",
        "description": "Multi-agent loop storms and compounding error cascades across workflows.",
    },
    {
        "id": "ASI09",
        "name": "Human-Agent Trust Exploitation",
        "control": "Human-in-the-Loop Operator Intervention & Step Review",
        "description": "Deceptive interactions manipulating operators to bypass safety approvals.",
    },
    {
        "id": "ASI10",
        "name": "Rogue Agents",
        "control": "JudgeAgent Autonomous Verdicts & Immediate Kill-Switch",
        "description": "Agent persistence beyond task boundaries or unmonitored rogue subagents.",
    },
]

# OWASP Top 10 for LLM Applications (2025 edition)
OWASP_LLM_TOP10: list[dict[str, str]] = [
    {"id": "LLM01", "name": "Prompt Injection", "control": "Input validation & prompt sandboxing with detection layers"},
    {"id": "LLM02", "name": "Sensitive Information Disclosure", "control": "PII redaction, data-loss prevention, output filtering"},
    {"id": "LLM03", "name": "Supply Chain", "control": "Model provenance, SBOM, dependency vulnerability scanning"},
    {"id": "LLM04", "name": "Data and Model Poisoning", "control": "Training/retrieval data integrity & provenance checks"},
    {"id": "LLM05", "name": "Improper Output Handling", "control": "Output encoding, sandboxing, and downstream validation"},
    {"id": "LLM06", "name": "Excessive Agency", "control": "Least-privilege tool permissions, HITL approval for risky actions"},
    {"id": "LLM07", "name": "System Prompt Leakage", "control": "System prompt confidentiality & extraction monitoring"},
    {"id": "LLM08", "name": "Vector and Embedding Weaknesses", "control": "Embedding store hardening & retrieval ACLs"},
    {"id": "LLM09", "name": "Misinformation", "control": "Grounding, citation enforcement, hallucination evaluation"},
    {"id": "LLM10", "name": "Unbounded Consumption", "control": "Rate limiting, token budgets, cost anomaly detection"},
]

# ISO/IEC 42001 AI Management System (AIMS) clauses
ISO_42001_CLAUSES: list[dict[str, str]] = [
    {"id": "4", "name": "Context of the organization", "control": "AI system inventory & risk context documented"},
    {"id": "5", "name": "Leadership", "control": "AI governance policy, roles & responsibilities assigned"},
    {"id": "6", "name": "Planning", "control": "AI risk treatment plan & objectives defined"},
    {"id": "7", "name": "Support", "control": "Competence, awareness & documentation controls"},
    {"id": "8", "name": "Operation", "control": "AI lifecycle operational controls incl. red-teaming"},
    {"id": "9", "name": "Performance evaluation", "control": "Monitoring, measurement & internal audit"},
    {"id": "10", "name": "Improvement", "control": "Continual improvement & corrective action"},
]


class ComplianceReportExporter:
    """Exports executive-ready compliance audit packages with cryptographic proofs."""

    def __init__(
        self,
        campaign_summary: dict[str, Any],
        *,
        hmac_audit_records: list[dict[str, Any]] | None = None,
    ) -> None:
        self.summary = campaign_summary or {}
        self.campaign_id = str(self.summary.get("campaign_id", self.summary.get("id", "unknown")))
        self.model = str(self.summary.get("model") or "Not provided")
        self.provider = str(self.summary.get("provider") or "Not provided")
        self.results_by_verdict = self.summary.get("results_by_verdict", {}) or {}
        self.total_rounds = self._optional_int(self.summary.get("total_rounds"))
        self.hmac_audit_records = hmac_audit_records or []

    @staticmethod
    def _optional_float(value: Any) -> float | None:
        if isinstance(value, bool):
            return None
        if value is None:
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed == parsed and abs(parsed) != float("inf") else None

    @staticmethod
    def _optional_int(value: Any) -> int | None:
        if isinstance(value, bool):
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return parsed if parsed >= 0 else None

    # ── Derived metrics ─────────────────────────────────────────────────────

    def _overall_readiness(self) -> dict[str, Any]:
        """Framework readiness needs control evidence, not campaign scores."""
        return {"score": None, "level": "NOT_ASSESSED"}

    # ── CVSS v4 ─────────────────────────────────────────────────────────────

    def calculate_cvss_v4(self) -> dict[str, Any]:
        """Do not label a campaign heuristic as an official CVSS v4 score."""
        return {
            "score": None,
            "severity": "NOT_ASSESSED",
            "vector_string": None,
            "reason": "This exporter does not perform a CVSS v4 assessment.",
        }

    # ── EU AI Act ───────────────────────────────────────────────────────────

    def generate_eu_ai_act_article_15_audit(self) -> dict[str, Any]:
        """Campaign outcomes alone do not establish regulatory compliance."""
        return {
            "regulation": "EU AI Act - High-Risk AI Requirement (Article 15)",
            "clause": "Technical Robustness, Cybersecurity & Accuracy Resilience",
            "compliance_status": "NOT_ASSESSED",
            "evaluations": [
                {
                    "requirement": "Resistance to Adversarial Prompt Injection & Jailbreaks",
                    "status": "NOT_ASSESSED",
                    "finding": "No Article 15 control evidence was supplied.",
                },
                {
                    "requirement": "Model System Prompt Integrity & Confidentiality",
                    "status": "NOT_ASSESSED",
                    "finding": "No Article 15 control evidence was supplied.",
                },
            ],
        }

    # ── NIST AI RMF ─────────────────────────────────────────────────────────

    def generate_nist_ai_rmf_audit(self) -> dict[str, Any]:
        """Return explicit assessment gaps instead of framework claims."""
        return {
            "framework": "NIST AI Risk Management Framework (AI RMF 1.0)",
            "functions": {
                "GOVERN_1.2": "NOT_ASSESSED: no NIST control evidence was supplied.",
                "MAP_1.1": "NOT_ASSESSED: no NIST control evidence was supplied.",
                "MEASURE_2.6": "NOT_ASSESSED: no NIST control evidence was supplied.",
                "MANAGE_2.2": "NOT_ASSESSED: no NIST control evidence was supplied.",
            },
        }

    def generate_nist_ai_rmf_scorecard(self) -> dict[str, Any]:
        """Campaign summaries do not provide evidence for a NIST scorecard."""
        functions = [
            {
                "function": "GOVERN",
                "code": "GOVERN 1.1 / 1.2",
                "title": "Governance, Policies & Risk Tolerances",
                "status": "NOT_ASSESSED",
                "score": None,
                "evidence": "No structured NIST control evidence was supplied.",
            },
            {
                "function": "MAP",
                "code": "MAP 1.1 / 1.5",
                "title": "Threat Surface Categorization & Threat Feeds",
                "status": "NOT_ASSESSED",
                "score": None,
                "evidence": "No structured NIST control evidence was supplied.",
            },
            {
                "function": "MEASURE",
                "code": "MEASURE 2.6 / 2.7",
                "title": "Robustness Benchmarks & Bypass Depth",
                "status": "NOT_ASSESSED",
                "score": None,
                "evidence": "Campaign metrics do not establish NIST control effectiveness.",
            },
            {
                "function": "MANAGE",
                "code": "MANAGE 2.2 / 2.4",
                "title": "Dynamic Remediation & Incident Response",
                "status": "NOT_ASSESSED",
                "score": None,
                "evidence": "No structured NIST control evidence was supplied.",
            },
        ]
        return {
            "framework": "NIST AI Risk Management Framework (AI RMF 1.0)",
            "composite_score": None,
            "functions": functions,
        }

    # ── OWASP Top 10 for LLM Applications ───────────────────────────────────

    def generate_owasp_llm_top10(self) -> dict[str, Any]:
        """A campaign summary is not an OWASP LLM control assessment."""
        rows = [
            {
                **item,
                "status": "NOT_ASSESSED",
                "finding": "No control evidence for this framework item was supplied.",
            }
            for item in OWASP_LLM_TOP10
        ]
        return {
            "framework": "OWASP Top 10 for LLM Applications (2025)",
            "rows": rows,
            "summary": {
                "passed": 0,
                "failed": 0,
                "not_assessed": len(rows),
                "compliance_score": None,
            },
        }

    # ── OWASP Top 10 for Agentic Applications (ASI01–ASI10) ───────────────────

    def generate_owasp_agentic_top10(self) -> dict[str, Any]:
        """Do not infer standards compliance from campaign verdicts or code names."""
        rows = [
            {
                "id": item["id"],
                "name": item["name"],
                "control": item["control"],
                "description": item["description"],
                "status": "NOT_ASSESSED",
                "finding": "No control evidence for this framework item was supplied.",
            }
            for item in OWASP_AGENTIC_TOP10
        ]

        return {
            "framework": "OWASP Top 10 for Agentic Applications (ASI01-ASI10)",
            "compliance_score": None,
            "rows": rows,
            "summary": {
                "compliant": 0,
                "partial": 0,
                "flagged": 0,
                "not_assessed": len(rows),
                "total": len(rows),
            },
        }

    # ── Cryptographic HMAC Non-Repudiation Proofs ───────────────────────────

    def generate_hmac_audit_proofs(self) -> dict[str, Any]:
        """Compute cryptographic non-repudiation proofs from inter-agent HMAC ledger."""
        records = self.hmac_audit_records

        total_hops = len(records)
        verified_hops = sum(
            1 for r in records
            if r.get("hmac_state") == "ok" or r.get("signature_status") == "verified"
        )
        failed_hops = sum(
            1 for r in records
            if r.get("hmac_state") == "fail" or r.get("signature_status") == "failed"
        )
        replays = sum(1 for r in records if r.get("replay_detected") is True)
        required_fields_present = all(
            isinstance(record.get(field), str) and bool(record.get(field))
            for record in records
            for field in ("event_id", "nonce_sha256", "body_sha256")
        )

        # Compute chained Merkle / accumulator root hash
        hop_hashes = (
            [
                hashlib.sha256(
                    f"{r['event_id']}:{r['nonce_sha256']}:{r['body_sha256']}".encode("utf-8")
                ).digest()
                for r in records
            ]
            if records and required_fields_present
            else []
        )
        while len(hop_hashes) > 1:
            nxt: list[bytes] = []
            for i in range(0, len(hop_hashes), 2):
                left = hop_hashes[i]
                right = hop_hashes[i + 1] if i + 1 < len(hop_hashes) else left
                nxt.append(hashlib.sha256(left + right).digest())
            hop_hashes = nxt
        merkle_root = hop_hashes[0].hex() if hop_hashes else None
        unverified_hops = total_hops - verified_hops - failed_hops
        status = "UNVERIFIED"
        if total_hops and required_fields_present and unverified_hops == 0:
            status = (
                "CRYPTOGRAPHICALLY_VERIFIED"
                if failed_hops == 0 and replays == 0
                else "VERIFICATION_FAILED"
            )

        return {
            "proof_version": "1.0",
            "algorithm": "HMAC-SHA256",
            "replay_protection": "Verified from recorded audit evidence" if status == "CRYPTOGRAPHICALLY_VERIFIED" else "UNVERIFIED",
            "non_repudiation_status": status,
            "total_signed_hops": total_hops,
            "verified_hops": verified_hops,
            "failed_hops": failed_hops,
            "unverified_hops": unverified_hops,
            "replays_detected": replays,
            "merkle_root_hash": merkle_root,
            "audit_chain": records[:10],
        }

    # ── Adaptive Defense Lift Summary ────────────────────────────────────────

    def generate_adaptive_lift_summary(self) -> dict[str, Any]:
        """Compute campaign outcome rate only from explicit judged outcomes."""
        verdicts = self.results_by_verdict if isinstance(self.results_by_verdict, dict) else {}
        observed_counts = {
            label: self._optional_int(verdicts.get(label))
            for label in ("BLOCKED", "SUCCESS", "PARTIAL", "BREACHED", "ATTACK_SUCCESS")
        }
        has_verdict_counts = any(value is not None for value in observed_counts.values())
        blocked = observed_counts["BLOCKED"] or 0
        successful = sum(
            observed_counts[label] or 0
            for label in ("SUCCESS", "PARTIAL", "BREACHED", "ATTACK_SUCCESS")
        )
        judged = blocked + successful if has_verdict_counts else None
        adaptive_rate = self._optional_float(self.summary.get("adaptive_detection_rate"))
        if adaptive_rate is not None and not 0 <= adaptive_rate <= 100:
            adaptive_rate = None
        if adaptive_rate is None and judged is not None and judged > 0:
            adaptive_rate = round((blocked / judged) * 100.0, 1)

        baseline_rate = self._optional_float(self.summary.get("baseline_detection_rate"))
        if baseline_rate is not None and not 0 <= baseline_rate <= 100:
            baseline_rate = None
        if baseline_rate is None:
            baseline_blocked = self._optional_float(self.summary.get("baseline_blocked_rounds"))
            baseline_total = self._optional_float(self.summary.get("baseline_total_rounds"))
            if (
                baseline_blocked is not None
                and baseline_total is not None
                and baseline_total > 0
                and baseline_blocked <= baseline_total
            ):
                baseline_rate = round((baseline_blocked / baseline_total) * 100.0, 1)

        lift_pct = (
            round(adaptive_rate - baseline_rate, 1)
            if adaptive_rate is not None and baseline_rate is not None
            else None
        )

        return {
            "static_baseline_detection_rate": baseline_rate,
            "adaptive_defense_detection_rate": adaptive_rate,
            "adaptive_lift_percent": lift_pct,
            "judged_outcomes": judged,
            "hot_patches_applied": self.summary.get("dynamic_rules_added"),
            "tools_quarantined": self.summary.get("tools_quarantined"),
            "co_evolution_status": self.summary.get("co_evolution_status", "NOT_ASSESSED"),
            "containment_tier_distribution": self.summary.get("containment_tier_distribution"),
        }

    # ── ISO/IEC 42001 ───────────────────────────────────────────────────────

    def generate_iso_42001(self) -> dict[str, Any]:
        """Map findings to ISO/IEC 42001 AI Management System readiness."""
        readiness = self._overall_readiness()
        rows = [
            {
                **clause,
                "status": "NOT_ASSESSED",
                "evidence": "No structured ISO/IEC 42001 control evidence was supplied.",
            }
            for clause in ISO_42001_CLAUSES
        ]
        return {
            "framework": "ISO/IEC 42001:2023 - AI Management System (AIMS)",
            "readiness_score": readiness["score"],
            "readiness_level": readiness["level"],
            "controls": rows,
        }

    # ── Full JSON artifact ──────────────────────────────────────────────────

    def export_json(self) -> dict[str, Any]:
        """Assemble the complete machine-readable compliance artifact."""
        return {
            "artifact_type": "ARTSA_EXECUTIVE_COMPLIANCE_AUDIT",
            "version": "2.0",
            "generated_at": datetime.now(UTC).isoformat(),
            "campaign": {
                "id": self.campaign_id,
                "model": self.model,
                "provider": self.provider,
                "total_rounds": self.total_rounds,
                "results_by_verdict": self.results_by_verdict,
            },
            "cvss_v4": self.calculate_cvss_v4(),
            "nist_ai_rmf": self.generate_nist_ai_rmf_audit(),
            "nist_ai_rmf_scorecard": self.generate_nist_ai_rmf_scorecard(),
            "owasp_agentic_top10": self.generate_owasp_agentic_top10(),
            "owasp_llm_top10": self.generate_owasp_llm_top10(),
            "hmac_cryptographic_proofs": self.generate_hmac_audit_proofs(),
            "adaptive_defense_lift": self.generate_adaptive_lift_summary(),
            "eu_ai_act": self.generate_eu_ai_act_article_15_audit(),
            "iso_42001": self.generate_iso_42001(),
            "overall_readiness": self._overall_readiness(),
        }

    # ── Markdown ────────────────────────────────────────────────────────────

    def export_markdown_audit_report(self) -> str:
        """Generate executive audit report in Markdown format."""
        cvss = self.calculate_cvss_v4()
        eu = self.generate_eu_ai_act_article_15_audit()
        nist = self.generate_nist_ai_rmf_scorecard()
        asi = self.generate_owasp_agentic_top10()
        hmac_proofs = self.generate_hmac_audit_proofs()
        lift = self.generate_adaptive_lift_summary()
        iso = self.generate_iso_42001()

        asi_rows = "\n".join(
            f"| {r['id']} | {r['name']} | **{r['status']}** | {r['finding']} |" for r in asi["rows"]
        )
        nist_rows = "\n".join(
            f"| {fn['function']} | {fn['code']} | **{fn['status']}** | {fn['score']}% | {fn['evidence']} |"
            for fn in nist["functions"]
        )
        iso_rows = "\n".join(
            f"| {c['id']} | {c['name']} | **{c['status']}** |" for c in iso["controls"]
        )

        return f"""# EXECUTIVE COMPLIANCE AUDIT REPORT & SECURITY BENCHMARK
**ARTSA Autonomous Red Team & Adaptive Defense Architecture**
- **Campaign ID**: `{self.campaign_id}`
- **Target Model**: `{self.model}` (Provider: `{self.provider}`)
- **Timestamp**: `{datetime.now(UTC).isoformat()}`
- **Overall Governance Readiness**: **{iso['readiness_score']}/100** ({iso['readiness_level']})
- **OWASP Agentic Top 10 Score**: **{asi['compliance_score']}/100**
- **NIST AI RMF Composite Score**: **{nist['composite_score']}/100**
- **Cryptographic Non-Repudiation**: **{hmac_proofs['non_repudiation_status']}**

---

## 1. CVSS v4.0 Vulnerability Rating
- **CVSS Score**: **{cvss['score']} / 10.0** ({cvss['severity']})
- **Vector String**: `{cvss['vector_string']}`

---

## 2. NIST AI Risk Management Framework (AI RMF 1.0) Scorecard

| Function | Code | Status | Score | Evidence |
| :-- | :-- | :-- | :-- | :-- |
{nist_rows}

---

## 3. OWASP Top 10 for Agentic Applications (ASI01 - ASI10)

| Code | Threat Category | Compliance Status | Audit Evidence |
| :-- | :-- | :-- | :-- |
{asi_rows}

---

## 4. Cryptographic Non-Repudiation Proofs (HMAC-SHA256 Inter-Agent Ledger)
- **Algorithm**: `{hmac_proofs['algorithm']}`
- **Replay Protection**: `{hmac_proofs['replay_protection']}`
- **Total Signed Hops**: `{hmac_proofs['total_signed_hops']}` (Verified: `{hmac_proofs['verified_hops']}`, Failed: `{hmac_proofs['failed_hops']}`)
- **Recorded audit root hash**:
  ```
  {hmac_proofs['merkle_root_hash']}
  ```
- **Evidence status**: `{hmac_proofs['non_repudiation_status']}`. This report uses the server-supplied audit records; the root hash alone does not establish signature validity.

---

## 5. Autonomous Defender Adaptive Lift Analysis
- **Static Baseline Detection Rate**: `{lift['static_baseline_detection_rate']}%`
- **Adaptive Defense Detection Rate**: `{lift['adaptive_defense_detection_rate']}%`
- **Net Adaptive Resilience Lift**: **+{lift['adaptive_lift_percent']}%**
- **Dynamic Hot-Patches Applied**: `{lift['hot_patches_applied']}` rules
- **Tools Quarantined**: `{lift['tools_quarantined']}` tools
- **Co-Evolution State**: `{lift['co_evolution_status']}`

---

## 6. EU AI Act Article 15 Audit
- **Regulation**: {eu['regulation']}
- **Status**: **{eu['compliance_status']}**
- **Evaluations**:
  - **Prompt Injection Defense**: {eu['evaluations'][0]['status']} - {eu['evaluations'][0]['finding']}
  - **System Prompt Confidentiality**: {eu['evaluations'][1]['status']} - {eu['evaluations'][1]['finding']}

---

## 7. ISO/IEC 42001 Readiness

| Clause | Name | Status |
| :-- | :-- | :-- |
{iso_rows}
"""

    # ── PDF ────────────────────────────────────────────────────────────────

    @staticmethod
    def _pdf_safe(text: Any) -> str:
        """Strip and normalize characters FPDF 1.7 (latin-1) cannot encode."""
        value = str(text)
        replacements = {
            "\u2014": " - ",
            "\u2013": "-",
            "\u2018": "'",
            "\u2019": "'",
            "\u201c": '"',
            "\u201d": '"',
            "\u2022": "*",
            "\u2026": "...",
            "\u2192": "->",
            "\u2713": "[PASS]",
            "\u2717": "[FAIL]",
            "\u200b": "",
        }
        for k, v in replacements.items():
            value = value.replace(k, v)
        try:
            value.encode("latin-1")
            return value
        except UnicodeEncodeError:
            return value.encode("latin-1", errors="replace").decode("latin-1")

    @staticmethod
    def _pdf_value(value: Any) -> str:
        return "Not assessed" if value is None else str(value)

    def export_pdf(self) -> bytes:
        """Generate a PDF report containing campaign, assessment, and proof status."""
        from fpdf import FPDF

        artifact = self.export_json()
        cvss = artifact["cvss_v4"]
        nist = artifact["nist_ai_rmf_scorecard"]
        asi = artifact["owasp_agentic_top10"]
        owasp_llm = artifact["owasp_llm_top10"]
        hmac_proofs = artifact["hmac_cryptographic_proofs"]
        lift = artifact["adaptive_defense_lift"]
        iso = artifact["iso_42001"]
        eu = artifact["eu_ai_act"]
        hmac_status = str(hmac_proofs["non_repudiation_status"])
        merkle_root = hmac_proofs["merkle_root_hash"]
        verified_root = (
            merkle_root
            if hmac_status == "CRYPTOGRAPHICALLY_VERIFIED" and isinstance(merkle_root, str)
            else None
        )

        class ArtsaPDF(FPDF):
            def header(self):
                self.set_font("Helvetica", "B", 8)
                self.set_text_color(110, 110, 110)
                self.cell(0, 5, "ARTSA EXECUTIVE COMPLIANCE & SECURITY AUDIT REPORT", 0, 0, "L")
                self.cell(0, 5, "NIST AI RMF / OWASP ASI / ISO 42001", 0, 1, "R")
                self.set_draw_color(200, 200, 200)
                self.line(10, 15, 200, 15)
                self.ln(5)

            def footer(self):
                self.set_y(-15)
                self.set_font("Helvetica", "I", 8)
                self.set_text_color(130, 130, 130)
                self.cell(0, 10, f"Page {self.page_no()}/{{nb}}  |  HMAC status: {hmac_status}", 0, 0, "C")

        pdf = ArtsaPDF()
        pdf.alias_nb_pages()
        pdf.set_auto_page_break(auto=True, margin=18)

        # ── PAGE 1: Executive Overview & CVSS & EU AI Act ──────────────────
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(25, 30, 45)
        pdf.cell(0, 10, "EXECUTIVE COMPLIANCE & SECURITY AUDIT", ln=True, align="C")
        pdf.set_font("Helvetica", "I", 10)
        pdf.set_text_color(90, 95, 110)
        pdf.cell(0, 6, "Autonomous Red Team Simulation & Adaptive Defense Architecture", ln=True, align="C")
        pdf.ln(3)

        # Meta box
        pdf.set_fill_color(245, 247, 250)
        pdf.set_draw_color(210, 215, 225)
        pdf.rect(10, 36, 190, 24, "FD")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(50, 50, 60)
        pdf.set_xy(14, 38)
        pdf.cell(90, 5, f"Campaign ID: {self._pdf_safe(self.campaign_id)}")
        pdf.cell(90, 5, f"Audit Date: {self._pdf_safe(datetime.now(UTC).strftime('%Y-%m-%d %H:%M UTC'))}", ln=True)
        pdf.set_x(14)
        pdf.cell(90, 5, f"Target Model: {self._pdf_safe(self.model)} ({self._pdf_safe(self.provider)})")
        pdf.cell(90, 5, f"Classification: RESTRICTED COMPLIANCE AUDIT", ln=True)
        pdf.set_x(14)
        pdf.cell(90, 5, f"Governance Readiness: {self._pdf_value(iso['readiness_score'])}/100 ({self._pdf_safe(iso['readiness_level'])})")
        pdf.cell(90, 5, f"HMAC Non-Repudiation: {self._pdf_safe(hmac_proofs['non_repudiation_status'])}", ln=True)
        pdf.ln(12)

        # Section 1: CVSS v4.0
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(20, 30, 50)
        pdf.cell(0, 8, "1. CVSS v4.0 Vulnerability Rating", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, f"Composite Base Score: {self._pdf_value(cvss['score'])} / 10.0  |  Severity: {cvss['severity']}", ln=True)
        pdf.set_font("Courier", "", 8)
        pdf.cell(0, 5, self._pdf_safe(cvss['vector_string']), ln=True)
        pdf.ln(4)

        # Section 2: Framework Readiness Composite
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, "2. Governance Framework Composite Scores", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(60, 6, f"- NIST AI RMF Scorecard: {self._pdf_value(nist['composite_score'])}/100", ln=True)
        pdf.cell(60, 6, f"- OWASP Agentic Top 10: {self._pdf_value(asi['compliance_score'])}/100", ln=True)
        pdf.cell(60, 6, f"- OWASP LLM Top 10: {self._pdf_value(owasp_llm['summary']['compliance_score'])}/100", ln=True)
        pdf.cell(60, 6, f"- ISO/IEC 42001 AIMS: {self._pdf_value(iso['readiness_score'])}/100 ({self._pdf_safe(iso['readiness_level'])})", ln=True)
        pdf.ln(4)

        # Section 3: EU AI Act Article 15
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, "3. EU AI Act Article 15 (Cybersecurity & Robustness)", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, f"Status: {self._pdf_safe(eu['compliance_status'])}", ln=True)
        for eval_item in eu["evaluations"]:
            pdf.cell(0, 5, f"  * {self._pdf_safe(eval_item['requirement'])}: [{eval_item['status']}] - {self._pdf_safe(eval_item['finding'])}", ln=True)
        pdf.ln(4)

        # ── PAGE 2: NIST AI RMF Scorecard & ISO 42001 ─────────────────────
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 8, "4. NIST AI Risk Management Framework (AI RMF 1.0) Scorecard", ln=True)
        pdf.set_font("Helvetica", "I", 9)
        pdf.cell(0, 5, f"Framework Composite Score: {self._pdf_value(nist['composite_score'])}/100", ln=True)
        pdf.ln(2)

        for fn in nist["functions"]:
            pdf.set_fill_color(240, 243, 248)
            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 6, f"[{fn['function']}] {self._pdf_safe(fn['code'])}: {self._pdf_safe(fn['title'])} (Score: {self._pdf_value(fn['score'])}%)", ln=True, fill=True)
            pdf.set_font("Helvetica", "", 8)
            pdf.cell(0, 5, f"Status: {fn['status']}  |  Evidence:", ln=True)
            pdf.set_x(15)
            pdf.multi_cell(180, 4, self._pdf_safe(fn["evidence"]))
            pdf.ln(2)

        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, "5. ISO/IEC 42001:2023 AI Management System Controls", ln=True)
        pdf.set_font("Helvetica", "", 8)
        for control in iso["controls"]:
            pdf.cell(0, 5, f"Clause {control['id']} {self._pdf_safe(control['name'])}: [{control['status']}] - {self._pdf_safe(control['evidence'])}", ln=True)

        # ── PAGE 3: OWASP Top 10 for Agentic Applications ──────────────────
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 8, f"6. OWASP Top 10 for Agentic Applications (Score: {self._pdf_value(asi['compliance_score'])}/100)", ln=True)
        pdf.set_font("Helvetica", "I", 8)
        pdf.cell(0, 5, f"Compliant: {asi['summary']['compliant']}  |  Partial: {asi['summary']['partial']}  |  Flagged: {asi['summary']['flagged']}", ln=True)
        pdf.ln(2)

        for row in asi["rows"]:
            pdf.set_fill_color(248, 249, 252)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(20, 5, row["id"], fill=True)
            pdf.cell(100, 5, self._pdf_safe(row["name"]), fill=True)
            pdf.cell(30, 5, f"[{row['status']}]", fill=True)
            pdf.cell(40, 5, "", fill=True, ln=True)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_x(15)
            pdf.multi_cell(180, 4, f"Control: {self._pdf_safe(row['control'])}  |  Evidence: {self._pdf_safe(row['finding'])}")
            pdf.ln(1)

        # ── PAGE 4: Cryptographic HMAC Proofs & Adaptive Defense Lift ──────
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 8, "7. Cryptographic Non-Repudiation Proofs (HMAC-SHA256)", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, f"Verification Status: {self._pdf_safe(hmac_proofs['non_repudiation_status'])}", ln=True)
        pdf.cell(0, 5, f"Algorithm: {self._pdf_safe(hmac_proofs['algorithm'])}  |  Replay Protection: {self._pdf_safe(hmac_proofs['replay_protection'])}", ln=True)
        pdf.cell(0, 5, f"Total Hops: {hmac_proofs['total_signed_hops']}  |  Verified: {hmac_proofs['verified_hops']}  |  Tampered: {hmac_proofs['failed_hops']}  |  Replays: {hmac_proofs['replays_detected']}", ln=True)
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Recorded audit root hash:", ln=True)
        pdf.set_font("Courier", "", 8)
        pdf.set_fill_color(240, 240, 240)
        pdf.cell(0, 6, self._pdf_safe(merkle_root or "Unavailable - no complete audit root"), ln=True, fill=True)
        pdf.ln(4)

        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, "8. Autonomous Defender Adaptive Lift Analysis", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, f"- Static Baseline Detection Rate: {self._pdf_value(lift['static_baseline_detection_rate'])}%", ln=True)
        pdf.cell(0, 5, f"- Autonomous Defender Detection Rate: {self._pdf_value(lift['adaptive_defense_detection_rate'])}%", ln=True)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(0, 120, 60)
        pdf.cell(0, 6, f"- Net Adaptive Resilience Lift: {self._pdf_value(lift['adaptive_lift_percent'])}%", ln=True)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(40, 40, 50)
        pdf.cell(0, 5, f"- Dynamic Semantic Hot-Patches Activated: {lift['hot_patches_applied']} rules", ln=True)
        pdf.cell(0, 5, f"- Granular Per-Tool Quarantines: {lift['tools_quarantined']} tools", ln=True)
        pdf.cell(0, 5, f"- Co-Evolution State: {self._pdf_safe(lift['co_evolution_status'])}", ln=True)
        pdf.ln(4)

        pdf.set_fill_color(245, 247, 252)
        pdf.set_draw_color(180, 190, 210)
        pdf.rect(10, 175, 190, 35, "FD")
        pdf.set_xy(14, 178)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 5, "Evidence and verification status", ln=True)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_x(14)
        pdf.multi_cell(180, 4, "This report contains campaign summary and available assessment records. Missing control evidence and unverified cryptographic records are marked accordingly. The report does not independently attest to deployment behavior.")
        pdf.set_xy(14, 200)
        pdf.set_font("Courier", "B", 8)
        ledger_line = (
            f"VERIFIED AUDIT ROOT: {verified_root[:32]}..."
            if verified_root
            else f"SIGNATURE STATUS: {self._pdf_safe(hmac_status)} - no verified root"
        )
        pdf.cell(0, 5, ledger_line, ln=True)

        raw = pdf.output(dest="S")
        if isinstance(raw, str):
            return raw.encode("latin-1", errors="replace")
        return bytes(raw)
