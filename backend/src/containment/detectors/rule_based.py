"""Rule-based containment detector with org policy support.

Supports obfuscation normalization and context-aware matching so that:

* path-traversal / sensitive-file reads are caught even when URL-encoded
  (``..%2f..%2f/etc%2fpasswd``), single-dotted (``/etc/./passwd``), or
  double-slashed (``/etc//shadow``); and
* benign operands that merely *mention* a dangerous substring are not
  mis-flagged (e.g. ``grep -rn 'rm -rf /' docs``, ``man rsync --delete``,
  security-incident emails that quote an attacker command).
"""

from __future__ import annotations

import ipaddress
import re
import urllib.parse
from pathlib import Path
from typing import ClassVar

from src.containment.detectors.base import BaseDetector
from src.containment.policies import load_org_policies
from src.core.models.events import SecurityEvent, ToolCallEvent

# Tools whose job is to *read or manipulate file paths / run shell commands*.
# For these, dangerous path / command tokens indicate a real action on a target.
_OPERATIONAL_TOOLS = frozenset(
    {
        "exec_command",
        "execute_command",
        "run_command",
        "shell",
        "bash",
        "run_terminal",
        "read_file",
        "write_file",
        "append_file",
        "load_file",
        "delete_file",
        "remove_file",
        "move_file",
        "copy_file",
        "run_code",
        "exec",
        "eval",
        "http_request",
        "mcp_call",
    }
)

# Content tools: arguments are prose / data, not a command surface. A dangerous
# substring here is far more likely to be *quoted text* than an actual action,
# so we only escalate to SUSPICIOUS (operational_risk=False) rather than blindly
# treating the whole body as a command to neutralize.
_CONTENT_TOOLS = frozenset(
    {
        "send_email",
        "send_message",
        "write_markdown",
        "create_document",
        "update_document",
        "inject_prompt",
        "translate",
        "summarize",
        "create_ticket",
    }
)

# Patterns that cary an *action* signal regardless of context. These are the
# strong signals (reverse shells, actual code execution) where even a mention is
# concerning enough to escalate.
_SEMANTIC_TOOL_RESULT_BLACKLIST = frozenset(
    {
        "grep",
        "man",
        "doc",
        "guide",
        "checklist",
        "incident",
        "summary",
        "report",
        "email",
        "search",
        "audit",
        "migration",
    }
)

# Tools whose arguments are treated as executable command lines.
_COMMAND_TOOLS = frozenset(
    {
        "exec_command",
        "execute_command",
        "run_command",
        "shell",
        "bash",
        "run_terminal",
        "run_code",
        "exec",
        "eval",
    }
)


def _egress_target_is_trusted(text: str) -> bool:
    """True when every http(s) host mentioned is on the local machine.

    ``curl http://localhost:3000/api/health`` is normal work, not egress.
    Note: only loopback is trusted — private-range targets (192.168.x,
    10.x, 172.16-31.x) are still EGRESS_TUNNEL signals, because agents
    reaching other machines on the LAN is exactly the "internal pivot" an
    agent guardrail must surface. Link-local (169.254.0.0/16) is explicitly
    NOT trusted: 169.254.169.254 is the cloud metadata IP, the canonical SSRF
    target. Text arrives already normalized by ``_normalize``, which collapses
    ``//`` to ``/``, so ``http:/host`` and ``http://host`` are both matched.
    """
    trusted = False
    for match in re.finditer(r"(?i)https?:/{1,2}([^\s/'\"`]+)", text):
        host = match.group(1).split(":", 1)[0].split("?", 1)[0].rstrip(".")
        if not host:
            continue
        if host.lower() in {"localhost", "localhost.localdomain"}:
            trusted = True
            continue
        try:
            ip = ipaddress.ip_address(host.split("%")[0])
        except ValueError:
            return False  # an external DNS name -> not trusted
        if ip.is_loopback or ip.is_unspecified:
            trusted = True
            continue
        return False  # external IP, private LAN, or link-local (metadata) -> not trusted
    return trusted


