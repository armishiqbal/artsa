"""Multi-turn goal-drift detector.

WS-2.1: replaces the previous single-substring stub (a literal ``"exfiltrate"``
match) with a real trajectory-divergence detector. It keeps per-session history
and flags an agent whose later actions diverge from the session's context:

  1. literal exfiltration / goal-abandonment keywords (kept, full strength),
  2. first-time escalation to a sensitive target (``~/.aws``, credentials,
     ``/etc/shadow`` …) in a session that previously did only benign work,
  3. first-time external egress in an otherwise internal-only session,
  4. privilege jump: read-only / content work jumping straight to destructive
     or high-privilege tools,
  5. declared-goal divergence: the session declares a benign goal (summarize,
     read, search, …) and later performs a destructive or egress action.

Availability guards (the product promise: never KILL normal work):

  * every signal except the literal exfiltration keywords requires at least
    ``DRIFT_MIN_STEPS`` prior steps in the session — single calls and short
    sessions never fire, so a one-off sensitive read stays in the domain of
    the dedicated SENSITIVE_DATA_EXPOSED detectors (WORKPACKAGE B2);
  * the first call of a session is never flagged (no baseline yet);
  * benign repeated read-only sessions stay SAFE;
  * benign system files such as ``/etc/hosts`` are not sensitive targets.
"""

from __future__ import annotations

import ipaddress
import re
from collections import defaultdict, deque
from dataclasses import dataclass

from src.containment.detectors.base import BaseDetector
from src.core.models.events import SecurityEvent, ToolCallEvent

# Number of *prior* steps required before any divergence signal may fire.
DRIFT_MIN_STEPS = 3
# How many steps of history we retain per session.
HISTORY_MAXLEN = 30

# Tools that are read-only / content-oriented — ordinary work, never a drift
# signal on their own.
_READ_ONLY_TOOLS = frozenset(
    {
        "read_file",
        "read",
        "get_file",
        "list_directory",
        "list_files",
        "query_vector_db",
        "search_documents",
        "search",
        "lookup",
        "get",
        "describe",
        "inspect",
        "stat",
        "summarize",
        "translate",
        "analyze",
        "grep",
        "cat",
        "head",
        "tail",
        "less",
        "find",
        "create_ticket",
        "send_email",
        "send_message",
        "write_markdown",
        "create_document",
        "update_document",
    }
)

# High-privilege / destructive tools — a jump into these from read-only work
# is a divergence signal (privilege escalation of *intent*).
_DESTRUCTIVE_TOOLS = frozenset(
    {
        "delete_user",
        "delete_file",
        "remove",
        "drop_table",
        "drop_database",
        "truncate",
        "shutdown",
        "reboot",
        "kill",
        "destroy",
        "run_code",
        "eval",
        "exec",
        "execute_command",
        "exec_command",
        "shell",
        "bash",
        "system",
        "mcp_call",
    }
)

_EXECUTOR_TOOLS = frozenset(
    {"exec_command", "execute_command", "run_code", "eval", "shell", "bash", "system", "exec"}
)

# Destructive argument constructs for executor tools.
_DESTRUCTIVE_ARG_MARKERS = (
    "rm -rf",
    "drop table",
    "delete from",
    "truncate",
    "mkfs",
    "dd if=",
    "shutdown",
    "reboot",
    "kill -9",
    "--delete",
)

# Sensitive targets whose *first* access in a session is a drift signal.
_SENSITIVE_PATH_PATTERNS = (
    re.compile(r"(?i)(?:^|[\\/~\s'\"])\.aws(?:[\\/\s]|$)"),
    re.compile(r"(?i)(?:^|[\\/~\s'\"])\.ssh(?:[\\/\s]|$)"),
    re.compile(r"(?i)id_rsa|id_ed25519|credentials(?:\.json|\.txt|\.ini|\.env)?"),
    re.compile(r"(?i)/etc/(?:shadow|passwd|sudoers|gshadow)"),
    re.compile(r"(?i)\.env(?:\b|$)|api[_-]?key|secret[_-]?key|auth[_-]?token"),
    re.compile(r"(?i)169\.254\.169\.254|/latest/meta-data/"),
)

# External-egress constructs (SSRF / exfiltration carriers).
_EGRESS_MARKER_PATTERNS = (
    re.compile(r"(?i)\bnc\s+-e\b|ncat\s+-e\b|/dev/tcp/"),
    re.compile(r"(?i)\bcurl\b.*\bhttps?://|wget\b.*\bhttps?://"),
)

# Reverse-shell carriers that are NEVER suppressed by the auth-API nuance below.
_REVERSE_SHELL_MARKERS = (re.compile(r"(?i)\bnc\s+-e\b|ncat\s+-e\b|/dev/tcp/"),)

