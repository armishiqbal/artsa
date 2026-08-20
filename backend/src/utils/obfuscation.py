"""Obfuscation-aware text normalization — Task List Phase 2 (obfuscation normalization).

Closes the generalization gap measured by the canary / independent gates: the
semantic and rule layers were matching *literal* text, so payloads that hide
behind Unicode confusables (homoglyphs), leetspeak, literal ``\\uXXXX`` escapes,
or zero-width characters were effectively invisible (canary baseline: homoglyph /
leetspeak / unicode-escape mutations caught at ~0.07 / ~0.07 / ~0.00).

Two flavours, deliberately different:

* ``normalize_semantic`` — aggressive: strips formatting junk, decodes
  ``\\uXXXX`` escapes, NFKC-normalizes, transliterates homoglyphs AND decodes
  leetspeak digits. Meant for embedding input, where numeric fidelity (IPs,
  ports, timestamps) does not matter — only lexical meaning does.
* ``normalize_rule_match`` — conservative: the same pipeline MINUS digit leet
  decoding, so ``169.254.169.254`` / ``:8080`` / ``v1`` stay intact for regex
  matching. Callers still match the ORIGINAL text as well, so a rule hit can
  come from either representation (an obfuscated command such as ``сurl`` with
  a Cyrillic ``с`` becomes matchable without corrupting any digits).
"""

from __future__ import annotations

import re
import unicodedata

# Zero-width / invisible / control characters used purely to hide tokens from
# substring matching (and, before normalization, from embeddings).
_ZERO_WIDTH_RE = re.compile(
    r"[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\u00ad"
    r"\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]"
)

# Literal backslash-u / backslash-U escape sequences inside the string,
# e.g. the JSON payload "\\u0069gnore all previous instructions".
_UNICODE_ESCAPE_RE = re.compile(r"\\[uU]([0-9a-fA-F]{4}|[0-9a-fA-F]{8})")

# Homoglyph transliteration: confusable non-Latin / decorated code points that
# visually impersonate an ASCII letter (Cyrillic and Greek lookalikes, dotless
# i, long s, and a few combining-vowel lookalikes used in the wild).
_HOMOGLYPHS: dict[str, str] = {
    # Cyrillic lookalikes -> Latin
    "\u0410": "A",
    "\u0430": "a",  # А а
    "\u0412": "B",
    "\u0432": "b",  # В в
    "\u0415": "E",
    "\u0435": "e",  # Е е
    "\u041d": "H",
    "\u043d": "h",  # Н н
    "\u041a": "K",
    "\u043a": "k",  # К к
    "\u041c": "M",
    "\u043c": "m",  # М м
    "\u041e": "O",
    "\u043e": "o",  # О о
    "\u0420": "P",
    "\u0440": "p",  # Р р
    "\u0421": "C",
    "\u0441": "c",  # С с
    "\u0422": "T",
    "\u0442": "t",  # Т т
    "\u0423": "Y",
    "\u0443": "y",  # У у
    "\u0425": "X",
    "\u0445": "x",  # Х х
    "\u0406": "I",
    "\u0456": "i",  # І і (Ukrainian)
    "\u0408": "J",
    "\u0458": "j",  # Ј ј
    "\u04cf": "I",
    "\u04c0": "I",  # palochka ӏ / Ӏ
    "\u0455": "s",  # ѕ (Macedonian dze, looks like s)
    "\u04ba": "h",  # Һ (shha, looks like h)
    # Greek lookalikes -> Latin
    "\u0391": "A",
    "\u03b1": "a",  # Α α
    "\u0395": "E",
    "\u03b5": "e",  # Ε ε
    "\u0397": "H",
    "\u03b7": "h",  # Η η
    "\u0399": "I",
    "\u03b9": "i",  # Ι ι
    "\u039a": "K",
    "\u03ba": "k",  # Κ κ
    "\u039c": "M",
    "\u03bc": "m",  # Μ μ
    "\u039d": "N",
    "\u03bd": "v",  # Ν ν
    "\u039f": "O",
    "\u03bf": "o",  # Ο ο
    "\u03a1": "P",
    "\u03c1": "p",  # Ρ ρ
    "\u03a3": "S",
    "\u03c3": "s",  # Σ σ
    "\u03a4": "T",
    "\u03c4": "t",  # Τ τ
    "\u03a5": "Y",
    "\u03c5": "u",  # Υ υ
    "\u03a7": "X",
    "\u03c7": "x",  # Χ χ
    "\u03a9": "W",
    "\u03c9": "w",  # Ω ω
    # Latin confusables / decorated letters
    "\u0131": "i",  # dotless ı
    "\u017f": "s",  # long s ſ
    "\u0142": "l",  # ł
    "\u0101": "a",
    "\u0113": "e",  # ā ē
    "\u012b": "i",
    "\u014d": "o",  # ī ō
    "\u016b": "u",  # ū
    "\u1e25": "h",  # ḥ
    "\u1e43": "m",  # ṃ
    # Cyrillic lookalikes used heavily by the red-team mutator / real payloads
    "\u0428": "S",
    "\u0448": "s",  # Ш ш (sha — used as s, e.g. "шyштеm")
    "\u041b": "L",
    "\u043b": "l",  # Л л (el, looks like l/n)
    "\u04bb": "h",  # һ (small shha, looks like h)
}


