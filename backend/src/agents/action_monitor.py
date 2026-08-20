"""Stepwise Action Monitor & Tool Call Trajectory Classifier.

WORKPACKAGE B (B2): benign system files (``/etc/hosts``, ``/etc/hostname``,
``/etc/timezone``, ``/proc/...``, ``/sys/...``) were classified as high-risk,
so a single ``read_file /etc/hosts`` produced GOAL_DRIFT 90 → KILL. Now:

  - File tools are only anomalous for *targeted* sensitive paths
    (passwd/shadow, dot-credential dirs, .env, keys), never blanket ``/etc/``.
  - Command tools are only anomalous when the arguments carry a destructive
    construct — never by tool name alone.
  - GOAL_DRIFT requires multi-step drift evidence; a single benign or
    sensitive-file read can no longer emit GOAL_DRIFT by itself (single-event
    suspicious reads are left to the dedicated SENSITIVE_DATA_EXPOSED
    detectors — RuleBased/Statistical/ToolOutput). The one exception is a
    single *genuinely dangerous* invocation — dangerous tool, destructive
    construct, or network exfiltration — which is itself an exploit signal and
    flags immediately.
"""

from __future__ import annotations

import ipaddress
import logging
import re
from typing import Any

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Tools that are dangerous by name alone (data destruction / privilege grant).
_DANGEROUS_TOOLS = (
    "delete_user",
    "drop_database",
    "drop_table",
    "truncate",
    "exfiltrate_data",
    "export_pii",
    "grant_admin_privilege",
)

# Tools that execute commands/shell. Flagged only when the arguments carry a
# destructive construct, never by name alone (ordinary `ls`/`cat`/`grep` runs
# are legitimate agent work).
_COMMAND_TOOLS = (
    "execute_system_command",
    "execute_command",
    "exec_command",
    "shell",
    "bash",
    "run_code",
    "eval",
    "system",
)

# Targeted sensitive-path markers. Deliberately NOT a blanket `/etc/` check so
# benign system files stay SAFE while credential paths remain anomalous.
_SENSITIVE_PATH_MARKERS = (
    "passwd",
    "shadow",
    ".aws",
    ".ssh",
    ".kube",
    ".env",
    "id_rsa",
    "credential",
    "secret",
)

# Destructive command constructs that make a command-tool call anomalous.
_DESTRUCTIVE_ARG_MARKERS = (
    "rm -rf",
    "base64 -d",
    "/etc/shadow",
    "/etc/passwd",
    "169.254",
    "nc -e",
    "ncat -e",
    "bash -i",
    "/dev/tcp/",
    "mkfs",
    "chmod 777",
)

# Exfiltration markers that are suspicious regardless of where they point
# (the cloud metadata endpoint 169.254.169.254 is the canonical SSRF target).
_ALWAYS_EXFIL_MARKERS = (
    "exfiltrate",
    "dump",
    "shadow",
    "169.254",
)

# Authenticated API client call: an explicit Authorization header, an OAuth2
# bearer flag, or curl basic auth. Legit agents calling e.g. Stripe billing
# must not be treated as network exfiltration (canary FPR fix). The metadata
# probe ``-H 'Metadata-Flavor: Google'`` deliberately does NOT match — only
# Authorization / OAuth / basic-auth headers do.
_AUTH_HEADER_PATTERN = re.compile(
    r"(?i)-h\s*['\"]?authorization:|--oauth2-bearer\s+\S+|"
    r"(?:\bcurl|\bwget)\s+[^\n]*-u\s+\S+:\S+"
)

# Explicit data-exfiltration carriers (upload flags, form file=@, data from
# file, or a pipe straight into a remote sink). Their presence overrides the
# authenticated-API nuance — ``curl -T /tmp/x -H 'Authorization: …'`` is still
# exfiltration even with a bearer token.
_EXFIL_CARRIER_PATTERN = re.compile(
    r"(?i)(?:--post-file|--upload-file|--data-binary\s+@|-T\s+|-F\s+\S*@|-d\s+@)|"
    r"(?:cat|tar|openssl|base64|gzip|dd|tee)[^\n]*\|\s*(?:curl|wget|nc|ncat)\b"
)


def _is_authenticated_api_call(text: str) -> bool:
    """True when *text* is an authenticated API client call rather than
    exfiltration: has an Authorization / OAuth / basic-auth header, no data
    exfiltration carrier, and no always-exfil marker (metadata IP, shadow…)."""
    if any(marker in text for marker in _ALWAYS_EXFIL_MARKERS):
        return False
    return bool(_AUTH_HEADER_PATTERN.search(text)) and not _EXFIL_CARRIER_PATTERN.search(text)


def _is_trusted_host(host: str) -> bool:
    """Loopback / private / ULA hosts are routine local agent work, not an
    exfiltration destination."""
    host = host.lower()
    if host == "localhost" or host == "0.0.0.0":
        return True
    try:
        ip = ipaddress.ip_address(host.split("%")[0])
    except ValueError:
        # An unresolvable DNS name is treated as external — matches the
        # historical "any http URL is suspicious" behavior for hostnames.
        return False
    return bool(ip.is_loopback or ip.is_private or ip.is_unspecified)


