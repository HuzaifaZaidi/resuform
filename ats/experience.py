"""Deterministic employment-date parsing. Internships are not full-time."""

from __future__ import annotations

import re
from datetime import date

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

SPAN_RE = re.compile(
    r"(?P<a>(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
    r"aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?\.?\s*"
    r"20\d{2}|20\d{2})\s*[-–—to]+\s*"
    r"(?P<b>present|now|current|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?\.?\s*"
    r"20\d{2}|20\d{2})",
    re.I,
)
YEARS_REQ_RE = re.compile(
    r"(\d+)\s*\+?\s*(?:-\s*\d+\s*)?(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)?",
    re.I,
)


def _parse_point(token: str, *, end: bool) -> date | None:
    raw = (token or "").strip().lower()
    if raw in {"present", "now", "current"}:
        return date.today()
    month = 1 if not end else 12
    m = re.search(
        r"(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
        r"aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)",
        raw,
        re.I,
    )
    y = re.search(r"(20\d{2})", raw)
    if not y:
        return None
    if m:
        month = MONTHS.get(m.group(1)[:3].lower(), month)
    try:
        year = int(y.group(1))
        day = 28 if end else 1
        return date(year, month, min(day, 28))
    except ValueError:
        return None


def parse_span(text: str) -> tuple[date, date] | None:
    match = SPAN_RE.search(text or "")
    if not match:
        return None
    start = _parse_point(match.group("a"), end=False)
    finish = _parse_point(match.group("b"), end=True)
    if not start or not finish or finish < start:
        return None
    return start, finish


def months_between(start: date, finish: date) -> int:
    return max(0, (finish.year - start.year) * 12 + (finish.month - start.month) + 1)


def extract_required_years(jd_text: str) -> int | None:
    years = [int(m.group(1)) for m in YEARS_REQ_RE.finditer(jd_text or "")]
    years = [y for y in years if 1 <= y <= 20]
    return min(years) if years else None


def summarize_experience(roles: list[dict] | None, resume_text: str = "") -> dict:
    parsed = []
    for role in roles or []:
        kind = str(role.get("kind") or "experience")
        span = parse_span(str(role.get("dates") or ""))
        if not span:
            continue
        start, finish = span
        parsed.append(
            {
                "kind": kind,
                "months": months_between(start, finish),
                "title": str(role.get("title") or ""),
            }
        )
    if not parsed:
        for match in SPAN_RE.finditer(resume_text or ""):
            start = _parse_point(match.group("a"), end=False)
            finish = _parse_point(match.group("b"), end=True)
            if not start or not finish or finish < start:
                continue
            nearby = resume_text[max(0, match.start() - 80) : match.end() + 40]
            kind = "internship" if re.search(r"intern", nearby, re.I) else "experience"
            parsed.append({"kind": kind, "months": months_between(start, finish), "title": ""})

    ft_months = sum(item["months"] for item in parsed if item["kind"] != "internship")
    intern_months = sum(item["months"] for item in parsed if item["kind"] == "internship")
    reliable = bool(parsed)
    return {
        "reliable": reliable,
        "full_time_years": round(ft_months / 12, 1) if reliable else None,
        "intern_years": round(intern_months / 12, 1) if intern_months else 0.0,
        "role_count": len(parsed),
        "detail": (
            f"About {round(ft_months / 12, 1)} years of full-time experience"
            + (f" and {round(intern_months / 12, 1)} years of internships" if intern_months else "")
            + "."
            if reliable and ft_months
            else "Experience duration could not be reliably determined."
        ),
    }
