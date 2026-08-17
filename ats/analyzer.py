"""Deterministic Resuform ATS scorer. No LLM, no external AI APIs."""

from __future__ import annotations

from ats.experience import extract_required_years, summarize_experience
from ats.matcher import match_jd_skills, match_title, token_overlap
from ats.requirements import extract_education, resume_degree_level
from ats.textutil import SECTION_HEADINGS, has_phrase, normalize
from ats.weights import LABELS, WEIGHTS

DISCLAIMER = (
    "This is a Resuform ATS Score: an estimate from Resuform's own keyword and structure analysis. "
    "It is not a score from a company's applicant tracking system, and it does not guarantee that a resume will pass any ATS."
)


def _match_credit(kind: str) -> float:
    return {"exact": 1.0, "alias": 1.0, "fuzzy": 0.8, "evidence": 1.0, "satisfied": 1.0}.get(kind, 0.0)


def _coverage(rows: list[dict], empty: int = 100) -> int:
    if not rows:
        return empty
    return int(round(100 * sum(_match_credit(r["kind"]) for r in rows) / len(rows)))


def _education_evidence(structured: dict | None, resume_text: str) -> str:
    if structured:
        items = structured.get("education") or []
        for item in items:
            degree = str(item.get("degree") or "").strip()
            if degree:
                return degree[:80]
    hay = normalize(resume_text)
    for needle, label in (
        ("phd", "PhD"),
        ("m.s", "M.S."),
        ("m tech", "M.Tech"),
        ("master", "Master's"),
        ("b.tech", "B.Tech"),
        ("bachelor", "Bachelor's"),
    ):
        if has_phrase(hay, needle):
            return label
    return "Found on resume"


def score_education(jd_text: str, resume_text: str, structured: dict | None) -> tuple[int, dict | None]:
    wanted = extract_education(jd_text)
    if not wanted:
        return 100, None
    level = resume_degree_level(resume_text)
    met = level >= int(wanted["min_rank"])
    or_group = wanted.get("operator") == "OR"
    if met:
        kind = "satisfied" if or_group else "exact"
        kind_label = "Satisfied" if or_group else "Matched"
    else:
        kind = "not_found"
        kind_label = "Not Found"
    return (
        100 if met else 0,
        {
            "term": wanted["label"],
            "category": "Education",
            "category_label": "Education",
            "importance": "required",
            "importance_label": "Required",
            "kind": kind,
            "kind_label": kind_label,
            "evidence": _education_evidence(structured, resume_text) if met else "No matching degree language was found",
            "status": "met" if met else "missing",
        },
    )


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
    flags["contact"] = flags.get("contact") or ("@" in (resume_text or "") and "." in (resume_text or ""))
    for key, needles in SECTION_HEADINGS.items():
        if flags.get(key):
            continue
        flags[key] = any(has_phrase(hay, n) for n in needles)
    return flags


def score_structure(jd_text: str, resume_text: str, structured: dict | None) -> tuple[int, list[dict]]:
    flags = _section_flags(resume_text, structured)
    jd = normalize(jd_text)
    wanted = [
        ("contact", "Contact Information", True),
        ("summary", "Summary/Profile", False),
        ("education", "Education", "education" in jd or "degree" in jd or "bachelor" in jd or "master" in jd),
        ("experience", "Experience", True),
        ("internships", "Internships", "intern" in jd),
        ("projects", "Projects", "project" in jd),
        ("skills", "Skills", True),
        ("certifications", "Certifications", False),
        ("responsibilities", "Positions of Responsibility", False),
        ("extracurricular", "Extra Curricular", False),
    ]
    rows = []
    credits = []
    for key, label, required in wanted:
        present = bool(flags.get(key))
        optional = required is not True
        if required is True:
            optional = False
        elif required:
            optional = False
        else:
            optional = True
        display = "Present" if present else ("Optional — Not provided" if optional else "Not found")
        rows.append(
            {
                "id": key,
                "label": label,
                "present": present,
                "optional": optional,
                "emphasized": not optional,
                "display": display,
            }
        )
        if optional:
            continue
        credits.append(1.0 if present else 0.0)
    score = int(round(100 * (sum(credits) / len(credits)))) if credits else 100
    return score, rows


