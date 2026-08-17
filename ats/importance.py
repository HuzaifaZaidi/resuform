"""Rule-based required / preferred / optional classification. No LLM."""

from __future__ import annotations

from ats.textutil import normalize

REQUIRED_HEADINGS = (
    "required qualifications",
    "required skills",
    "minimum qualifications",
    "mandatory",
    "must have",
    "must-have",
    "what you will need",
    "what you'll need",
    "requirements",
    "required",
)
PREFERRED_HEADINGS = (
    "preferred qualifications",
    "preferred skills",
    "nice to have",
    "nice-to-have",
    "good to have",
    "bonus",
    "desirable",
    "preferred",
)
OPTIONAL_HEADINGS = ("optional", "plus if", "if available")

REQUIRED_INLINE = (
    "required",
    "must have",
    "must-have",
    "mandatory",
    "minimum",
    "need to have",
)
PREFERRED_INLINE = (
    "preferred",
    "nice to have",
    "nice-to-have",
    "a plus",
    "is a plus",
    "bonus",
    "desirable",
    "ideally",
)
OPTIONAL_INLINE = ("optional",)

RANK = {"required": 3, "preferred": 2, "optional": 1, "unclassified": 0}


def _is_heading(line: str) -> bool:
    text = line.strip()
    if not text or len(text) > 80:
        return False
    if text.endswith(":"):
        return True
    if text.isupper() and len(text) < 60:
        return True
    words = text.split()
    return len(words) <= 6 and text[:1].isupper()


def _heading_importance(line: str) -> str | None:
    hay = normalize(line)
    if any(hay.startswith(h) or hay == h for h in OPTIONAL_HEADINGS) or "optional" == hay:
        return "optional"
    if any(h in hay for h in PREFERRED_HEADINGS):
        return "preferred"
    if any(h in hay for h in REQUIRED_HEADINGS):
        return "required"
    return None


def _inline_importance(line: str) -> str | None:
    hay = normalize(line)
    if any(cue in hay for cue in OPTIONAL_INLINE):
        return "optional"
    if any(cue in hay for cue in PREFERRED_INLINE):
        return "preferred"
    if any(cue in hay for cue in REQUIRED_INLINE):
        return "required"
    return None


def classify_jd_lines(jd_text: str) -> list[tuple[str, str]]:
    """Return (line, importance) for each non-empty JD line."""
    current = "unclassified"
    rows = []
    for raw in (jd_text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        if _is_heading(line):
            headed = _heading_importance(line)
            if headed:
                current = headed
        inline = _inline_importance(line)
        importance = inline or current
        rows.append((line, importance))
    return rows


def stronger(a: str, b: str) -> str:
    return a if RANK.get(a, 0) >= RANK.get(b, 0) else b


def importance_label(value: str) -> str:
    return {
        "required": "Required",
        "preferred": "Preferred",
        "optional": "Optional",
        "unclassified": "Unclassified",
    }.get(value, "Unclassified")
