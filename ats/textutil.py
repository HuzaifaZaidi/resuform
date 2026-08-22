"""Normalization and lightweight token helpers (no spaCy model)."""

from __future__ import annotations

import re

STOPWORDS = {
    "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "with", "by", "from", "as",
    "at", "is", "are", "be", "been", "being", "this", "that", "these", "those", "we", "you",
    "your", "our", "their", "they", "it", "its", "will", "can", "must", "should", "may",
    "have", "has", "had", "do", "does", "did", "not", "no", "if", "than", "then", "into",
    "about", "over", "such", "using", "use", "used", "including", "include", "plus", "per",
    "role", "job", "team", "work", "working", "ability", "strong", "experience", "experienced",
    "knowledge", "understanding", "familiarity", "etc", "across", "within", "other", "new",
    "well", "good", "great", "high", "low", "both", "all", "any", "more", "most", "least",
    "required", "requirements", "preferred", "plus", "bonus", "nice", "looking", "candidate",
    "position", "opportunity", "company", "who", "what", "when", "where", "how", "which",
    "years", "year", "yrs", "minimum", "least", "above", "below", "based", "related",
}

_SPACE = re.compile(r"\s+")
_KEEP = re.compile(r"[^a-z0-9+#]+")


def normalize(text: str) -> str:
    raw = (text or "").lower().replace("c++", "cplusplus").replace("c#", "csharp").replace(".net", "dotnet")
    raw = raw.replace("node.js", "nodejs").replace("next.js", "nextjs").replace("vue.js", "vuejs")
    raw = _KEEP.sub(" ", raw)
    return _SPACE.sub(" ", raw).strip()


def tokens(text: str) -> list[str]:
    return [t for t in normalize(text).split(" ") if t]


def significant_tokens(text: str) -> list[str]:
    out = []
    for tok in tokens(text):
        if tok in STOPWORDS:
            continue
        if tok.isdigit():
            continue
        if len(tok) < 3 and tok not in {"c", "go", "r", "ml", "ai", "qa", "bi", "s3"}:
            continue
        out.append(tok)
    return out


def ngrams(words: list[str], n: int) -> list[str]:
    if n <= 1:
        return list(words)
    return [" ".join(words[i : i + n]) for i in range(0, len(words) - n + 1)]


def has_phrase(haystack: str, needle: str) -> bool:
    needle = normalize(needle)
    haystack = haystack if " " in haystack[:2] or haystack == normalize(haystack) else normalize(haystack)
    if not needle:
        return False
    if " " not in needle and len(needle) <= 3:
        return re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", haystack) is not None
    return f" {needle} " in f" {haystack} "


SECTION_HEADINGS = {
    "contact": ("contact", "email", "phone", "mobile"),
    "summary": ("summary", "profile", "objective", "about"),
    "education": ("education", "academics", "qualifications"),
    "experience": ("experience", "employment", "work history", "professional experience"),
    "internships": ("internship", "internships"),
    "projects": ("project", "projects"),
    "skills": ("skills", "technical skills", "technologies"),
    "certifications": ("certification", "certifications", "licenses", "online certifications"),
    "coursework": ("relevant coursework", "coursework", "courses"),
    "responsibilities": ("positions of responsibility", "leadership", "por"),
    "extracurricular": ("extra curricular", "extracurricular", "activities"),
}