def score_extractability(source: str, resume_text: str, pdf_meta: dict | None, structured: dict | None) -> tuple[int, list[dict]]:
    text = resume_text or ""
    chars = len(text.strip())
    checks = []

    def add(key, label, score, detail):
        checks.append({"id": key, "label": label, "score": int(score), "ok": score >= 80, "detail": detail})

    extractable = 100 if chars >= 120 else 40 if chars >= 80 else 10
    add("text_extraction", "Text extraction", extractable, "Text is extractable." if extractable >= 80 else "Very little extractable text.")
    empty = 100 if chars >= 80 else 0
    add("empty", "Not empty", empty, "The resume is not empty." if empty else "The resume appears empty.")

    pages = (pdf_meta or {}).get("page_count")
    if source == "pdf" and pages:
        page_score = 100 if pages <= 2 else 82 if pages == 3 else 50
        add("page_count", "Page count", page_score, f"{pages} page(s). Most ATS reviews prefer 1–2 pages.")
        expected = max(500, pages * 400)
        density = 100 if chars >= expected else 55
        add("text_density", "Text density", density, "Text density looks like a text-based PDF." if density >= 80 else "Unusually little text for the page count. The file may be image-heavy.")
        reading = 78 if density >= 80 else 55
        add("reading_order", "Reading order", reading, "Reading order inferred from extracted PDF text; not guaranteed for every ATS.")
    else:
        add("page_count", "Page count", 90, "Library resumes are generated as text-based LaTeX, which is generally ATS-friendly.")
        add("text_density", "Text density", 92, "Structured Resuform text was used directly (not re-extracted from a PDF).")
        add("reading_order", "Reading order", 90, "Field order from the Resuform document is used; this is not a guarantee for every ATS.")

    contact = 100 if (structured and structured.get("has_contact")) or ("@" in text) else 45
    add("contact", "Contact information", contact, "Contact information appears to be present." if contact >= 80 else "No email/phone pattern was found.")

    unusual = sum(1 for ch in text if ord(ch) > 127 and ch not in "–—’‘“”éèáàöüñç")
    char_score = 96 if unusual < max(8, len(text) * 0.012) else 70
    add("characters", "Character quality", char_score, "Character set looks standard." if char_score >= 90 else "Many unusual characters were found.")

    heading_hits = sum(1 for needles in SECTION_HEADINGS.values() if any(has_phrase(normalize(text), n) for n in needles[:1]))
    if structured:
        heading_score = 94
    else:
        heading_score = 100 if heading_hits >= 4 else 78 if heading_hits >= 3 else 55
    add("headings", "Standard headings", heading_score, "Standard section headings were detected." if heading_score >= 80 else "Few standard section headings were detected.")

    score = int(round(sum(item["score"] for item in checks) / len(checks)))
    return max(0, min(100, score)), checks


def score_experience_block(title: dict, jd_text: str, resume_text: str, structured: dict | None, exp: dict) -> int:
    overlap = token_overlap(jd_text, resume_text)
    title_score = (title.get("score") or 50) / 100
    focus = " ".join(structured.get("experience_text") or []) if structured else resume_text
    exp_overlap = token_overlap(jd_text, focus or resume_text)
    years_needed = extract_required_years(jd_text)
    years_part = 0.7
    if years_needed and exp.get("reliable") and exp.get("full_time_years") is not None:
        years_part = 1.0 if exp["full_time_years"] >= years_needed else max(0.2, exp["full_time_years"] / years_needed)
    elif years_needed and not exp.get("reliable"):
        years_part = 0.65
    value = 0.35 * title_score + 0.25 * overlap + 0.20 * exp_overlap + 0.20 * years_part
    return int(round(100 * max(0.0, min(1.0, value))))


