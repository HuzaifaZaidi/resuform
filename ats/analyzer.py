"""Deterministic Resuform ATS scorer. No LLM, no external AI APIs."""

from __future__ import annotations

from ats.matcher import match_jd_skills, match_title, token_overlap
from ats.requirements import requirements_from_jd
from ats.textutil import SECTION_HEADINGS, has_phrase, normalize, significant_tokens

WEIGHTS = {
    "keyword_match": 30,
    "technical_skills": 25,
    "requirements": 20,
    "experience_relevance": 15,
    "section_completeness": 5,
    "formatting": 5,
}

DISCLAIMER = (
    "This is a Resuform ATS Score: an estimate from Resuform's own keyword and structure analysis. "
    "It is not a score from a company's applicant tracking system, and it does not guarantee that a resume will pass any ATS."
)


def _pct(found: float, total: float, empty: float = 70) -> int:
    if total <= 0:
        return int(round(empty))
    return int(round(100 * max(0.0, min(1.0, found / total))))


def _match_credit(kind: str) -> float:
    return {"exact": 1.0, "alias": 1.0, "fuzzy": 0.85}.get(kind, 0.0)


def score_keywords(rows: list[dict]) -> int:
    if not rows:
        return 55
    return _pct(sum(_match_credit(r["kind"]) for r in rows), len(rows))


def score_technical(rows: list[dict]) -> int:
    tech = [r for r in rows if r["technical"]]
    if not tech:
        return score_keywords(rows)
    return _pct(sum(_match_credit(r["kind"]) for r in tech), len(tech))


def score_requirements(req: dict, skill_rows: list[dict]) -> int:
    items = []
    for key in ("education", "experience", "certifications"):
        items.extend(req.get(key) or [])
    must = [r for r in skill_rows if r["technical"]]
    credits = []
    for item in items:
        credits.append(1.0 if item["status"] == "met" else 0.0)
    if must:
        credits.append(sum(_match_credit(r["kind"]) for r in must) / len(must))
    if not credits:
        return score_keywords(skill_rows)
    return int(round(100 * (sum(credits) / len(credits))))


def score_experience(title: dict, jd_text: str, resume_text: str, structured: dict | None) -> int:
    overlap = token_overlap(jd_text, resume_text)
    title_score = (title.get("score") or 50) / 100
    experience_blob = ""
    if structured:
        experience_blob = " ".join(structured.get("experience_text") or [])
    focus = experience_blob or resume_text
    exp_overlap = token_overlap(jd_text, focus)
    value = 0.45 * title_score + 0.35 * overlap + 0.20 * exp_overlap
    return int(round(100 * max(0.0, min(1.0, value))))


def _section_flags(resume_text: str, structured: dict | None) -> dict[str, bool]:
    flags = {}
    if structured:
        flags = {
            "contact": bool(structured.get("has_contact")),
            "summary": bool(structured.get("has_summary")),
            "education": bool(structured.get("has_education")),
            "experience": bool(structured.get("has_experience")),
            "internships": bool(structured.get("has_internships")),
            "projects": bool(structured.get("has_projects")),
            "skills": bool(structured.get("has_skills")),
            "certifications": bool(structured.get("has_certifications")),
            "responsibilities": bool(structured.get("has_responsibilities")),
            "extracurricular": bool(structured.get("has_extracurricular")),
        }
    hay = normalize(resume_text)
    email = bool(structured and structured.get("has_contact")) or ("@" in (resume_text or "") and "." in (resume_text or ""))
    flags["contact"] = flags.get("contact") or email
    for key, needles in SECTION_HEADINGS.items():
        if flags.get(key):
            continue
        flags[key] = any(has_phrase(hay, n) for n in needles)
    if not flags.get("experience"):
        flags["experience"] = bool(re_year_span(resume_text))
    return flags


def re_year_span(text: str) -> bool:
    import re

    return bool(re.search(r"20\d{2}\s*[-–—]\s*(20\d{2}|present|now|current)", text or "", re.I))