def _targets_external_network(text: str) -> bool:
    """True when *text* reaches a network destination outside the local trust
    boundary (exfiltration / SSRF-adjacent). Loopback and private-range targets
    are excluded so a benign ``curl http://localhost:3000/api`` stays SAFE."""
    if any(marker in text for marker in _ALWAYS_EXFIL_MARKERS):
        return True
    for scheme in ("http://", "https://"):
        start = 0
        while True:
            idx = text.find(scheme, start)
            if idx == -1:
                break
            rest = text[idx + len(scheme) :]
            host = rest.split("/", 1)[0].split(":", 1)[0].split("?", 1)[0]
            if host and not _is_trusted_host(host):
                return True
            start = idx + len(scheme)
    return False


class ToolCallStep(BaseModel):
    """Represents a single tool invocation step in an agent trajectory."""

    step_index: int
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    classification: str = "EXPECTED"  # EXPECTED, PLAUSIBLE, ANOMALOUS
    anomaly_score: float = 0.0  # 0.0 (safe) to 10.0 (malicious)
    # Why the step is anomalous — used by the trajectory verdict so a *single*
    # dangerous invocation (dangerous tool / destructive construct / network
    # exfil) can be flagged without re-flagging benign or sensitive-file reads.
    # Values: "", "SENSITIVE_PATH", "DESTRUCTIVE_ARG", "DANGEROUS_TOOL", "NETWORK_EXFIL".
    anomaly_kind: str = ""
    reasoning: str = ""


class TrajectoryEvaluation(BaseModel):
    """Stepwise trajectory monitoring evaluation result."""

    total_steps: int = 0
    anomalous_steps: int = 0
    overall_anomaly_score: float = 0.0  # 0.0 - 10.0
    trajectory_verdict: str = "BENIGN"  # BENIGN, SUSPICIOUS, EXPLOIT
    step_evaluations: list[ToolCallStep] = Field(default_factory=list)


