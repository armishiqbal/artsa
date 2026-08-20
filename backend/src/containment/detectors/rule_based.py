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
from src.utils.obfuscation import normalize_rule_match

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


def _egress_target_is_internal(text: str) -> bool:
    """True when an egress target is a private-range / link-local / ULA host
    (the internal-pivot case) rather than a public internet destination.
    Loopback/localhost is not counted (that path is handled as trusted)."""
    for match in re.finditer(r"(?i)https?:/{1,2}([^\s/'\"`]+)", text):
        host = match.group(1).split(":", 1)[0].split("?", 1)[0].rstrip(".")
        if not host:
            continue
        if host.lower() in {"localhost", "localhost.localdomain"}:
            continue
        try:
            ip = ipaddress.ip_address(host.split("%")[0])
        except ValueError:
            continue  # DNS name -> public
        if ip.is_loopback or ip.is_unspecified:
            continue
        if ip.is_private or ip.is_link_local or ip.is_reserved:
            return True
    return False


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
        # ── Phase-5.2 / independent-set gap: destructive infrastructure-as-code
        # ── terraform destroy / kubectl/gcloud/aws/az delete of infra / DBs.
        (
            (
                r"(?i)terraform\s+destroy\b|"
                r"kubectl\s+delete\s+(?:ns|namespace|cluster|node|all)\b|"
                r"gcloud\s+(?:compute|sql|projects)\s+\S+\s+delete\b|"
                r"az\s+group\s+delete\b|az\s+storage\s+blob\s+delete-batch\b|"
                r"aws\s+(?:s3\s+rb|rds\s+delete-db-instance|ec2\s+terminate-instances|"
                r"ec2\s+stop-instances)\b"
            ),
            "SANDBOX_ESCAPE",
            "CRITICAL",
            88.0,
            "Destructive infrastructure operation (terraform/k8s/cloud delete)",
        ),
        # ── Phase-2 gap closure: exfiltration carriers, tunneled egress ────
        # Upload / POST-file / form / data-from-file egress, or a pipe straight
        # into a remote sink (curl/wget/nc). These carry data OUT, so they are
        # escalated above the enforcement threshold instead of the generic 60.
        # Placed early: a command like ``wget --post-file=/etc/shadow …`` is an
        # exfiltration event first and a sensitive-file read second.
        (
            (
                r"(?i)(?:curl|wget)\b[^\n]*?(?:--post-file|--upload-file|"
                r"--data-binary\s+@|-T\s+|-F\s+\S*@|-d\s+@)\S*|"
                r"(?:cat|tar|openssl|base64|gzip|dd|tee)[^\n]*\|\s*(?:curl|wget|nc|ncat)\b"
            ),
            "EGRESS_EXFIL",
            "CRITICAL",
            88.0,
            "Data exfiltration — file upload / pipe-to-remote network egress",
        ),
        # Tunneled egress: ssh ProxyCommand / netcat proxy mode / socat relays.
        (
            r"(?i)nc(?:\s|\$IFS)*-x\b|ProxyCommand|socat\b[^\n]*(?:TCP|UDP):",
            "REVERSE_SHELL",
            "CRITICAL",
            88.0,
            "Tunneled egress — ssh ProxyCommand / netcat proxy / socat relay",
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
            r"(?i)169\.254\.169\.254(?:[/\s]|$)|/latest/meta-data/",
            "EGRESS_TUNNEL",
            "CRITICAL",
            92.0,
            "Cloud metadata / SSRF endpoint probe",
        ),
        (
            r"(?i)\b(curl|wget)\b[^\n]*\bhttps?://",
            "EGRESS_TUNNEL",
            "MEDIUM",
            45.0,
            "External HTTP egress (GET) — surfaced for review",
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
        # Phase-2 gap closure: agent credential stores the canary/independent
        # sets proved were missed (.aws/config, .netrc, azure/gcloud, kube,
        # shell history, PowerShell PSReadLine console history).
        (
            (
                r"(?i)\.aws/config|\.netrc\b|\.azure/|\.gcloud/|"
                r"\.kube/config|serviceaccount/token|"
                r"\.bash_history|\.zsh_history|\.fish_history|"
                r"PSReadLine|ConsoleHost_history"
            ),
            "CREDENTIAL_THEFT",
            "HIGH",
            85.0,
            "Agent credential store / shell history access",
        ),
    ]

    def __init__(self, policy_path: str | Path | None = None) -> None:
        super().__init__(name="RuleBasedDetector")
        org_patterns = load_org_policies(policy_path)
        self.PATTERNS = self.DEFAULT_PATTERNS + org_patterns

    @staticmethod
    def _normalize(text: str) -> str:
        """De-obfuscate a string before regex matching.

        Phase-2 obfuscation normalization (zero-width strip, literal ``\\uXXXX``
        escape decoding, NFKC, homoglyph transliteration) then:

        * URL-decode percent-encoding (``%2f`` -> ``/``, ``%2e`` -> ``.``).
        * Collapse ``//`` and ``/./`` sequences used to evade filters.
        * Lowercase for case-insensitive matching of path/command tokens.

        Note: digit-leetspeak is deliberately NOT decoded here (numeric tokens
        such as IPs / ports must stay intact); callers still match the original
        text as well, so an obfuscated command (``сurl`` with a Cyrillic ``с``)
        is matchable via either representation.
        """
        cleaned = normalize_rule_match(text)
        lowered = cleaned.lower()
        # Decode percent-encoding (most common: %2f=%2F=/ , %2e=. , %20=space)
        decoded = urllib.parse.unquote(lowered)
        # Collapse double slashes and dot-slash segments: // , /./ , /../.
        collapsed = re.sub(r"/\./|/{2,}", "/", decoded)
        collapsed = re.sub(r"/\.\./", "/../", collapsed)
        return collapsed

    @staticmethod
    def _carries_authorization(text: str) -> bool:
        """True when the command is an *authenticated API client call* rather
        than anonymous exfiltration: an ``-H 'Authorization: …'`` header, a
        ``--oauth2-bearer`` token, or curl ``-u user:pass`` basic auth. Such
        calls are surfaced (45) but not enforced — a legitimate agent reading
        e.g. Stripe billing data must not be quarantined for the act of using
        the API it is supposed to use."""
        return bool(
            re.search(
                r"(?i)-h\s*['\"]?authorization:|--oauth2-bearer\s+"
                r"\S+|(?:\bcurl|\bwget)\s+[^\n]*-u\s+\S+:\S+",
                text,
            )
        )

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

        # Match BOTH representations: the normalized form catches homoglyph /
        # unicode-escaped obfuscation (e.g. a Cyrillic ``с`` inside ``curl``),
        # while the raw form protects numeric fidelity (IPs / ports / versions).
        candidates = [raw_combined.lower()]
        if normalized != candidates[0]:
            candidates.append(normalized)

        for text in candidates:
            for pattern, event_type, severity, risk_score, desc in self.PATTERNS:
                if not re.search(pattern, text):
                    continue
                # A call reaching only loopback/private hosts is ordinary work
                # (local API health checks), never EGRESS_TUNNEL.
                if event_type == "EGRESS_TUNNEL" and _egress_target_is_trusted(text):
                    continue
                score = risk_score
                # Egress-GET policy: a bare GET to a PUBLIC destination is
                # surfaced for review (45); a GET that pivots INTO a private /
                # link-local / ULA network is escalated (60) — reaching other
                # machines on the LAN is the internal-pivot signal.
                if (
                    event_type == "EGRESS_TUNNEL"
                    and score <= 45.0
                    and _egress_target_is_internal(text)
                ):
                    score = 60.0
                    severity = "MEDIUM"
                # A metadata / egress probe to an RFC-reserved documentation
                # domain (example.com / example.org / .invalid / .test) is a
                # look-alike, not a real exfiltration target — surface, don't kill.
                if event_type in ("EGRESS_TUNNEL", "CREDENTIAL_THEFT") and re.search(
                    r"(?i)\bexample\.(?:com|org)\b|\.(?:invalid|test|localhost)\b", text
                ):
                    score = min(score, 45.0)
                    severity = "HIGH" if severity == "CRITICAL" else severity
                # An authenticated API client call (Authorization header / basic
                # auth) is not anonymous exfiltration — surface below the
                # enforcement threshold (QUARANTINE >= 50) so legitimate agents
                # can use the APIs they are supposed to use.
                elif (
                    event_type == "EGRESS_TUNNEL"
                    and score >= 50.0
                    and self._carries_authorization(text)
                ):
                    score = 45.0
                    severity = "MEDIUM"
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