def score_structure(jd_text: str, resume_text: str, structured: dict | None) -> tuple[int, list[dict]]:
    flags = _section_flags(resume_text, structured)
    jd = normalize(jd_text)
    wanted = [
        ("contact", "Contact Information", True),
        ("summary", "Summary/Profile", False),
        ("education", "Education", "education" in jd or "degree" in jd or "bachelor" in jd or "master" in jd),
        ("experience", "Experience", True),
        ("internships", "Internships", "intern" in jd),
        ("projects", "Projects", "project" in jd or any(k in jd for k in ("github", "portfolio", "build"))),
        ("skills", "Skills", True),
        ("certifications", "Certifications", "certif" in jd),
        ("responsibilities", "Positions of Responsibility", "leadership" in jd or "responsibility" in jd),
        ("extracurricular", "Extra Curricular", False),
    ]
    rows = []
    credits = []
    for key, label, required in wanted:
        present = bool(flags.get(key))
        rows.append({"id": key, "label": label, "present": present, "emphasized": bool(required)})
        if required is True:
            credits.append(1.0 if present else 0.0)
        elif required:
            credits.append(1.0 if present else 0.35)
        else:
            credits.append(1.0 if present else 0.75)
    score = int(round(100 * (sum(credits) / len(credits)))) if credits else 80
    return score, rows


def score_formatting(source: str, resume_text: str, pdf_meta: dict | None, structured: dict | None) -> tuple[int, list[dict]]:
    checks = []
    scores = []
    text = resume_text or ""
    chars = len(text.strip())
    extractable = chars >= 80
    checks.append(
        {
            "id": "extractable_text",
            "ok": extractable,
            "detail": "Resume text is readable for keyword scanning." if extractable else "Very little text was available to scan.",
        }
    )
    scores.append(100 if extractable else 20)

    empty = chars < 80
    checks.append({"id": "empty", "ok": not empty, "detail": "The resume is not empty." if not empty else "The resume appears empty."})
    scores.append(100 if not empty else 0)

    pages = (pdf_meta or {}).get("page_count")
    if source == "pdf" and pages:
        ok = 1 <= pages <= 3
        checks.append(
            {
                "id": "page_count",
                "ok": ok,
                "detail": f"{pages} page(s). Most ATS reviews prefer 1–2 pages." if pages else "Page count unknown.",
            }
        )
        scores.append(100 if pages <= 2 else 80 if pages == 3 else 45)
        expected = max(400, pages * 350)
        density_ok = chars >= expected
        checks.append(
            {
                "id": "text_density",
                "ok": density_ok,
                "detail": "Text density looks like a text-based PDF." if density_ok else "Unusually little text for the page count. The file may be image-heavy.",
            }
        )
        scores.append(100 if density_ok else 55)
    else:
        checks.append(
            {
                "id": "page_count",
                "ok": True,
                "detail": "Library resumes are generated as text-based LaTeX/PDF output, which is generally ATS-friendly.",
            }
        )
        scores.append(96)

    contact_ok = bool(structured and structured.get("has_contact")) or ("@" in text)
    checks.append(
        {
            "id": "contact",
            "ok": contact_ok,
            "detail": "Contact information appears to be present." if contact_ok else "No email/phone pattern was found.",
        }
    )
    scores.append(100 if contact_ok else 60)

    unusual = sum(1 for ch in text if ord(ch) > 127 and ch not in "–—’‘“”éèáàöüñç")
    unusual_ok = unusual < max(12, len(text) * 0.02)
    checks.append(
        {
            "id": "characters",
            "ok": unusual_ok,
            "detail": "Character set looks standard." if unusual_ok else "Many unusual characters were found, which can confuse some parsers.",
        }
    )
    scores.append(100 if unusual_ok else 70)

    headings_ok = sum(1 for needles in SECTION_HEADINGS.values() if any(has_phrase(normalize(text), n) for n in needles[:1])) >= 3
    if structured:
        headings_ok = True
    checks.append(
        {
            "id": "headings",
            "ok": headings_ok,
            "detail": "Standard section headings were detected." if headings_ok else "Few standard section headings were detected.",
        }
    )
    scores.append(100 if headings_ok else 72)

    score = int(round(sum(scores) / len(scores))) if scores else 80
    if source == "library":
        score = max(score, 90)
    return score, checks