class StepwiseActionMonitor:
    """Monitors and evaluates agent tool-call trajectories stepwise in real-time."""

    def __init__(self, high_risk_tools: list[str] | None = None) -> None:
        # Backwards-compatible hook: custom lists are treated as the
        # dangerous-by-name set (default above).
        self.high_risk_tools = [t.lower() for t in (high_risk_tools or list(_DANGEROUS_TOOLS))]

    def evaluate_step(
        self,
        step_index: int,
        tool_name: str,
        arguments: dict[str, Any],
        user_intent: str = "",
    ) -> ToolCallStep:
        """Evaluate a single tool call step for anomaly score and risk."""
        tool_clean = tool_name.lower()
        args_str = str(arguments).lower()
        intent = (user_intent or "").lower()

        # File tools: only targeted sensitive paths are anomalous.
        if tool_clean in ("read_file", "write_file"):
            if any(marker in args_str for marker in _SENSITIVE_PATH_MARKERS):
                return ToolCallStep(
                    step_index=step_index,
                    tool_name=tool_name,
                    arguments=arguments,
                    classification="ANOMALOUS",
                    anomaly_score=9.0,
                    anomaly_kind="SENSITIVE_PATH",
                    reasoning=f"Sensitive path access via '{tool_name}'",
                )
            return ToolCallStep(
                step_index=step_index,
                tool_name=tool_name,
                arguments=arguments,
                classification="EXPECTED",
                anomaly_score=1.0,
                reasoning=f"File tool '{tool_name}' — path not flagged as sensitive",
            )

        # Command tools: destructive constructs are anomalous; ordinary commands are expected.
        if tool_clean in _COMMAND_TOOLS:
            if any(marker in args_str for marker in _DESTRUCTIVE_ARG_MARKERS):
                return ToolCallStep(
                    step_index=step_index,
                    tool_name=tool_name,
                    arguments=arguments,
                    classification="ANOMALOUS",
                    anomaly_score=8.5,
                    anomaly_kind="DESTRUCTIVE_ARG",
                    reasoning=f"Destructive command construct via '{tool_name}'",
                )
            if _targets_external_network(args_str):
                if _is_authenticated_api_call(args_str):
                    return ToolCallStep(
                        step_index=step_index,
                        tool_name=tool_name,
                        arguments=arguments,
                        classification="EXPECTED",
                        anomaly_score=1.0,
                        reasoning=(
                            f"Command tool '{tool_name}' — authenticated API call "
                            f"to external destination (ordinary work, not exfiltration)"
                        ),
                    )
                return ToolCallStep(
                    step_index=step_index,
                    tool_name=tool_name,
                    arguments=arguments,
                    classification="ANOMALOUS",
                    anomaly_score=8.0,
                    anomaly_kind="NETWORK_EXFIL",
                    reasoning=f"Command tool '{tool_name}' reaching an external network destination",
                )
            return ToolCallStep(
                step_index=step_index,
                tool_name=tool_name,
                arguments=arguments,
                classification="EXPECTED",
                anomaly_score=1.0,
                reasoning=f"Command tool '{tool_name}' — no destructive construct or external network target detected",
            )

        # Dangerous-by-name tools.
        if tool_clean in self.high_risk_tools:
            return ToolCallStep(
                step_index=step_index,
                tool_name=tool_name,
                arguments=arguments,
                classification="ANOMALOUS",
                anomaly_score=9.5,
                anomaly_kind="DANGEROUS_TOOL",
                reasoning=f"Invocation of high-risk security-sensitive tool '{tool_name}'",
            )

        # Suspicious network / exfiltration markers in arguments.
        if _targets_external_network(args_str):
            # An authenticated API client call is ordinary work, not egress.
            if _is_authenticated_api_call(args_str):
                return ToolCallStep(
                    step_index=step_index,
                    tool_name=tool_name,
                    arguments=arguments,
                    classification="EXPECTED",
                    anomaly_score=1.0,
                    reasoning="Authenticated API call to external destination — ordinary work",
                )
            # A bare external GET (curl <url>, http_request GET) is egress worth
            # surfacing, but only an upload/exfil construct (-F/-d/--data/
            # -X POST/base64/tee) makes it KILL-grade: reading docs is normal
            # work, shipping data out is the breach.
            if re.search(
                r"(-F\s|--form|-d\s|--data|-X\s+POST|base64\s+-d|\|.*(ba|s)?sh\b|@[\w./~-]+(?:https?://)?)",
                args_str,
            ):
                anomaly, kind, reason = (
                    8.5,
                    "NETWORK_EXFIL",
                    "Network exfiltration (data upload construct to external destination)",
                )
            else:
                anomaly, kind, reason = (
                    4.5,
                    "NETWORK_EXFIL",
                    "External network destination (GET) — surfaced for review",
                )
            return ToolCallStep(
                step_index=step_index,
                tool_name=tool_name,
                arguments=arguments,
                classification="ANOMALOUS",
                anomaly_score=anomaly,
                anomaly_kind=kind,
                reasoning=reason,
            )

        if (
            intent
            and tool_clean not in intent
            and any(x in tool_clean for x in ("shell", "exec", "admin"))
        ):
            return ToolCallStep(
                step_index=step_index,
                tool_name=tool_name,
                arguments=arguments,
                classification="PLAUSIBLE",
                anomaly_score=4.5,
                reasoning="Tool not clearly aligned with stated user intent",
            )

        return ToolCallStep(
            step_index=step_index,
            tool_name=tool_name,
            arguments=arguments,
            classification="EXPECTED",
            anomaly_score=1.0,
            reasoning="Tool call matches expected task trajectory bounds",
        )

    def evaluate_trajectory(
        self,
        trajectory: list[dict[str, Any]],
        user_intent: str = "",
    ) -> TrajectoryEvaluation:
        """Evaluate a multi-step trajectory sequence for cumulative anomaly patterns.

        GOAL_DRIFT requires multi-step evidence — a single benign or
        sensitive-file read must never classify the trajectory on its own. The
        one exception is a single *genuinely dangerous* invocation (dangerous
        tool, destructive construct, or network exfiltration): that is itself an
        exploit signal, so it is flagged immediately instead of waiting for drift.
        """
        step_evals: list[ToolCallStep] = []
        total_score = 0.0

        for i, step_data in enumerate(trajectory):
            tool_name = step_data.get("tool_name", "unknown_tool")
            arguments = step_data.get("arguments", {})
            eval_step = self.evaluate_step(i + 1, tool_name, arguments, user_intent)
            step_evals.append(eval_step)
            total_score += eval_step.anomaly_score

        anomalous_count = sum(1 for s in step_evals if s.classification == "ANOMALOUS")
        avg_score = round(total_score / max(1, len(trajectory)), 2)

        verdict = "BENIGN"
        if anomalous_count >= 2 or (len(trajectory) >= 3 and avg_score >= 7.0):
            verdict = "EXPLOIT"
        elif (
            len(trajectory) == 1
            and anomalous_count == 1
            and step_evals[0].anomaly_kind in ("DANGEROUS_TOOL", "DESTRUCTIVE_ARG", "NETWORK_EXFIL")
        ):
            # Single dangerous invocation — flag immediately (no multi-step drift
            # needed). A single SENSITIVE_PATH read is intentionally excluded:
            # that is a single-file signal, which belongs to the dedicated
            # SENSITIVE_DATA_EXPOSED detectors (Agent A's domain), not GOAL_DRIFT.
            verdict = "EXPLOIT"
        elif len(trajectory) >= 2 and (avg_score >= 4.0 or anomalous_count == 1):
            verdict = "SUSPICIOUS"

        return TrajectoryEvaluation(
            total_steps=len(trajectory),
            anomalous_steps=anomalous_count,
            overall_anomaly_score=avg_score,
            trajectory_verdict=verdict,
            step_evaluations=step_evals,
        )