# Explicit data-exfiltration carriers (upload flags, form file=@, data from
# file, or a pipe straight into a remote sink). Their presence overrides the
# authenticated-API nuance — ``curl -T /tmp/x -H 'Authorization: …'`` is still
# exfiltration even with a bearer token.
_EXFIL_CARRIER_PATTERN = re.compile(
    r"(?i)(?:--post-file|--upload-file|--data-binary\s+@|-T\s+|-F\s+\S*@|-d\s+@)|"
    r"(?:cat|tar|openssl|base64|gzip|dd|tee)[^\n]*\|\s*(?:curl|wget|nc|ncat)\b"
)

# Authenticated API client call: an explicit Authorization header, an OAuth2
# bearer flag, or curl basic auth. Legit agents calling e.g. Stripe billing
# must not be treated as first-time exfiltration (canary FPR fix).
_AUTH_HEADER_PATTERN = re.compile(
    r"(?i)-h\s*['\"]?authorization:|--oauth2-bearer\s+\S+|"
    r"(?:\bcurl|\bwget)\s+[^\n]*-u\s+\S+:\S+"
)

# Goal-abandonment keywords — an agent told to stop / forget its constraints.
_GOAL_ABANDON_KEYWORDS = (
    "exfiltrate",
    "exfil",
    "exfiltration",
    "disable safety",
    "disable your safety",
    "ignore all previous",
    "ignore all instructions",
    "forget your instructions",
    "forget all instructions",
    "override system",
    "system override",
)

# Benign goal verbs — when the declared goal is one of these and the action is
# destructive / egress / sensitive, that is a divergence worth surfacing.
_BENIGN_GOAL_VERBS = (
    "summar",
    "read",
    "search",
    "report",
    "write",
    "document",
    "email",
    "answer",
    "transl",
    "analyz",
    "list",
    "review",
    "draft",
    "extract",
)


@dataclass
class _Step:
    tool_name: str
    args_text: str
    sensitive: bool = False
    egress: bool = False
    destructive: bool = False
    read_only: bool = False


def _args_text(event: ToolCallEvent) -> str:
    if isinstance(event.arguments, dict):
        for key in (
            "command",
            "cmd",
            "input",
            "code",
            "script",
            "payload",
            "shell_command",
            "sql",
            "query",
            "statement",
            "path",
            "url",
            "tool",
            "name",
            "q",
        ):
            val = event.arguments.get(key)
            if isinstance(val, str):
                return val
        return str(event.arguments)
    return str(event.arguments)