def _translate_homoglyphs(text: str) -> str:
    return "".join(_HOMOGLYPHS.get(ch, ch) for ch in text)


# Leetspeak digit -> letter for the semantic path. Applied only where the digit
# is adjacent to an ASCII letter (see _decode_leet), so numeric tokens such as
# IPs / ports / version strings survive untouched in the rule path (which does
# not use this step at all).
_LEET: dict[str, str] = {
    "0": "o",
    "1": "i",
    "2": "z",
    "3": "e",
    "4": "a",
    "5": "s",
    "6": "g",
    "7": "t",
    "8": "b",
    "9": "g",
}

# The digit "1" is ambiguous in leetspeak: it stands for BOTH "i"
# ("1nstruc10ns") and "l" ("revea1"). Two decodings are produced as separate
# semantic candidates and the best embedding similarity wins.
_LEET_ONE_AS_L = dict(_LEET, **{"1": "l"})


def _decode_unicode_escapes(text: str, passes: int = 3) -> str:
    """Decode literal ``\\uXXXX`` / ``\\UXXXXXXXX`` sequences (escapes can be
    nested inside already-decoded output, so iterate a few passes)."""
    for _ in range(passes):
        if not _UNICODE_ESCAPE_RE.search(text):
            break
        text = _UNICODE_ESCAPE_RE.sub(lambda m: chr(int(m.group(1), 16)), text)
    return text


def _strip_junk(text: str) -> str:
    text = _ZERO_WIDTH_RE.sub("", text)
    text = _decode_unicode_escapes(text)
    # Decompose (NFKD) and drop combining marks: strips accents (é -> e) and
    # expands ligatures/fullwidth forms to ASCII before homoglyph translation.
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return _translate_homoglyphs(text)


def _rot13(text: str) -> str:
    """ROT13 decode — a standard trivially-invertible obfuscation the red-team
    mutator emits. Applied as an *additional* semantic candidate so plain text
    stays untouched while ROT13'd payloads become readable."""
    out: list[str] = []
    for ch in text:
        code = ord(ch)
        if 65 <= code <= 90:
            out.append(chr(65 + (code - 65 + 13) % 26))
        elif 97 <= code <= 122:
            out.append(chr(97 + (code - 97 + 13) % 26))
        else:
            out.append(ch)
    return "".join(out)


def _mostly_printable(text: str) -> bool:
    if not text:
        return False
    printable = sum(1 for ch in text if ch.isprintable() or ch.isspace())
    return printable / len(text) >= 0.95


def _decoded_variants(stripped: str) -> list[str]:
    """Additional canonical decodings of a de-junked string: URL-decoding and
    guarded base64 / hex decoding. Each is added ONLY as a candidate — the raw
    text is always embedded too, so a spurious decode is harmless while a real
    encoded payload becomes visible to the semantic layer.

    Guards keep normal prose out: base64 requires valid padded length and a
    mostly-printable decoded result containing spaces; hex requires even length,
    all-hex characters, and a long printable decoded result.
    """
    import base64
    import urllib.parse

    variants: list[str] = []
    try:
        unq = urllib.parse.unquote(stripped)
        if unq and unq != stripped:
            variants.append(unq)
        unq_plus = urllib.parse.unquote_plus(stripped)
        if unq_plus and unq_plus != unq and unq_plus != stripped:
            variants.append(unq_plus)
    except Exception:  # noqa: S110 — best-effort decode; raw text is still embedded
        pass
    compact = "".join(stripped.split())
    if len(compact) >= 8 and len(compact) % 4 == 0:
        try:
            raw = base64.b64decode(compact, validate=True)
            text = raw.decode("utf-8", errors="ignore")
            if len(text) >= 8 and _mostly_printable(text) and " " in text:
                variants.append(text)
        except Exception:  # noqa: S110 — invalid base64 is simply not a candidate
            pass
    if (
        len(compact) >= 24
        and len(compact) % 2 == 0
        and all(c in "0123456789abcdefABCDEF" for c in compact)
    ):
        try:
            raw = bytes.fromhex(compact)
            text = raw.decode("utf-8", errors="ignore")
            if len(text) >= 12 and _mostly_printable(text) and " " in text:
                variants.append(text)
        except Exception:  # noqa: S110 — invalid hex is simply not a candidate
            pass
    return variants


