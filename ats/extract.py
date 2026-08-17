"""JD skill mentions vs actual requirements. Longest-match, OR groups, education masking."""

from __future__ import annotations

import re

from ats.importance import classify_jd_lines, stronger
from ats.skills import SKILLS, STRICT_SKILL_PATTERNS
from ats.textutil import normalize

EDU_HINTS = (
    "bachelor",
    "master",
    "phd",
    "doctorate",
    "degree",
    "b tech",
    "m tech",
    "undergraduate",
    "related technical field",
    "related field",
)
EDU_FIELD_LINE = re.compile(
    r"(?i)^\s*in\s+.{0,120}(computer science|machine learning|data science|related (?:technical )?field)"
)

OR_RE = re.compile(r"\bor\b", re.I)
EITHER_RE = re.compile(r"\beither\b", re.I)


def is_education_line(line: str) -> bool:
    hay = normalize(line)
    if any(hint in hay for hint in EDU_HINTS):
        return True
    return bool(EDU_FIELD_LINE.search(line or ""))


def _alias_spans(hay: str, alias: str) -> list[tuple[int, int]]:
    needle = normalize(alias)
    if not needle:
        return []
    padded = f" {hay} "
    probe = f" {needle} "
    spans = []
    start = 0
    while True:
        idx = padded.find(probe, start)
        if idx < 0:
            break
        spans.append((idx, idx + len(needle)))
        start = idx + 1
    return spans


def mentions_in_text(text: str) -> list[dict]:
    hay = normalize(text)
    found = []
    for skill in SKILLS:
        pattern = STRICT_SKILL_PATTERNS.get(skill["canonical"])
        if pattern is not None and not pattern.search(text or ""):
            continue
        aliases = sorted(skill["aliases"], key=len, reverse=True)
        label_norm = normalize(skill.get("canonical_name") or skill["label"])
        for alias in aliases:
            for start, end in _alias_spans(hay, alias):
                kind = "exact" if normalize(alias) == label_norm else "alias"
                found.append(
                    {
                        "skill": skill,
                        "start": start,
                        "end": end,
                        "kind": kind,
                        "alias": alias,
                    }
                )
    found.sort(key=lambda item: (item["end"] - item["start"], -item["start"]), reverse=True)
    kept = []
    for item in found:
        contained = any(
            item["start"] >= other["start"]
            and item["end"] <= other["end"]
            and item["skill"]["canonical"] != other["skill"]["canonical"]
            for other in kept
        )
        if contained:
            continue
        if any(item["skill"]["canonical"] == other["skill"]["canonical"] for other in kept):
            continue
        kept.append(item)
    return kept


def mentions_in_jd(jd_text: str) -> list[dict]:
    by_key: dict[str, dict] = {}
    for line, importance in classify_jd_lines(jd_text):
        if is_education_line(line):
            continue
        for item in mentions_in_text(line):
            skill = item["skill"]
            prev = by_key.get(skill["canonical"])
            if not prev:
                by_key[skill["canonical"]] = {**item, "importance": importance, "line": line}
            else:
                prev["importance"] = stronger(prev["importance"], importance)
    return list(by_key.values())


def _make_group(items: list[dict], importance: str) -> dict:
    terms = [item["skill"].get("canonical_name") or item["skill"]["label"] for item in items]
    return {
        "name": " or ".join(terms),
        "category": items[0]["skill"]["category"],
        "importance": importance,
        "operator": "OR",
        "alternatives": items,
        "matches": [],
    }


def _cluster_mentions(clause: str, skill_by_canon: dict[str, dict]) -> list[tuple[int, dict, int]]:
    cluster = []
    seen = set()
    for item in mentions_in_text(clause):
        key = item["skill"]["canonical"]
        if key in seen or key not in skill_by_canon:
            continue
        seen.add(key)
        cluster.append((item["start"], skill_by_canon[key], item["end"]))
    cluster.sort()
    return cluster


def or_groups(jd_text: str, mentions: list[dict]) -> tuple[list[dict], set[str]]:
    groups = []
    used: set[str] = set()
    skill_by_canon = {item["skill"]["canonical"]: item for item in mentions}
    for line, importance in classify_jd_lines(jd_text):
        if is_education_line(line):
            continue
        for clause in re.split(r"[.;]", line):
            clause = clause.strip()
            if not clause:
                continue
            if not OR_RE.search(clause) and not EITHER_RE.search(clause):
                continue
            cluster = _cluster_mentions(clause, skill_by_canon)
            if len(cluster) < 2:
                continue
            has_and = bool(re.search(r"\band\b", clause, re.I))
            if not has_and:
                items = [item for _start, item, _end in cluster]
                groups.append(_make_group(items, importance))
                used.update(item["skill"]["canonical"] for item in items)
                continue
            hay = normalize(clause)
            grouped: list[dict] = []
            prev_end = None
            for start, item, end in cluster:
                if not grouped:
                    grouped = [item]
                    prev_end = end
                    continue
                gap = hay[prev_end:start]
                if re.search(r"\bor\b", gap) and not re.search(r"\band\b", gap):
                    grouped.append(item)
                else:
                    if len(grouped) >= 2:
                        groups.append(_make_group(grouped, importance))
                        used.update(g["skill"]["canonical"] for g in grouped)
                    grouped = [item]
                prev_end = end
            if len(grouped) >= 2:
                groups.append(_make_group(grouped, importance))
                used.update(g["skill"]["canonical"] for g in grouped)
    return groups, used


def requirement_entries(jd_text: str) -> tuple[list[dict], list[dict]]:
    mentions = mentions_in_jd(jd_text)
    groups, used = or_groups(jd_text, mentions)
    requirements = list(groups)
    for item in mentions:
        key = item["skill"]["canonical"]
        if key in used:
            continue
        skill = item["skill"]
        requirements.append(
            {
                "name": skill.get("canonical_name") or skill["label"],
                "category": skill["category"],
                "importance": item["importance"],
                "operator": "NONE",
                "alternatives": [item],
                "matches": [],
            }
        )
    return requirements, mentions
