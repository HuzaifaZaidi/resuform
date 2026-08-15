"""Shared LaTeX compile helpers used by the stdlib server and the Flask app."""

from __future__ import annotations

import secrets
import shutil
import subprocess
import tempfile
import threading
import urllib.error
import urllib.request
from pathlib import Path

TEXLIVE = "https://texlive.net/cgi-bin/latexcgi"
PDF_CACHE = {"bytes": b"", "name": "resume.pdf"}
PDF_LOCK = threading.Lock()


def encode_multipart(fields: list[tuple[str, str | None, str]]) -> tuple[str, bytes]:
    boundary = "----PicaBoundary" + secrets.token_hex(12)
    chunks: list[bytes] = []
    for name, filename, value in fields:
        chunks.append(f"--{boundary}\r\n".encode())
        if filename:
            chunks.append(
                (
                    f'Content-Disposition: form-data; name="{name}"; '
                    f'filename="{filename}"\r\n'
                    "Content-Type: application/x-tex\r\n\r\n"
                ).encode()
            )
        else:
            chunks.append(
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
            )
        chunks.append(value.encode("utf-8") if isinstance(value, str) else value)
        chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode())
    return boundary, b"".join(chunks)


def compile_local(tex: str) -> bytes | None:
    engine = None
    for cmd in ("pdflatex", "tectonic"):
        if shutil.which(cmd):
            engine = cmd
            break
    if not engine:
        return None

    with tempfile.TemporaryDirectory(prefix="pica-") as tmp:
        work = Path(tmp)
        tex_path = work / "document.tex"
        tex_path.write_text(tex, encoding="utf-8")
        if engine == "tectonic":
            proc = subprocess.run(
                ["tectonic", "-o", str(work), str(tex_path)],
                cwd=work,
                capture_output=True,
                timeout=90,
            )
        else:
            proc = subprocess.run(
                [
                    "pdflatex",
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "document.tex",
                ],
                cwd=work,
                capture_output=True,
                timeout=90,
            )
        pdf_path = work / "document.pdf"
        if proc.returncode == 0 and pdf_path.exists():
            return pdf_path.read_bytes()
        log = (proc.stdout or b"") + b"\n" + (proc.stderr or b"")
        raise RuntimeError(log.decode("utf-8", errors="replace")[-8000:])


def compile_texlive(tex: str) -> bytes:
    # The CGI is picky about CRLF in the uploaded source.
    source = tex.replace("\r\n", "\n").replace("\n", "\r\n")
    fields = [
        ("filecontents[]", "document.tex", source),
        ("filename[]", None, "document.tex"),
        ("engine", None, "pdflatex"),
        ("return", None, "pdf"),
    ]
    boundary, body = encode_multipart(fields)
    req = urllib.request.Request(
        TEXLIVE,
        data=body,
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "PicaResume/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = resp.read()
            ctype = resp.headers.get("Content-Type", "")
            url = resp.geturl()
            if "pdf" in ctype.lower() or url.lower().endswith(".pdf"):
                if data[:4] == b"%PDF":
                    return data
            text = data.decode("utf-8", errors="replace")
            raise RuntimeError(text[-8000:] or "TeXLive.net did not return a PDF.")
    except urllib.error.HTTPError as err:
        payload = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(payload[-8000:] or f"HTTP {err.code}") from err


def compile_tex(tex: str) -> bytes:
    try:
        local = compile_local(tex)
        if local:
            return local
    except Exception:
        pass
    return compile_texlive(tex)


def safe_pdf_name(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "-_." else "-" for ch in name)
    return cleaned or "resume.pdf"
