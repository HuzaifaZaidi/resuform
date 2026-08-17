"""PDF text extraction with PyMuPDF. No OCR."""

from __future__ import annotations

import re

MIN_TEXT_CHARS = 80


class PdfExtractError(ValueError):
    pass


def _usable_len(text: str) -> int:
    return len(re.findall(r"[0-9A-Za-z]", text or ""))


def _clean_text(text: str) -> str:
    cleaned = (text or "").replace("\x00", "")
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _text_flags(fitz) -> int:
    flags = 0
    for name in (
        "TEXT_PRESERVE_WHITESPACE",
        "TEXT_PRESERVE_LIGATURES",
        "TEXT_DEHYPHENATE",
        "TEXT_CID_FOR_UNKNOWN_UNICODE",
    ):
        flags |= int(getattr(fitz, name, 0) or 0)
    clip = int(getattr(fitz, "TEXT_MEDIABOX_CLIP", 0) or 0)
    if clip:
        flags &= ~clip
    return flags


def _from_blocks(page) -> str:
    blocks = page.get_text("blocks") or []
    lines = []
    for block in blocks:
        if isinstance(block, (list, tuple)) and len(block) >= 5 and isinstance(block[4], str):
            lines.append(block[4])
    return "\n".join(lines)


def _from_words(page) -> str:
    words = page.get_text("words") or []
    parts = []
    last_y = None
    for word in words:
        if not isinstance(word, (list, tuple)) or len(word) < 5:
            continue
        token = str(word[4] or "")
        if not token:
            continue
        y = round(float(word[1]), 1) if len(word) > 1 else 0
        if last_y is not None and abs(y - last_y) > 2:
            parts.append("\n")
        elif parts and not parts[-1].endswith("\n"):
            parts.append(" ")
        parts.append(token)
        last_y = y
    return "".join(parts)


def _from_dict(page, mode: str = "dict") -> str:
    data = page.get_text(mode) or {}
    lines_out = []
    for block in data.get("blocks", []):
        if not isinstance(block, dict):
            continue
        for line in block.get("lines", []) or []:
            spans = []
            for span in line.get("spans", []) or []:
                piece = span.get("text") or ""
                if not piece and mode == "rawdict":
                    piece = "".join(str(ch.get("c") or "") for ch in span.get("chars") or [])
                if piece:
                    spans.append(piece)
            if spans:
                lines_out.append("".join(spans))
    return "\n".join(lines_out)


def _from_trace(page) -> str:
    if not hasattr(page, "get_texttrace"):
        return ""
    parts = []
    for item in page.get_texttrace() or []:
        if not isinstance(item, dict):
            continue
        piece = item.get("text") or ""
        if not piece:
            chars = item.get("chars") or []
            if chars and isinstance(chars[0], dict):
                piece = "".join(str(ch.get("c") or ch.get("unicode") or "") for ch in chars)
            elif chars:
                piece = "".join(str(ch) for ch in chars if isinstance(ch, str))
        if piece:
            parts.append(piece)
    return " ".join(parts)


def _from_widgets(page) -> str:
    if not hasattr(page, "widgets"):
        return ""
    values = []
    for widget in page.widgets() or []:
        for attr in ("field_value", "text", "field_name"):
            value = getattr(widget, attr, None)
            if value:
                values.append(str(value))
    return "\n".join(values)


def _from_annots(page) -> str:
    if not hasattr(page, "annots"):
        return ""
    values = []
    for annot in page.annots() or []:
        info = annot.info or {}
        for key in ("content", "title"):
            if info.get(key):
                values.append(str(info[key]))
    return "\n".join(values)


def _page_candidates(page, fitz) -> list[str]:
    flags = _text_flags(fitz)
    methods = [
        lambda: page.get_text("text") or "",
        lambda: page.get_text("text", sort=True) or "",
        lambda: page.get_text("text", flags=flags) if flags else "",
        lambda: _from_blocks(page),
        lambda: _from_words(page),
        lambda: _from_dict(page),
        lambda: _from_dict(page, "rawdict"),
        lambda: _from_trace(page),
        lambda: _from_widgets(page),
        lambda: _from_annots(page),
    ]
    found = []
    for method in methods:
        try:
            text = method() or ""
        except Exception:
            continue
        if _usable_len(text) >= 8:
            found.append(text)
    return found


def _best_page_text(page, fitz) -> str:
    best = ""
    best_n = 0
    for text in _page_candidates(page, fitz):
        n = _usable_len(text)
        if n > best_n:
            best = text
            best_n = n
    if best_n >= 8:
        return best
    try:
        page.clean_contents()
    except Exception:
        return best
    for text in _page_candidates(page, fitz):
        n = _usable_len(text)
        if n > best_n:
            best = text
            best_n = n
    return best


def _page_has_images(page) -> bool:
    try:
        return bool(page.get_images())
    except Exception:
        return False


def _open_pdf(fitz, data: bytes):
    try:
        return fitz.open(stream=data, filetype="pdf")
    except Exception:
        return fitz.open(stream=data)


def extract_pdf(data: bytes) -> dict:
    if not data:
        raise PdfExtractError("Unable to extract text from this PDF. Please upload a text-based PDF.")
    header = data.lstrip()[:8]
    if not header.startswith(b"%PDF"):
        raise PdfExtractError("That file does not look like a PDF. Please upload a .pdf export, not a screenshot or Word file.")
    try:
        import fitz
    except ImportError:
        try:
            import pymupdf as fitz
        except ImportError as exc:
            raise PdfExtractError("PDF analysis is unavailable because PyMuPDF is not installed.") from exc
    try:
        doc = _open_pdf(fitz, data)
    except Exception as exc:
        raise PdfExtractError("Unable to open this PDF. Try exporting it again as a PDF from Word or Google Docs.") from exc
    try:
        if getattr(doc, "needs_pass", False) or getattr(doc, "is_encrypted", False):
            unlocked = False
            try:
                unlocked = bool(doc.authenticate(""))
            except Exception:
                unlocked = False
            if not unlocked and (getattr(doc, "needs_pass", False) or getattr(doc, "is_encrypted", False)):
                raise PdfExtractError("This PDF is password-protected. Upload an unlocked copy.")
        page_count = doc.page_count
        chunks = []
        saw_image = False
        for page in doc:
            try:
                chunks.append(_best_page_text(page, fitz))
            except Exception:
                chunks.append("")
            if _page_has_images(page):
                saw_image = True
        image_only = saw_image and _usable_len("\n".join(chunks)) < MIN_TEXT_CHARS
    finally:
        doc.close()
    cleaned = _clean_text("\n".join(chunks))
    if _usable_len(cleaned) < MIN_TEXT_CHARS:
        if image_only:
            raise PdfExtractError(
                "This PDF looks like a scanned or image-only file, so no selectable text was found. "
                "Export it from Word, Google Docs, or Overleaf as a text-based PDF, or choose the resume from your ResuForm library."
            )
        raise PdfExtractError("Unable to extract text from this PDF. Please upload a text-based PDF.")
    return {
        "text": cleaned,
        "page_count": page_count,
        "char_count": len(cleaned),
    }
