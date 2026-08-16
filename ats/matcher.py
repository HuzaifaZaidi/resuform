"""Dictionary + RapidFuzz matching. No LLM."""

from __future__ import annotations

from rapidfuzz import fuzz

from ats.skills import SKILLS, TECH_CATEGORIES, TITLE_ALIASES
from ats.textutil import has_phrase, ngrams, normalize, significant_tokens, tokens

FUZZY_THRESHOLD = 90
SHORT_FUZZY = 94


def _ngram_set(text: str) -> set[str]:
    words = tokens(text)
    found = set(words)
    for n in (2, 3, 4):
        found.update(ngrams(words, n))
    return found


def find_skill_in_text(text: str, skill: dict, allow_fuzzy: bool = True) -> str | None:
    """Return exact | alias | fuzzy | None."""
    hay = normalize(text)
    aliases = sorted(skill["aliases"], key=len, reverse=True)
    label_norm = normalize(skill["label"])
    for alias in aliases:
        if has_phrase(hay, alias):
            return "exact" if alias == label_norm else "alias"
    if not allow_fuzzy:
        return None
    grams = _ngram_set(text)
    best = 0
    for alias in aliases:
        if len(alias) < 4:
            continue
        for gram in grams:
            if abs(len(gram) - len(alias)) > max(3, len(alias) // 2):
                continue
            threshold = SHORT_FUZZY if len(alias) < 6 else FUZZY_THRESHOLD
            score = fuzz.ratio(alias, gram)
            if score >= threshold and score > best:
                best = score
    return "fuzzy" if best else None


def skills_in_text(text: str, categories: set[str] | None = None) -> list[dict]:
    found = []
    for skill in SKILLS:
        if categories and skill["category"] not in categories:
            continue
        kind = find_skill_in_text(text, skill, allow_fuzzy=False)
        if kind:
            found.append({**skill, "match": kind})
    return found


def match_jd_skills(jd_text: str, resume_text: str) -> list[dict]:
    jd_skills = skills_in_text(jd_text)
    # Keep one row per canonical, prefer technical categories when duplicates exist
    by_key: dict[str, dict] = {}
    for skill in jd_skills:
        prev = by_key.get(skill["canonical"])
        if not prev:
            by_key[skill["canonical"]] = skill
    rows = []
    for skill in by_key.values():
        kind = find_skill_in_text(resume_text, skill) or "not_found"
        label = {
            "exact": "Exact Match",
            "alias": "Alias Match",
            "fuzzy": "Fuzzy Match",
            "not_found": "Not Found",
        }[kind]
        rows.append(
            {
                "term": skill["label"],
                "canonical": skill["canonical"],
                "category": skill["category"],
                "kind": kind,
                "kind_label": label,
                "technical": skill["category"] in TECH_CATEGORIES,
            }
        )
    rows.sort(key=lambda row: (row["kind"] == "not_found", row["term"].lower()))
    return rows


def match_title(jd_text: str, resume_headline: str, resume_text: str) -> dict:
    blob = normalize(jd_text[:800])
    found_titles = []
    for canonical, aliases in TITLE_ALIASES.items():
        if any(has_phrase(blob, alias) for alias in aliases):
            found_titles.append((canonical, aliases))
    hay = f"{normalize(resume_headline)} {normalize(resume_text[:1500])}"
    if not found_titles:
        # Use first JD line as a loose title
        first = (jd_text or "").strip().splitlines()[0] if jd_text else ""
        first = first.strip()[:80]
        if not first:
            return {"wanted": "", "matched": False, "score": 50, "detail": "No job title detected in the description."}
        ratio = fuzz.partial_ratio(normalize(first), hay)
        return {
            "wanted": first,
            "matched": ratio >= 70,
            "score": min(100, ratio),
            "detail": "Compared the opening line of the job description with the resume headline and recent roles.",
        }
    best = 0
    wanted = found_titles[0][0]
    matched = False
    for canonical, aliases in found_titles:
        if any(has_phrase(hay, alias) for alias in aliases):
            matched = True
            best = max(best, 100)
            wanted = canonical
        else:
            for alias in aliases:
                best = max(best, fuzz.partial_ratio(alias, hay))
    return {
        "wanted": wanted.title(),
        "matched": matched or best >= 78,
        "score": 100 if matched else min(100, best),
        "detail": "Job-title phrases from the description compared with the resume headline and experience titles.",
    }


def token_overlap(jd_text: str, resume_text: str) -> float:
    jd = set(significant_tokens(jd_text))
    resume = set(significant_tokens(resume_text))
    if not jd:
        return 0.5
    return len(jd & resume) / len(jd)
