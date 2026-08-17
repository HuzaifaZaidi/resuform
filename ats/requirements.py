"""Requirement extraction from a job description (rules + dictionary)."""

from __future__ import annotations

from datetime import datetime
import re

from ats.skills import SKILLS
from ats.textutil import has_phrase, normalize

DEGREE_PATTERNS = [
    ("PhD / Doctorate", ("phd", "ph.d", "doctorate", "doctoral")),
    ("Master's degree", ("master", "masters", "m.s", "ms ", "m.tech", "mtech", "mba", "m.e", "msc")),
    ("Bachelor's degree", ("bachelor", "bachelors", "b.s", "b.tech", "btech", "b.e", "undergraduate", "bs ", "be ")),
]

YEARS_RE = re.compile(
    r"(\d+)\s*\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)?",
    re.I,
)

CERT_SKILLS = [s for s in SKILLS if s["category"] == "cert"]


def extract_years(text: str) -> int | None:
    years = [int(m.group(1)) for m in YEARS_RE.finditer(text or "")]
    years = [y for y in years if 1 <= y <= 20]
    return min(years) if years else None


def extract_education(jd_text: str) -> dict | None:
    hay = normalize(jd_text)
    has_phd = any(has_phrase(hay, n) or n.strip() in hay for n in ("phd", "ph.d", "doctorate", "doctoral"))
    has_master = any(has_phrase(hay, n) or n.strip() in hay for n in ("master", "masters", "m.s", "m tech", "mtech", "mba", "msc"))
    has_bachelor = any(has_phrase(hay, n) or n.strip() in hay for n in ("bachelor", "bachelors", "b.s", "b tech", "btech", "undergraduate"))
    or_pair = bool(re.search(r"\b(?:bachelor|b\.?s|b\.?tech).{0,40}\bor\b.{0,40}(?:master|m\.?s|m\.?tech)\b", jd_text or "", re.I)) or bool(
        re.search(r"\b(?:master|m\.?s|m\.?tech).{0,40}\bor\b.{0,40}(?:bachelor|b\.?s|b\.?tech)\b", jd_text or "", re.I)
    )
    if has_bachelor and has_master and or_pair:
        return {"label": "Bachelor's or Master's degree", "min_rank": 1, "operator": "OR"}
    if has_phd:
        return {"label": "PhD / Doctorate", "min_rank": 3, "operator": "NONE"}
    if has_master:
        return {"label": "Master's degree", "min_rank": 2, "operator": "NONE"}
    if has_bachelor:
        return {"label": "Bachelor's degree", "min_rank": 1, "operator": "NONE"}
    return None


def extract_certs(jd_text: str) -> list[str]:
    found = []
    for skill in CERT_SKILLS:
        from ats.matcher import find_skill_in_text

        if find_skill_in_text(jd_text, skill):
            found.append(skill["label"])
    return found


def resume_degree_level(resume_text: str) -> int:
    hay = normalize(resume_text)
    if any(has_phrase(hay, n) for n in ("phd", "ph.d", "doctorate")):
        return 3
    if any(has_phrase(hay, n) for n in ("master", "m.s", "m.tech", "mba", "msc")):
        return 2
    if any(has_phrase(hay, n) for n in ("bachelor", "b.s", "b.tech", "b.e", "undergraduate", "btech")):
        return 1
    return 0


def degree_rank(label: str | None) -> int:
    if not label:
        return 0
    if label.startswith("PhD"):
        return 3
    if label.startswith("Master"):
        return 2
    if label.startswith("Bachelor"):
        return 1
    return 0


def estimate_resume_years(resume_text: str) -> int | None:
    years = extract_years(resume_text or "")
    # Date spans like 2020 - 2024
    spans = re.findall(r"(20\d{2})\s*[-–—]\s*(20\d{2}|present|now|current)", resume_text or "", re.I)
    total = 0
    for start, end in spans:
        try:
            s = int(start)
            e = datetime.now().year if not str(end).isdigit() else int(end)
            if e >= s:
                total += min(12, e - s + (1 if str(end).isdigit() else 0))
        except ValueError:
            continue
    if total:
        return max(years or 0, min(20, total))
    return years


def requirements_from_jd(jd_text: str, resume_text: str, skill_rows: list[dict]) -> dict:
    education = extract_education(jd_text)
    years = extract_years(jd_text)
    certs = extract_certs(jd_text)
    resume_level = resume_degree_level(resume_text)
    resume_years = estimate_resume_years(resume_text)

    education_items = []
    if education:
        met = resume_level >= int(education["min_rank"])
        education_items.append(
            {
                "label": education["label"],
                "status": "met" if met else "missing",
                "detail": "Found a matching degree on the resume." if met else "No matching degree language was found on the resume.",
            }
        )

    experience_items = []
    if years is not None:
        met = resume_years is not None and resume_years >= years
        experience_items.append(
            {
                "label": f"{years}+ years of experience",
                "status": "met" if met else "missing",
                "detail": (
                    f"Resume appears to cover about {resume_years} years."
                    if resume_years is not None
                    else "Could not estimate years of experience from the resume."
                ),
            }
        )

    cert_items = []
    resume_certs = extract_certs(resume_text)
    for cert in certs:
        met = cert in resume_certs
        cert_items.append(
            {
                "label": cert,
                "status": "met" if met else "missing",
                "detail": "Mentioned on the resume." if met else "Not found on the resume.",
            }
        )

    tech = [row for row in skill_rows if row["technical"]]
    tools = [row for row in skill_rows if row["category"] in {"tool", "cloud", "database", "framework"}]
    other = [row for row in skill_rows if row["category"] in {"domain", "soft"}]

    def as_req(row: dict) -> dict:
        return {
            "label": row["term"],
            "status": "met" if row["kind"] != "not_found" else "missing",
            "detail": row["kind_label"],
        }

    return {
        "technical_skills": [as_req(r) for r in tech],
        "education": education_items,
        "experience": experience_items,
        "certifications": cert_items,
        "tools": [as_req(r) for r in tools],
        "other": [as_req(r) for r in other],
        "years_required": years,
        "education_required": education["label"] if education else None,
    }
