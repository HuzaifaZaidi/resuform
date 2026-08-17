"""Soft-skill evidence phrases. Generic single verbs are not enough."""

from __future__ import annotations

from ats.textutil import has_phrase, normalize

SOFT_SKILLS = {
    "Communication": {
        "strong": (
            "communication",
            "communicated",
            "collaborated",
            "collaboration",
            "cross-functional",
            "cross functional",
            "stakeholder",
            "presented",
            "presentation",
            "documented",
            "documentation",
            "coordinated",
        ),
        "weak": ("worked with",),
        "need_weak": 2,
    },
    "Problem Solving": {
        "strong": (
            "problem solving",
            "problem-solving",
            "diagnosed",
            "investigated",
            "optimized",
            "resolved",
        ),
        "weak": ("analyzed", "identified", "improved", "designed"),
        "need_weak": 2,
    },
    "Leadership": {
        "strong": ("leadership", "led a", "managed a", "mentored", "mentoring"),
        "weak": ("owned", "coordinated"),
        "need_weak": 2,
    },
    "Collaboration": {
        "strong": ("collaboration", "collaborated", "cross-functional", "teamwork"),
        "weak": ("worked with",),
        "need_weak": 2,
    },
}


def find_soft_evidence(resume_text: str, label: str) -> dict:
    spec = SOFT_SKILLS.get(label)
    if not spec:
        hay = normalize(resume_text)
        found = has_phrase(hay, label)
        return {
            "found": found,
            "status": "evidence" if found else "not_found",
            "detail": "Evidence found" if found else "No evidence found",
        }
    hay = normalize(resume_text)
    strong_hits = [p for p in spec["strong"] if has_phrase(hay, p)]
    weak_hits = [p for p in spec["weak"] if has_phrase(hay, p)]
    found = bool(strong_hits) or len(weak_hits) >= spec["need_weak"]
    if found:
        sample = (strong_hits or weak_hits)[0]
        return {"found": True, "status": "evidence", "detail": f"Evidence found ({sample})"}
    return {"found": False, "status": "not_found", "detail": "No evidence found"}
