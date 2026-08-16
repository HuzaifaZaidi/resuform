"""PDF text extraction with PyMuPDF. No OCR."""

from __future__ import annotations

import re

MIN_TEXT_CHARS = 80


class PdfExtractError(ValueError):
    pass


def extract_pdf(data: bytes) -> dict:
    if not data:
        raise PdfExtractError("Unable to extract text from this PDF. Please upload a text-based PDF.")
    try:
        import fitz
    except ImportError as exc:
        raise PdfExtractError("PDF analysis is unavailable because PyMuPDF is not installed.") from exc
    try:
        doc = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise PdfExtractError("Unable to extract text from this PDF. Please upload a text-based PDF.") from exc
    try:
        page_count = doc.page_count
        chunks = [page.get_text("text") or "" for page in doc]
        text = "\n".join(chunks)
    finally:
        doc.close()
    cleaned = re.sub(r"[ \t]+\n", "\n", text)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
    if len(re.sub(r"\s+", "", cleaned)) < MIN_TEXT_CHARS:
        raise PdfExtractError("Unable to extract text from this PDF. Please upload a text-based PDF.")
    return {
        "text": cleaned,
        "page_count": page_count,
        "char_count": len(cleaned),
    }