def _strengths(required_score, education_score, experience_score, structure_score, extract_score, exp, edu_row, has_projects):
    out = []
    if required_score >= 85:
        out.append("Strong coverage of required technical skills")
    if education_score >= 100 and edu_row:
        out.append("Relevant education")
    if experience_score >= 80 and exp.get("reliable"):
        out.append("Relevant experience")
    if has_projects:
        out.append("Project evidence is present")
    if structure_score >= 85:
        out.append("Standard resume structure")
    if extract_score >= 85:
        out.append("ATS-readable text")
    return out


def _improvements(gaps: list[dict]) -> list[str]:
    lines = []
    seen = set()
    for gap in gaps:
        term = gap["term"]
        if term in seen:
            continue
        seen.add(term)
        if gap.get("importance") == "required":
            lines.append(f"If you genuinely have experience with {term}, add it — it is listed as required.")
        else:
            lines.append(f"If applicable, mention {term} only if you have actually used it.")
        if len(lines) >= 6:
            break
    if not lines:
        lines.append("If you have additional relevant experience, add it only when it is genuine.")
    return lines


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
    resume_text = resume_text[:120_000]
    jd_text = jd_text[:80_000]
    structured = structured if isinstance(structured, dict) else None

    extra = ""
    if structured:
        extra = " ".join(
            [
                str(structured.get("headline") or ""),
                str(structured.get("skills_text") or ""),
                " ".join(structured.get("experience_text") or []),
            ]
        )
    scan_text = f"{resume_text}\n{extra}".strip()

    skill_rows = match_jd_skills(jd_text, scan_text, structured)
    tech_rows = [r for r in skill_rows if r["technical"]]
    required_rows = [r for r in tech_rows if r["importance"] == "required"]
    preferred_rows = [r for r in tech_rows if r["importance"] == "preferred"]
    unclassified_rows = [r for r in tech_rows if r["importance"] == "unclassified"]
    if not required_rows:
        required_rows = unclassified_rows

    title = match_title(jd_text, (structured or {}).get("headline") or "", scan_text)
    exp = summarize_experience((structured or {}).get("roles") if structured else None, resume_text)
    years_needed = extract_required_years(jd_text)
    exp["required_years"] = years_needed
    if years_needed and not exp.get("reliable"):
        exp["detail"] = "Experience duration could not be reliably determined."

    education_score, education_row = score_education(jd_text, scan_text, structured)
    required_score = _coverage(required_rows, empty=100)
    preferred_score = _coverage(preferred_rows, empty=100)
    keyword_score = _coverage(tech_rows, empty=60)
    if tech_rows:
        keyword_score = int(round(0.7 * keyword_score + 0.3 * 100 * token_overlap(jd_text, scan_text)))
    experience_score = score_experience_block(title, jd_text, scan_text, structured, exp)
    structure_score, structure_rows = score_structure(jd_text, scan_text, structured)
    extract_score, extract_checks = score_extractability(source, resume_text, pdf_meta, structured)

    parts = {
        "required": required_score,
        "preferred": preferred_score,
        "experience_relevance": experience_score,
        "keyword_relevance": keyword_score,
        "education": education_score,
        "structure": structure_score,
        "extractability": extract_score,
    }
    overall = int(round(sum(parts[k] * WEIGHTS[k] for k in WEIGHTS) / 100))
    overall = max(0, min(100, overall))

    strong = [r for r in required_rows if r["kind"] != "not_found"] + [
        r for r in preferred_rows if r["kind"] != "not_found" and r not in required_rows
    ]
    if len(strong) < 8:
        strong += [r for r in tech_rows if r["kind"] != "not_found" and r not in strong]
    strong = strong[:16]
    gaps = [r for r in required_rows if r["kind"] == "not_found"] + [r for r in preferred_rows if r["kind"] == "not_found"]

    req_table = []
    for row in skill_rows:
        if row["importance"] == "optional":
            continue
        req_table.append(
            {
                "term": row["term"],
                "category": row["category_label"],
                "importance": row["importance_label"],
                "match_type": row["kind_label"],
                "evidence": row["evidence"],
                "kind": row["kind"],
                "importance_key": row["importance"],
            }
        )
    if education_row:
        req_table.insert(
            0,
            {
                "term": education_row["term"],
                "category": "Education",
                "importance": education_row["importance_label"],
                "match_type": education_row["kind_label"],
                "evidence": education_row["evidence"],
                "kind": education_row["kind"],
                "importance_key": "required",
            },
        )
    if years_needed:
        if exp.get("reliable") and exp.get("full_time_years") is not None:
            met = exp["full_time_years"] >= years_needed
            evidence = exp["detail"]
            kind_label = "Matched" if met else "Not Found"
            kind = "exact" if met else "not_found"
        else:
            met = None
            evidence = "Experience duration could not be reliably determined"
            kind_label = "Unclassified"
            kind = "unclassified"
        req_table.append(
            {
                "term": f"{years_needed}+ years of experience",
                "category": "Experience",
                "importance": "Required",
                "match_type": kind_label,
                "evidence": evidence,
                "kind": kind,
                "importance_key": "required",
            }
        )

    has_projects = bool(structured and structured.get("has_projects")) or has_phrase(normalize(resume_text), "project")
    strengths = _strengths(required_score, education_score, experience_score, structure_score, extract_score, exp, education_row, has_projects)
    improvements = _improvements(gaps)

    def slim(rows):
        return [
            {
                "term": r["term"],
                "kind": r["kind_label"],
                "category": r["category_label"],
                "importance": r["importance_label"],
                "evidence": r["evidence"],
            }
            for r in rows
        ]

    return {
        "score": overall,
        "label": "Resuform ATS Score",
        "disclaimer": DISCLAIMER,
        "warning": "Only add a skill or keyword if you genuinely have the required experience.",
        "breakdown": {
            key: {"label": LABELS[key], "score": parts[key], "weight": WEIGHTS[key]}
            for key in WEIGHTS
        },
        "strong_matches": slim(strong),
        "important_gaps": slim(gaps)[:12],
        "matched": slim([r for r in tech_rows if r["kind"] != "not_found"])[:24],
        "missing": slim(gaps),
        "skill_rows": [
            {
                "term": r["term"],
                "kind": r["kind_label"],
                "category": r["category_label"],
                "importance": r["importance_label"],
                "evidence": r["evidence"],
            }
            for r in skill_rows
            if r["technical"] or r["category"] == "soft"
        ][:50],
        "requirements_table": req_table[:40],
        "requirements": {
            "technical_skills": [
                {"label": r["term"], "status": "met" if r["kind"] != "not_found" else "missing", "detail": r["kind_label"], "importance": r["importance_label"]}
                for r in required_rows
            ][:20],
            "education": [education_row] if education_row else [],
            "experience": [
                {
                    "label": f"{years_needed}+ years of experience" if years_needed else "Experience",
                    "status": "met" if exp.get("reliable") and years_needed and exp.get("full_time_years", 0) >= years_needed else "missing",
                    "detail": exp.get("detail"),
                }
            ]
            if years_needed
            else [],
            "certifications": [],
            "tools": [
                {"label": r["term"], "status": "met" if r["kind"] != "not_found" else "missing", "detail": r["kind_label"], "importance": r["importance_label"]}
                for r in preferred_rows
            ][:16],
            "other": [
                {"label": r["term"], "status": "met" if r["kind"] != "not_found" else "missing", "detail": r["kind_label"]}
                for r in skill_rows
                if r["category"] == "soft"
            ][:8],
        },
        "title": {"wanted": title.get("wanted"), "matched": title.get("matched"), "detail": title.get("detail")},
        "experience": exp,
        "structure": {"sections": structure_rows},
        "extractability": {"source": source, "score": extract_score, "checks": extract_checks, "page_count": (pdf_meta or {}).get("page_count")},
        "formatting": {"source": source, "score": extract_score, "checks": extract_checks, "page_count": (pdf_meta or {}).get("page_count")},
        "strengths": strengths,
        "improvements": improvements,
    }