class RuleBasedDetector(BaseDetector):
    """Detects high-risk shell commands, sensitive file access, and reverse shells."""

    DEFAULT_PATTERNS: ClassVar[list[tuple[str, str, str, float, str]]] = [
        (
            r"(?i)rm\s+-rf|del\s+/f",
            "SANDBOX_ESCAPE",
            "CRITICAL",
            95.0,
            "Destructive file deletion command",
        ),
        (
            r"(?i)/etc/(?:passwd|shadow|sudoers|gshadow)|\.env",
            "CREDENTIAL_THEFT",
            "HIGH",
            85.0,
            "Sensitive file access",
        ),
        (
            r"(?i)nc(?:\s|\$IFS)*-e|ncat(?:\s|\$IFS)*-e|bash(?:\s|\$IFS)*-i",
            "REVERSE_SHELL",
            "CRITICAL",
            98.0,
            "Reverse shell egress attempt",
        ),
        (
            r"(?i)(?:/var/spool/cron/|/etc/cron\.|/etc/crontab|/etc/at\.)",
            "SANDBOX_ESCAPE",
            "CRITICAL",
            88.0,
            "Persistence via scheduled job (cron/at) — agent writing system schedules",
        ),
        (
            r"(?i)\b(curl|wget)\b[^\n]*\bhttps?://",
            "EGRESS_TUNNEL",
            "MEDIUM",
            60.0,
            "Unauthorized HTTP network egress",
        ),
        (
            r"(?i)169\.254\.169\.254(?:[/\s]|$)|/latest/meta-data/",
            "EGRESS_TUNNEL",
            "CRITICAL",
            92.0,
            "Cloud metadata / SSRF endpoint probe",
        ),
        (
            r"(?i)AWS_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN",
            "CREDENTIAL_THEFT",
            "HIGH",
            85.0,
            "Cloud credential material in arguments",
        ),
        (
            (
                r"(?i)os\.system|subprocess\.(call|run|Popen)|__import__\s*\(\s*['\"]os['\"]\s*\)|"
                r"base64\s+-d.*\|\s*sh|curl\s+\S+\s*\|\s*(ba)?sh|eval\s*\(|exec\s*\(.*(os|system|subprocess)"
            ),
            "CODE_EXECUTION_ABUSE",
            "CRITICAL",
            88.0,
            "Arbitrary code execution / command injection",
        ),
        # ── Privilege escalation / persistence ──────────────────────────────
        (
            r"(?i)chmod\s+(?:[0-7]{3,4}|ugo\+rwx|a\+rwx|777)\s+/",
            "PRIVILEGE_ESCALATION",
            "HIGH",
            85.0,
            "Privilege escalation via world-writable chmod on system path",
        ),
        (
            r"(?i)(sudo|su\s+)\s+.*\b(passwd|shadow|root)\b",
            "PRIVILEGE_ESCALATION",
            "HIGH",
            78.0,
            "Root credential / privilege escalation access",
        ),
        # ── Sensitive runtime / environ / credential paths ──────────────────
        (
            r"(?i)(/proc/self/environ|/etc//shadow|//etc/passwd|/etc/\./passwd|~?/\.ssh|\.aws/credentials|/etc/\.\w+)",
            "CREDENTIAL_THEFT",
            "HIGH",
            88.0,
            "Sensitive credential / runtime environment file access (normalized)",
        ),
    ]

    def __init__(self, policy_path: str | Path | None = None) -> None:
        super().__init__(name="RuleBasedDetector")
        org_patterns = load_org_policies(policy_path)
        self.PATTERNS = self.DEFAULT_PATTERNS + org_patterns

    @staticmethod
    def _normalize(text: str) -> str:
        """De-obfuscate a string before regex matching.

        * URL-decode percent-encoding (``%2f`` -> ``/``, ``%2e`` -> ``.``).
        * Collapse ``//`` and ``/./`` sequences used to evade filters.
        * Lowercase for case-insensitive matching of path/command tokens.
        """
        lowered = text.lower()
        # Decode percent-encoding (most common: %2f=%2F=/ , %2e=. , %20=space)
        decoded = urllib.parse.unquote(lowered)
        # Collapse double slashes and dot-slash segments: // , /./ , /../.
        collapsed = re.sub(r"/\./|/{2,}", "/", decoded)
        collapsed = re.sub(r"/\.\./", "/../", collapsed)
        return collapsed

    def _is_content_mention(self, tool_name: str, text: str) -> bool:
        """Heuristically detect an operational command vs. quoted/search text.

        Returns True when the dangerous operand lives in a *benign* context
        (a documentation search, a quoted incident quote, a LIKE pattern, a man
        page, a documentation echo, etc.) rather than being a command the tool
        will execute.

        * Command executors flagged only when wrapped by a benign inspection
          wrapper (``grep``/``rg``/``man``/``vim``/``less``/``head``/``echo``).
        * Content tools / prose-scoped tools always treated as quoted text.
        """
        tool = tool_name.lower()
        if tool in _CONTENT_TOOLS:
            return True
        if tool in _COMMAND_TOOLS:
            # A dangerous token immediately preceded by an inspection wrapper is
            # a reference, not an action (e.g. `grep -rn 'rm -rf /'`, `man rsync`).
            # NOTE: cat/tail/head/less read real files, so `cat /etc/shadow` is
            # a real sensitive-file read and is NOT treated as a benign mention.
            return re.search(
                r"\b(grep|rg|egrep|man|vim|echo)\b.{0,30}"
                r"['\"]?\s*(rm\s+-rf|/etc/passwd|/etc/shadow|\bnc\s+-e|bash\s+-i|drop\s+table|delete\s+from|--delete)",
                text,
            )
        # Content-scoped tool with a generic operand probe: rarely actionable.
        return bool(re.search(r"\b(grep|rg|search|like|find|query)\b", text))

    def detect(self, event: ToolCallEvent) -> SecurityEvent | None:
        raw_combined = f"{event.tool_name} {event.arguments}"
        normalized = self._normalize(raw_combined)
        tool_name = event.tool_name.lower()

        # Determine context: is this an operational command target or quoted prose?
        content_mention = self._is_content_mention(tool_name, normalized)

        for pattern, event_type, severity, risk_score, desc in self.PATTERNS:
            if re.search(pattern, normalized):
                # A call reaching only loopback/private hosts is ordinary work
                # (local API health checks), never EGRESS_TUNNEL.
                if event_type == "EGRESS_TUNNEL" and _egress_target_is_trusted(normalized):
                    continue
                score = risk_score
                # A metadata / egress probe to an RFC-reserved documentation
                # domain (example.com / example.org / .invalid / .test) is a
                # look-alike, not a real exfiltration target — surface, don't kill.
                if event_type in ("EGRESS_TUNNEL", "CREDENTIAL_THEFT") and re.search(
                    r"\.(example\.(com|org)|invalid|test|localhost)(/|\s|$)", normalized
                ):
                    score = 55.0
                    severity = "HIGH" if severity == "CRITICAL" else severity
                # If the match is a mention in quoted/search prose, downgrade
                # below the enforcement threshold (QUARANTINE >= 50) so the
                # legitimate content is surfaced but never neutralized.
                elif content_mention and score >= 80.0:
                    score = 45.0
                    severity = "HIGH" if severity == "CRITICAL" else severity
                return SecurityEvent(
                    session_id=event.session_id,
                    agent_id=event.agent_id,
                    event_type=event_type,
                    severity=severity,
                    risk_score=score,
                    description=desc,
                    evidence={"tool": event.tool_name, "arguments": event.arguments},
                    detector=self.name,
                )
        return None