def analyze(
    resume_text: str,
    jd_text: str,
    source: str = "library",
    structured: dict | None = None,
    pdf_meta: dict | None = None,
) -> dict:
    resume_text = (resume_text or "").strip()
    jd_text = (jd_text or "").strip()
    if not resume_text:
        raise ValueError("Add a resume from the library or upload a PDF.")
    if not jd_text:
        raise ValueError("Paste a job description before analyzing.")
    if len(resume_text) > 120_000:
        resume_text = resume_text[:120_000]
    if len(jd_text) > 80_000:
        jd_text = jd_text[:80_000]

    if structured:
        extra = " ".join(
            [
                structured.get("headline") or "",
                structured.get("skills_text") or "",
                " ".join(structured.get("experience_text") or []),
            ]
        )
        scan_text = f"{resume_text}\n{extra}"
    else:
        scan_text = resume_text

    skill_rows = match_jd_skills(jd_text, scan_text)
    req = requirements_from_jd(jd_text, scan_text, skill_rows)
    title = match_title(jd_text, (structured or {}).get("headline") or "", scan_text)
    keyword = score_keywords(skill_rows)
    technical = score_technical(skill_rows)
    requirements = score_requirements(req, skill_rows)
    experience = score_experience(title, jd_text, scan_text, structured)
    structure_score, structure_rows = score_structure(jd_text, scan_text, structured)
    formatting_score, format_checks = score_formatting(source, resume_text, pdf_meta, structured)

    parts = {
        "keyword_match": keyword,
        "technical_skills": technical,
        "requirements": requirements,
        "experience_relevance": experience,
        "section_completeness": structure_score,
        "formatting": formatting_score,
    }
    overall = int(round(sum(parts[k] * WEIGHTS[k] for k in WEIGHTS) / 100))
    overall = max(0, min(100, overall))

    matched = [r for r in skill_rows if r["kind"] != "not_found" and r["technical"]]
    missing = [r for r in skill_rows if r["kind"] == "not_found" and r["technical"]]
    # Prefer missing technical terms; cap lists
    matched = matched[:24]
    missing = missing[:18]

    return {
        "score": overall,
        "label": "Resuform ATS Score",
        "disclaimer": DISCLAIMER,
        "warning": "Only add a skill or keyword if you genuinely have the required experience.",
        "breakdown": {
            "keyword_match": {"label": "Keyword Match", "score": keyword, "weight": WEIGHTS["keyword_match"]},
            "technical_skills": {"label": "Technical Skills", "score": technical, "weight": WEIGHTS["technical_skills"]},
            "requirements": {"label": "Requirements", "score": requirements, "weight": WEIGHTS["requirements"]},
            "experience_relevance": {"label": "Experience Relevance", "score": experience, "weight": WEIGHTS["experience_relevance"]},
            "section_completeness": {"label": "Resume Structure", "score": structure_score, "weight": WEIGHTS["section_completeness"]},
            "formatting": {"label": "Formatting", "score": formatting_score, "weight": WEIGHTS["formatting"]},
        },
        "matched": [{"term": r["term"], "kind": r["kind_label"], "category": r["category"]} for r in matched],
        "missing": [{"term": r["term"], "kind": r["kind_label"], "category": r["category"]} for r in missing],
        "skill_rows": [
            {"term": r["term"], "kind": r["kind_label"], "category": r["category"], "technical": r["technical"]}
            for r in skill_rows
            if r["technical"] or r["category"] == "cert"
        ][:40],
        "requirements": {
            "technical_skills": req["technical_skills"][:20],
            "education": req["education"],
            "experience": req["experience"],
            "certifications": req["certifications"],
            "tools": req["tools"][:16],
            "other": req["other"][:12],
        },
        "title": {"wanted": title.get("wanted"), "matched": title.get("matched"), "detail": title.get("detail")},
        "structure": {"sections": structure_rows},
        "formatting": {"source": source, "checks": format_checks, "page_count": (pdf_meta or {}).get("page_count")},
    }
