"""Dictionary + conservative RapidFuzz matching. No LLM."""

from __future__ import annotations

from rapidfuzz import fuzz

from ats.extract import requirement_entries
from ats.importance import classify_jd_lines, importance_label, stronger
from ats.skills import SKILL_BY_ALIAS, STRICT_SKILL_PATTERNS, STRICT_SKILLS, TECH_CATEGORIES, TITLE_ALIASES, category_label
from ats.softskills import SOFT_SKILLS, find_soft_evidence
from ats.textutil import has_phrase, ngrams, normalize, significant_tokens, tokens

FUZZY_THRESHOLD = 93
KIND_LABEL = {
    "exact": "Exact Match",
    "alias": "Alias Match",
    "fuzzy": "Fuzzy Match",
    "evidence": "Evidence found",
    "satisfied": "Satisfied",
    "not_found": "Not Found",
}


def _ngram_set(text: str) -> set[str]:
    words = tokens(text)
    found = set(words)
    for n in (2, 3, 4):
        found.update(ngrams(words, n))
    return found


def find_skill_in_text(text: str, skill: dict, allow_fuzzy: bool = True) -> str | None:
    canonical = skill["canonical"]
    pattern = STRICT_SKILL_PATTERNS.get(canonical)
    if pattern is not None:
        if pattern.search(text or ""):
            return "exact"
        return None
    hay = normalize(text)
    if canonical in STRICT_SKILLS:
        allow_fuzzy = False
    aliases = sorted(skill["aliases"], key=len, reverse=True)
    label_norm = normalize(skill.get("canonical_name") or skill["label"])
    for alias in aliases:
        if has_phrase(hay, alias):
            return "exact" if normalize(alias) == label_norm else "alias"
    if not allow_fuzzy:
        return None
    grams = _ngram_set(text)
    best = 0
    for alias in aliases:
        compact = normalize(alias)
        if len(compact) < 7:
            continue
        prefix = compact[:4]
        for gram in grams:
            other = SKILL_BY_ALIAS.get(gram)
            if other and other["canonical"] != skill["canonical"]:
                continue
            if not gram.startswith(prefix):
                continue
            if abs(len(gram) - len(compact)) > 2:
                continue
            score = fuzz.ratio(compact, gram)
            if score >= FUZZY_THRESHOLD and score > best:
                best = score
    return "fuzzy" if best else None


def evidence_for_skill(skill: dict, structured: dict | None, resume_text: str, kind: str) -> str:
    if kind in {"not_found", None}:
        return "No evidence found"
    if structured:
        checks = [
            ("skills_text", "Found in Skills section"),
            ("headline", "Found in headline"),
            ("experience_text", "Found in Experience"),
            ("internships_text", "Found in Internships"),
            ("projects_text", "Found in Projects"),
            ("education_text", "Found in Education"),
        ]
        for key, label in checks:
            blob = structured.get(key) or ""
            if isinstance(blob, list):
                blob = " ".join(str(item) for item in blob)
            if blob and find_skill_in_text(str(blob), skill, allow_fuzzy=False):
                return label
    return "Found in resume text"


