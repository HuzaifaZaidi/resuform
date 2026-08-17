"""ResuForm — local stdlib server: static files + LaTeX compile proxy."""

from __future__ import annotations

import json
import mimetypes
import os
import sys
import urllib.parse
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from gaconfig import inject_index
from texcompile import PDF_CACHE, PDF_LOCK, compile_tex, photo_from_data_url, safe_pdf_name

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PICA_PORT", "8080"))


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    timeout = 120

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def log_error(self, fmt: str, *args) -> None:
        sys.stderr.write("ERROR %s - %s\n" % (self.address_string(), fmt % args))

    def _send(self, code: int, body: bytes, content_type: str, extra: dict | None = None) -> None:
        try:
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "close")
            if extra:
                for key, value in extra.items():
                    self.send_header(key, value)
            self.end_headers()
            self.wfile.write(body)
            self.wfile.flush()
        except ConnectionError:
            pass

    def do_GET(self) -> None:
        try:
            self._handle_get()
        except Exception as exc:
            self.log_error("%s", exc)
            if not self.wfile.closed:
                self._send(500, b"Server error", "text/plain")

    def _handle_get(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/ats/clock":
            body = json.dumps({"current_date": datetime.now(timezone.utc).date().isoformat()}).encode("utf-8")
            self._send(200, body, "application/json")
            return
        if path in ("/api/resume.pdf", "/resume.pdf"):
            with PDF_LOCK:
                pdf = PDF_CACHE["bytes"]
                name = PDF_CACHE["name"]
            if not pdf:
                self._send(404, b"No PDF yet. Click Typeset PDF first.", "text/plain")
                return
            query = urllib.parse.parse_qs(parsed.query)
            disposition = "attachment" if query.get("download") else "inline"
            self._send(
                200,
                pdf,
                "application/pdf",
                {"Content-Disposition": f'{disposition}; filename="{safe_pdf_name(name)}"'},
            )
            return
        if path == "/":
            path = "/index.html"
        if path in ("/ats", "/ats/"):
            path = "/ats.html"
        rel = path.lstrip("/").replace("\\", "/")
        if ".." in Path(rel).parts:
            self._send(400, b"Bad path", "text/plain")
            return
        file_path = ROOT / rel
        if not file_path.is_file():
            self._send(404, b"Not found", "text/plain")
            return
        if rel in ("index.html", "ats.html"):
            html = file_path.read_text(encoding="utf-8")
            try:
                html = inject_index(html)
            except Exception:
                html = html.replace("%%GA_MEASUREMENT_ID%%", "")
            self._send(200, html.encode("utf-8"), "text/html; charset=utf-8")
            return
        ctype = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
        self._send(200, file_path.read_bytes(), ctype)

    def do_POST(self) -> None:
        try:
            self._handle_post()
        except Exception as exc:
            self.log_error("%s", exc)
            if not self.wfile.closed:
                body = json.dumps({"error": str(exc) or "Compile failed."}).encode("utf-8")
                self._send(400, body, "application/json")

    def _handle_post(self) -> None:
        route = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        if route == "/api/ats/analyze":
            self._ats_analyze(raw)
            return
        if route == "/api/ats/extract":
            self._ats_extract(raw)
            return
        if route != "/api/compile":
            self._send(404, b"Not found", "text/plain")
            return
        try:
            payload = json.loads(raw.decode("utf-8"))
            tex = payload.get("tex") or ""
            if not tex.strip():
                raise ValueError("Missing LaTeX source.")
            pdf = compile_tex(tex, photo_from_data_url(payload.get("photo") or ""))
            name = str(payload.get("filename") or "resume.pdf")
            if not name.lower().endswith(".pdf"):
                name += ".pdf"
            with PDF_LOCK:
                PDF_CACHE["bytes"] = pdf
                PDF_CACHE["name"] = name
            self._send(
                200,
                pdf,
                "application/pdf",
                {"Content-Disposition": f'inline; filename="{safe_pdf_name(name)}"'},
            )
        except Exception as exc:
            message = str(exc).strip() or "Compile failed."
            body = json.dumps({"error": message}).encode("utf-8")
            self._send(400, body, "application/json")

    def _ats_analyze(self, raw: bytes) -> None:
        from ats.httpparse import parse_multipart
        from ats.pdfextract import PdfExtractError
        from ats.service import run_analysis

        try:
            ctype = self.headers.get("Content-Type", "")
            if "multipart/form-data" in ctype:
                fields, files = parse_multipart(ctype, raw)
                result = run_analysis(
                    jd_text=fields.get("jd_text") or "",
                    source="pdf",
                    pdf_bytes=files.get("resume"),
                )
            else:
                payload = json.loads(raw.decode("utf-8") or "{}")
                structured = payload.get("structured")
                result = run_analysis(
                    resume_text=str(payload.get("resume_text") or ""),
                    jd_text=str(payload.get("jd_text") or ""),
                    source=str(payload.get("source") or "library"),
                    structured=structured if isinstance(structured, dict) else None,
                )
            body = json.dumps(result).encode("utf-8")
            self._send(200, body, "application/json")
        except (PdfExtractError, ValueError, json.JSONDecodeError) as exc:
            body = json.dumps({"error": str(exc) or "Could not analyze this resume."}).encode("utf-8")
            self._send(400, body, "application/json")
        except Exception:
            body = json.dumps({"error": "Could not analyze this resume."}).encode("utf-8")
            self._send(500, body, "application/json")

    def _ats_extract(self, raw: bytes) -> None:
        from ats.httpparse import parse_multipart
        from ats.pdfextract import PdfExtractError, extract_pdf
        from ats.service import MAX_PDF_BYTES

        try:
            ctype = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in ctype:
                raise ValueError("Choose a PDF first.")
            _fields, files = parse_multipart(ctype, raw)
            data = files.get("resume") or b""
            if not data:
                raise ValueError("Choose a PDF first.")
            if len(data) > MAX_PDF_BYTES:
                raise ValueError("PDF is too large. Please upload a file under 8 MB.")
            meta = extract_pdf(data)
            body = json.dumps({"text": meta.get("text") or ""}).encode("utf-8")
            self._send(200, body, "application/json")
        except (PdfExtractError, ValueError) as exc:
            body = json.dumps({"error": str(exc) or "Could not read this PDF."}).encode("utf-8")
            self._send(400, body, "application/json")
        except Exception:
            body = json.dumps({"error": "Could not read this PDF."}).encode("utf-8")
            self._send(500, body, "application/json")


class Server(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> None:
    server = Server(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"ResuForm resume builder -> {url}")
    print("Typesetting uses a local TeX engine if installed, otherwise TeXLive.net.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
