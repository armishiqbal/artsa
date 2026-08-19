"""Red-team evaluation runner — Task List Phase 2.3/2.4.

Runs attack variants through the containment engine and attributes the catch
to layers. The flagship metric: ``regex_invisible_semantic_catch_rate`` — the
share of attacks that produce NO rule/statistical/policy signal (invisible to
the signature layers) yet are still caught by the semantic (embedding) layer.
That number is the defensible proof that the semantic detector generalizes
instead of just memorizing regexes.
"""

from __future__ import annotations

import uuid
from collections import Counter
from dataclasses import dataclass, field

from src.containment.engine import ContainmentEngine
from src.core.models.events import ToolCallEvent

# Detectors that are "signature-like" — if none of these fire, the attack was
# invisible to the deterministic layers.
_SIGNATURE_DETECTORS = frozenset(
    {
        "RuleBasedDetector",
        "StatisticalDetector",
        "SqlInjectionDetector",
        "McpDestructiveToolDetector",
        "PolicyDetector",
        "PromptInjectionDetector",
    }
)

_SEMANTIC_DETECTOR = "SemanticDetector"


@dataclass
class AttackResult:
    base: str
    variant: str
    encoding: str
    overall_score: float
    verdict: str
    fired_detectors: list[str] = field(default_factory=list)
    caught: bool = False
    regex_invisible: bool = False
    semantic_caught: bool = False

    def to_dict(self) -> dict:
        return {
            "base": self.base,
            "encoding": self.encoding,
            "score": round(self.overall_score, 1),
            "verdict": self.verdict,
            "fired": self.fired_detectors,
            "caught": self.caught,
            "regex_invisible": self.regex_invisible,
            "semantic_caught": self.semantic_caught,
        }


@dataclass
class RedTeamReport:
    corpus_size: int
    caught: int
    recall: float
    by_encoding: dict[str, dict] = field(default_factory=dict)
    detector_fires: dict[str, int] = field(default_factory=dict)
    regex_invisible_total: int = 0
    regex_invisible_semantic_caught: int = 0
    regex_invisible_semantic_catch_rate: float = 0.0
    examples: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "corpus_size": self.corpus_size,
            "caught": self.caught,
            "recall": round(self.recall, 4),
            "by_encoding": self.by_encoding,
            "detector_fires": self.detector_fires,
            "regex_invisible_total": self.regex_invisible_total,
            "regex_invisible_semantic_caught": self.regex_invisible_semantic_caught,
            "regex_invisible_semantic_catch_rate": round(self.regex_invisible_semantic_catch_rate, 4),
        }


def _evaluate_one(
    engine: ContainmentEngine, tool: str, arguments: dict
) -> tuple[float, str, list[str]]:
    event = ToolCallEvent(
        session_id=uuid.uuid4(), agent_id="redteam", tool_name=tool, arguments=arguments
    )
    risk, verdict, sec_events = engine.evaluate_event(event)
    fired = sorted({e.detector for e in sec_events})
    return risk.overall_score, verdict.verdict, fired


def evaluate_attacks(
    corpus: list[dict[str, str]],
    tool: str = "inject_prompt",
    arg_key: str = "payload",
) -> RedTeamReport:
    """Run the corpus; full engine + semantic-disabled engine for attribution."""
    full_engine = ContainmentEngine()
    no_semantic_engine = ContainmentEngine(disabled_detectors=[_SEMANTIC_DETECTOR])

    results: list[AttackResult] = []
    detector_fires: Counter[str] = Counter()
    by_encoding: dict[str, dict] = {}

    for item in corpus:
        arguments = {arg_key: item["variant"]}
        score, verdict, fired = _evaluate_one(full_engine, tool, arguments)
        # Attribution without the semantic layer -> which detectors really fire?
        _, _, fired_no_semantic = _evaluate_one(no_semantic_engine, tool, arguments)

        signature_fired = bool(set(fired_no_semantic) & _SIGNATURE_DETECTORS)
        semantic_fired = _SEMANTIC_DETECTOR in fired

        res = AttackResult(
            base=item["base"],
            variant=item["variant"],
            encoding=item["encoding"],
            overall_score=score,
            verdict=verdict,
            fired_detectors=fired,
            caught=verdict in ("SUSPICIOUS", "BREACHED"),
            regex_invisible=not signature_fired,
            semantic_caught=semantic_fired,
        )
        results.append(res)
        for d in fired:
            detector_fires[d] += 1

        enc = by_encoding.setdefault(
            item["encoding"], {"total": 0, "caught": 0, "score_sum": 0.0}
        )
        enc["total"] += 1
        if res.caught:
            enc["caught"] += 1
        enc["score_sum"] += score

    caught = sum(1 for r in results if r.caught)
    invisible = [r for r in results if r.regex_invisible]
    invisible_semantic_caught = sum(1 for r in invisible if r.semantic_caught)

    return RedTeamReport(
        corpus_size=len(results),
        caught=caught,
        recall=(caught / len(results)) if results else 0.0,
        by_encoding={k: {"total": v["total"], "caught": v["caught"],
                          "recall": round(v["caught"] / v["total"], 4) if v["total"] else 0.0}
                     for k, v in by_encoding.items()},
        detector_fires=dict(detector_fires.most_common()),
        regex_invisible_total=len(invisible),
        regex_invisible_semantic_caught=invisible_semantic_caught,
        regex_invisible_semantic_catch_rate=(
            invisible_semantic_caught / len(invisible) if invisible else 0.0
        ),
        examples=[r.to_dict() for r in results[:12]],
    )