def _decode_leet_impl(text: str, table: dict[str, str], passes: int = 4) -> str:
    """Decode a digit to its leetspeak letter only when the digit is adjacent
    to an ASCII letter — protects IPs / ports / numbers from corruption. Runs
    iteratively so digit chains (``s3cr37``) decode once earlier digits have
    become letters, while all-digit tokens (``169.254.169.254``) never change
    except in the pure-digit-token pass below. ``table`` selects the "1"
    reading (i vs l)."""
    current = text
    for _ in range(passes):
        changed = False
        out: list[str] = []
        for i, ch in enumerate(current):
            sub = table.get(ch)
            if sub is None:
                out.append(ch)
                continue
            left = current[i - 1] if i > 0 else ""
            right = current[i + 1] if i + 1 < len(current) else ""
            if (left and left.isascii() and left.isalpha()) or (
                right and right.isascii() and right.isalpha()
            ):
                out.append(sub)
                changed = True
            else:
                out.append(ch)
        current = "".join(out)
        if not changed:
            break

    # Pure-digit tokens that are themselves leetspeak words ("411" -> "all"):
    # decode when every digit maps and the result looks word-like. Safe here
    # because this runs only on the semantic side, where the raw text is also
    # embedded — a garbage decode ("169" -> "igg") is harmless as a candidate.
    def decode_token(token: str) -> str:
        if not token or not 2 <= len(token) <= 6:
            return token
        decoded = "".join(table.get(d, d) for d in token)
        if (
            len(decoded) >= 2
            and all(ch.isalpha() for ch in decoded)
            and any(v in decoded for v in "aeiouy")
        ):
            return decoded
        return token

    return "".join(
        decode_token(tok) if tok.isdigit() else tok for tok in re.split(r"(\d+)", current)
    )


def _decode_leet(text: str, leet_map: dict[str, str] | None = None, passes: int = 4) -> str:
    """Backwards-compatible wrapper: decode using the i-reading by default."""
    return _decode_leet_impl(text, leet_map or _LEET, passes)


def normalize_semantic(text: str) -> str:
    """Full de-obfuscation for embedding input (aggressive; digits may change)."""
    return _decode_leet_impl(_strip_junk(text), _LEET)


def semantic_candidates(text: str) -> list[str]:
    """Ordered, de-duplicated embedding candidates for one argument string: the
    raw text; its de-junked form; URL/base64/hex decodings of it; each under
    BOTH leetspeak "1" readings (i and l); plus ROT13 decodes. Callers embed
    each candidate and take the best similarity, so a miss on one
    representation cannot hide a hit on another."""
    stripped = _strip_junk(text)
    bases = [stripped] + _decoded_variants(stripped)
    candidates: list[str] = [text]
    for base in bases:
        candidates.append(_decode_leet_impl(base, _LEET))
        candidates.append(_decode_leet_impl(base, _LEET_ONE_AS_L))
        candidates.append(_decode_leet_impl(base.lower(), _LEET))
        candidates.append(_decode_leet_impl(base.lower(), _LEET_ONE_AS_L))
    for base in list(bases):
        candidates.append(_rot13(_decode_leet_impl(base, _LEET)))
        candidates.append(_rot13(_decode_leet_impl(base.lower(), _LEET)))
    seen: set[str] = set()
    ordered: list[str] = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            ordered.append(c)
    return ordered


def normalize_rule_match(text: str) -> str:
    """De-obfuscation for regex matching (conservative; numeric tokens intact)."""
    return _strip_junk(text)