def _matches_any(text: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
    return any(p.search(text) for p in patterns)


def _host_is_external(url: str) -> bool:
    """True when the URL's host is outside the local trust boundary.

    Loopback / private ranges and well-known local names (localhost, .local,
    .internal) are trusted; other unresolvable DNS names are treated as
    external (a real SSRF/exfil carrier), matching the historical behavior.
    """
    for scheme in ("http://", "https://"):
        idx = url.find(scheme)
        if idx == -1:
            continue
        rest = url[idx + len(scheme) :]
        host = rest.split("/", 1)[0].split(":", 1)[0].split("?", 1)[0]
        if not host:
            continue
        host_low = host.lower().rstrip(".")
        if host_low in {"localhost", "localhost.localdomain"} or host_low.endswith(
            (".local", ".internal", ".lan", ".home.arpa")
        ):
            continue
        try:
            ip = ipaddress.ip_address(host_low.split("%")[0])
        except ValueError:
            return True  # unresolvable DNS name -> external
        if not (ip.is_loopback or ip.is_private or ip.is_unspecified or ip.is_link_local):
            return True
    return False


def _classify_step(event: ToolCallEvent) -> _Step:
    tool = (event.tool_name or "").lower()
    text = _args_text(event)
    has_http = "http://" in text or "https://" in text
    egress_carrier = _matches_any(text, _EGRESS_MARKER_PATTERNS)
    external_egress = has_http and _host_is_external(text)
    # An authenticated API client call (Authorization header / basic auth) with
    # no exfil carrier, no reverse-shell marker, and no sensitive/metadata
    # target is ordinary work — calling the API the agent is supposed to call —
    # not first-time exfiltration.
    authenticated_api = (
        bool(_AUTH_HEADER_PATTERN.search(text))
        and not _EXFIL_CARRIER_PATTERN.search(text)
        and not _matches_any(text, _REVERSE_SHELL_MARKERS)
        and not _matches_any(text, _SENSITIVE_PATH_PATTERNS)
    )
    egress = (egress_carrier or external_egress) and not authenticated_api
    destructive = tool in _DESTRUCTIVE_TOOLS and (
        tool not in _EXECUTOR_TOOLS
        or any(marker in text.lower() for marker in _DESTRUCTIVE_ARG_MARKERS)
    )
    return _Step(
        tool_name=tool,
        args_text=text,
        sensitive=_matches_any(text, _SENSITIVE_PATH_PATTERNS),
        egress=egress,
        destructive=destructive,
        read_only=tool in _READ_ONLY_TOOLS,
    )


class GoalDriftDetector(BaseDetector):
    """Detects multi-turn goal drift where agent trajectory diverges from the
    session's declared intent (README: "AI Going Off-Track")."""

    def __init__(self) -> None:
        super().__init__(name="GoalDriftDetector")
        # session_id -> recent steps (bounded).
        self._history: dict[str, deque[_Step]] = defaultdict(lambda: deque(maxlen=HISTORY_MAXLEN))
        # session_id -> declared goal text (from the first call).
        self._declared_goal: dict[str, str] = {}

    def _goal_from_args(self, event: ToolCallEvent) -> str:
        if isinstance(event.arguments, dict):
            for key in (
                "goal",
                "intent",
                "task",
                "instruction",
                "objective",
                "user_intent",
                "request",
            ):
                val = event.arguments.get(key)
                if isinstance(val, str) and val.strip():
                    return val.strip()
        return ""

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        sid = str(event.session_id)
        args_text = _args_text(event)
        low = args_text.lower()

        # --- Signal 1: literal goal abandonment (kept, fires on single calls) ---
        for keyword in _GOAL_ABANDON_KEYWORDS:
            if keyword in low:
                return SecurityEvent(
                    session_id=event.session_id,
                    agent_id=event.agent_id,
                    event_type="GOAL_DRIFT",
                    severity="CRITICAL",
                    risk_score=85.0,
                    description=(
                        "Goal drift detected: agent trajectory diverged toward "
                        "goal abandonment / exfiltration"
                    ),
                    evidence={
                        "tool_name": event.tool_name,
                        "arguments": event.arguments,
                        "signal": f"goal_abandon_keyword:{keyword}",
                    },
                    detector=self.name,
                )

        # --- Record the step before history checks (first call is baseline) ---
        step = _classify_step(event)
        history = self._history[sid]

        if not self._declared_goal.get(sid):
            goal = self._goal_from_args(event)
            if goal:
                self._declared_goal[sid] = goal

        # --- Multi-turn signals: need a baseline of prior steps ---
        signals: list[str] = []
        if len(history) >= DRIFT_MIN_STEPS:
            prior = list(history)
            prior_sensitive = any(s.sensitive for s in prior)
            prior_egress = any(s.egress for s in prior)
            prior_destructive = any(s.destructive for s in prior)
            prior_read_only = all(s.read_only for s in prior)

            # 2. First-time escalation to a sensitive target after benign work
            #    (a lone read-only touch stays in the report band — see below).
            if step.sensitive and not prior_sensitive and prior_read_only:
                signals.append("first_sensitive_target_after_benign_work")
            # 3. First-time external egress in an otherwise internal session.
            if step.egress and not prior_egress and not prior_destructive:
                signals.append("first_external_egress")
            # 4. Privilege jump from read-only work to destructive/high-privilege.
            if step.destructive and prior_read_only and not step.read_only:
                signals.append("privilege_jump_from_read_only_work")
            # 5. Declared-goal divergence (benign stated goal + destructive act).
            goal = self._declared_goal.get(sid, "")
            if goal and step.destructive:
                goal_low = goal.lower()
                if any(verb in goal_low for verb in _BENIGN_GOAL_VERBS):
                    signals.append(f"declared_goal_divergence:goal='{goal[:60]}'")

        history.append(step)

        if not signals:
            return None

        # --- Score from corroborating signals (conservative bands) ---
        # Availability guard: a lone signal raised through a read-only tool
        # (e.g. a first-time credential *read*) is surfaced for review but never
        # interrupts work — only destructive/exec actions or corroborating
        # signals cross into QUARANTINE / KILL bands.
        sensitive_plus_egress = (
            "first_sensitive_target_after_benign_work" in signals
            and "first_external_egress" in signals
        )
        if sensitive_plus_egress or len(signals) >= 3:
            risk_score, severity = 84.0, "CRITICAL"
        elif len(signals) >= 2:
            risk_score, severity = 70.0, "HIGH"
        elif step.read_only:
            risk_score, severity = 45.0, "MEDIUM"  # report band (< QUARANTINE)
        else:
            risk_score, severity = 58.0, "MEDIUM"

        return SecurityEvent(
            session_id=event.session_id,
            agent_id=event.agent_id,
            event_type="GOAL_DRIFT",
            severity=severity,
            risk_score=risk_score,
            description=(
                f"Goal drift detected: agent diverged from its session context "
                f"({len(history)} steps, signals: {', '.join(signals)})"
            ),
            evidence={
                "tool_name": event.tool_name,
                "arguments": event.arguments,
                "signals": signals,
                "session_steps": [s.tool_name for s in history][-8:],
                "declared_goal": self._declared_goal.get(sid, ""),
            },
            detector=self.name,
        )