def match_jd_skills(jd_text: str, resume_text: str, structured: dict | None = None) -> list[dict]:
    requirements, _mentions = requirement_entries(jd_text)
    rows = []
    for req in requirements:
        matches = []
        for item in req["alternatives"]:
            skill = item["skill"]
            if skill["category"] == "soft":
                evidence = find_soft_evidence(resume_text, skill["label"])
                kind = "evidence" if evidence["found"] else "not_found"
                kind_label = evidence["detail"] if evidence["found"] else "Not Found"
                evidence_text = evidence["detail"]
            else:
                kind = find_skill_in_text(resume_text, skill) or "not_found"
                kind_label = KIND_LABEL[kind]
                evidence_text = evidence_for_skill(skill, structured, resume_text, kind)
            matches.append(
                {
                    "term": skill.get("canonical_name") or skill["label"],
                    "kind": kind,
                    "kind_label": kind_label,
                    "evidence": evidence_text,
                    "skill": skill,
                }
            )
        importance = req["importance"]
        if req["operator"] == "OR":
            hit = next((m for m in matches if m["kind"] != "not_found"), None)
            skill0 = req["alternatives"][0]["skill"]
            rows.append(
                {
                    "term": req["name"],
                    "canonical": req["name"].lower(),
                    "category": req["category"],
                    "category_label": category_label(req["category"]),
                    "kind": "satisfied" if hit else "not_found",
                    "kind_label": "Satisfied" if hit else "Not Found",
                    "technical": skill0["category"] in TECH_CATEGORIES,
                    "importance": importance,
                    "importance_label": importance_label(importance),
                    "evidence": f"{hit['term']} — {hit['kind_label']}" if hit else "No evidence found",
                    "skill": None,
                    "operator": "OR",
                    "alternatives": [m["term"] for m in matches],
                    "matches": matches,
                }
            )
            continue
        match = matches[0]
        skill = match["skill"]
        rows.append(
            {
                "term": skill.get("canonical_name") or skill["label"],
                "canonical": skill["canonical"],
                "category": skill["category"],
                "category_label": category_label(skill["category"]),
                "kind": match["kind"],
                "kind_label": match["kind_label"],
                "technical": skill["category"] in TECH_CATEGORIES,
                "importance": importance,
                "importance_label": importance_label(importance),
                "evidence": match["evidence"],
                "skill": skill,
                "operator": "NONE",
                "alternatives": [skill.get("canonical_name") or skill["label"]],
                "matches": matches,
            }
        )
    hay = normalize(jd_text)
    jd_lines = classify_jd_lines(jd_text)
    for label in SOFT_SKILLS:
        if any(row["term"] == label for row in rows):
            continue
        if has_phrase(hay, label) or has_phrase(hay, label.lower()):
            evidence = find_soft_evidence(resume_text, label)
            importance = "unclassified"
            for line, imp in jd_lines:
                if has_phrase(normalize(line), label):
                    importance = stronger(importance, imp)
            rows.append(
                {
                    "term": label,
                    "canonical": label.lower(),
                    "category": "soft",
                    "category_label": "Soft Skills",
                    "kind": "evidence" if evidence["found"] else "not_found",
                    "kind_label": evidence["detail"] if evidence["found"] else "Not Found",
                    "technical": False,
                    "importance": importance,
                    "importance_label": importance_label(importance),
                    "evidence": evidence["detail"],
                    "skill": None,
                    "operator": "NONE",
                    "alternatives": [label],
                }
            )
    rows.sort(key=lambda row: (row["kind"] in {"not_found"}, row["term"].lower()))
    return rows


def match_title(jd_text: str, resume_headline: str, resume_text: str) -> dict:
    blob = normalize(jd_text[:900])
    found_titles = []
    for canonical, aliases in TITLE_ALIASES.items():
        if any(has_phrase(blob, alias) for alias in aliases):
            found_titles.append((canonical, aliases))
    hay = f"{normalize(resume_headline)} {normalize(resume_text[:2000])}"
    if not found_titles:
        return {"wanted": "", "matched": False, "score": 55, "detail": "No job title detected in the description."}
    best = 0
    wanted = found_titles[0][0]
    matched = False
    for canonical, aliases in found_titles:
        if any(has_phrase(hay, alias) for alias in aliases):
            matched = True
            best = 100
            wanted = canonical
            break
        for alias in aliases:
            best = max(best, fuzz.ratio(alias, normalize(resume_headline)) if resume_headline else 0)
    return {
        "wanted": wanted.title(),
        "matched": matched or best >= 85,
        "score": 100 if matched else min(100, best),
        "detail": "Job-title phrases from the description compared with the resume headline and roles.",
    }


def token_overlap(jd_text: str, resume_text: str) -> float:
    jd = set(significant_tokens(jd_text))
    resume = set(significant_tokens(resume_text))
    if not jd:
        return 0.5
    return len(jd & resume) / len(jd)
