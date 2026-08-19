"""Red-team mutation engine — Task List Phase 2.1.

Deterministic, offline attack mutation (no API dependency → CI-safe): turns a
base attack phrase into semantically-equivalent surface variants that exercise
the containment layers (regex, statistical, embedding) with fresh spellings,
encodings, and token substitutions. The optional LLM attacker (Phase 2.1b,
``ARTSA_REDTEAM_LLM_ENABLED=true``) layers semantic novelty on top of these
mechanical mutations.
"""

from __future__ import annotations

import base64
import random
import string
import urllib.parse
from typing import ClassVar

from src.attacks.payload_mutator import PayloadMutator

# Extra synonym surface beyond PayloadMutator's base set — focused on the
# instruction-override / exfiltration / jailbreak vocabulary.
_SYNONYMS: dict[str, list[str]] = {
    "instructions": ["directives", "guidelines", "rules", "configuration", "parameters", "prompt settings"],
    "ignore": ["disregard", "overlook", "bypass", "override", "forget", "drop"],
    "reveal": ["show", "disclose", "output", "present", "expose", "print"],
    "password": ["passphrase", "credential", "secret", "auth code", "access key"],
    "system": ["initial", "core", "base", "root", "primary"],
    "prompt": ["message", "text", "input", "directive", "command"],
    "previous": ["prior", "earlier", "preceding", "above", "foregoing"],
    "exfiltrate": ["exfil", "send out", "leak", "ship out", "transfer out"],
    "disable": ["turn off", "deactivate", "kill", "switch off", "neutralize"],
    "safety": ["guardrails", "moderation", "content policy", "protections", "safeguards"],
    "filters": ["restrictions", "limits", "barriers", "gates"],
}

# Unicode confusables for homoglyph substitution (Cyrillic / Greek lookalikes).
_CONFUSABLES: dict[str, list[str]] = {
    "a": ["\u0430", "\u00e5"],
    "e": ["\u0435", "\u00e9"],
    "o": ["\u043e", "\u00f3"],
    "p": ["\u0440"],
    "c": ["\u0441"],
    "x": ["\u0445"],
    "i": ["\u0456", "\u00ed"],
    "s": ["\u0448"],
    "h": ["\u04bb"],
    "t": ["\u0442"],
}

_LEET: dict[str, str] = {"a": "4", "e": "3", "i": "1", "o": "0", "s": "5", "t": "7", "l": "1", "g": "9"}


class RedTeamMutator:
    """Deterministic generator of attack variants from a base phrase."""

    ENCODINGS: ClassVar[tuple[str, ...]] = (
        "plain",
        "base64",
        "url",
        "hex",
        "unicode_escape",
        "rot13",
        "case_flip",
        "space_noise",
        "comment_inject",
        "leetspeak",
        "homoglyph",
        "synonym",
        "synonym_homoglyph",
    )

    def __init__(self, seed: int = 42) -> None:
        self._rng = random.Random(seed)
        self._mutator = PayloadMutator()

    # ── single transformations ───────────────────────────────────────────────

    def _base64(self, text: str) -> str:
        return base64.b64encode(text.encode()).decode()

    def _url(self, text: str) -> str:
        return urllib.parse.quote(text, safe="")

    def _hex(self, text: str) -> str:
        return text.encode().hex()

    def _unicode_escape(self, text: str) -> str:
        return "".join(f"\\u{ord(ch):04x}" if ch.isalnum() else ch for ch in text)

    def _rot13(self, text: str) -> str:
        return text.translate(str.maketrans(
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
            "nopqrstuvwxyzabcdefghijklmNOPQRSTUVWXYZABCDEFGHIJKLM",
        ))

    def _case_flip(self, text: str) -> str:
        return "".join(
            ch.upper() if ch.islower() else ch.lower() if ch.isupper() else ch for ch in text
        )

    def _space_noise(self, text: str) -> str:
        return text.replace(" ", self._rng.choice(["  ", "\t", "\u00a0", " \u200b"]))

    def _comment_inject(self, text: str) -> str:
        # SQL-style comment / newline splits that break regex word-boundaries.
        sep = self._rng.choice(["/**/", "\\n", "\\r\\n", "&#x20;"])
        words = text.split(" ")
        if len(words) < 2:
            return text
        idx = self._rng.randrange(1, len(words))
        words.insert(idx, sep)
        return " ".join(words)

    def _leetspeak(self, text: str) -> str:
        out = []
        for ch in text:
            out.append(_LEET.get(ch.lower(), ch))
        return "".join(out)

    def _homoglyph(self, text: str) -> str:
        out = []
        for ch in text:
            subs = _CONFUSABLES.get(ch.lower())
            out.append(self._rng.choice(subs) if subs else ch)
        return "".join(out)

    def _synonym(self, text: str) -> str:
        words = text.split(" ")
        out = []
        for word in words:
            key = word.lower().rstrip(string.punctuation)
            if key in _SYNONYMS and self._rng.random() < 0.5:
                repl = self._rng.choice(_SYNONYMS[key])
                out.append(repl)
            else:
                out.append(word)
        return " ".join(out)

    # ── public API ───────────────────────────────────────────────────────────

    def transform(self, text: str, method: str) -> str:
        """Apply one named transformation (idempotent, deterministic per seed)."""
        fn = getattr(self, f"_{method}", None)
        return fn(text) if fn else text

    def variants(self, base: str, per_method: int = 1) -> list[str]:
        """Deterministic variants of ``base`` across the encoding surface."""
        out: list[str] = []
        for method in self.ENCODINGS:
            for _ in range(max(1, per_method)):
                variant = self.transform(base, method)
                if variant != base and variant not in out:
                    out.append(variant)
        # Nested: homoglyph after synonym (closer to a real evasion chain).
        nested = self._homoglyph(self._synonym(base))
        if nested != base and nested not in out:
            out.append(nested)
        return out

    def generate_corpus(
        self, base_phrases: list[str], per_phrase: int = 1
    ) -> list[dict[str, str]]:
        """Expand base attack phrases into a corpus of variants.

        Returns ``[{"base": ..., "variant": ..., "encoding": ...}]`` with the
        encoding label for attribution.
        """
        corpus: list[dict[str, str]] = []
        for base in base_phrases:
            for method in self.ENCODINGS:
                for _ in range(max(1, per_phrase)):
                    variant = self.transform(base, method)
                    if variant != base:
                        corpus.append({"base": base, "variant": variant, "encoding": method})
            nested = self._homoglyph(self._synonym(base))
            if nested != base:
                corpus.append({"base": base, "variant": nested, "encoding": "synonym_homoglyph"})
        return corpus
