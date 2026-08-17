"""Shared request handling for Flask and the stdlib server."""

from __future__ import annotations

from ats.analyzer import analyze
from ats.pdfextract import PdfExtractError, extract_pdf

MAX_PDF_BYTES = 8 * 1024 * 1024
_STRUCT_KEYS = {
    "headline",
    "skills_text",
    "experience_text",
    "internships_text",
    "projects_text",
    "education_text",
    "roles",
    "education",
    "has_contact",
    "has_summary",
    "has_education",
    "has_experience",
    "has_internships",
    "has_projects",
    "has_skills",
    "has_responsibilities",
    "has_extracurricular",
    "has_certifications",
}


def _clean_structured(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    out = {}
    for key in _STRUCT_KEYS:
        if key not in raw:
            continue
        value = raw[key]
        if key in {"experience_text", "internships_text", "projects_text"} and isinstance(value, list):
            out[key] = [str(item)[:2000] for item in value[:20]]
        elif key == "roles" and isinstance(value, list):
            cleaned = []
            for item in value[:20]:
                if not isinstance(item, dict):
                    continue
                cleaned.append(
                    {
                        "kind": str(item.get("kind") or "experience")[:20],
                        "title": str(item.get("title") or "")[:80],
                        "dates": str(item.get("dates") or "")[:40],
                        "bullets": str(item.get("bullets") or "")[:2000],
                    }
                )
            out[key] = cleaned
        elif key == "education" and isinstance(value, list):
            cleaned = []
            for item in value[:12]:
                if not isinstance(item, dict):
                    continue
                cleaned.append(
                    {
                        "degree": str(item.get("degree") or "")[:80],
                        "dates": str(item.get("dates") or "")[:40],
                    }
                )
            out[key] = cleaned
        elif key in {"headline"}:
            out[key] = str(value)[:120]
        elif key in {"skills_text", "education_text"}:
            out[key] = str(value)[:4000]
        elif isinstance(value, bool):
            out[key] = value
    return out


def run_analysis(
    *,
    resume_text: str = "",
    jd_text: str = "",
    source: str = "library",
    structured: dict | None = None,
    pdf_bytes: bytes | None = None,
) -> dict:
    source = "pdf" if source == "pdf" or pdf_bytes else "library"
    pdf_meta = None
    if pdf_bytes is not None:
        if len(pdf_bytes) > MAX_PDF_BYTES:
            raise ValueError("PDF is too large. Please upload a file under 8 MB.")
        pdf_meta = extract_pdf(pdf_bytes)
        resume_text = pdf_meta["text"]
        structured = None
    result = analyze(
        resume_text=resume_text,
        jd_text=jd_text,
        source=source,
        structured=_clean_structured(structured),
        pdf_meta=pdf_meta,
    )
    # Used by optional browser-side Gemini analysis. Does not affect scoring.
    result["extracted_resume_text"] = resume_text
    return result


__all__ = ["run_analysis", "PdfExtractError", "MAX_PDF_BYTES"]
