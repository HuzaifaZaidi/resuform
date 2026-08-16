"""ResuForm Flask app — same UI and compile APIs as server.py."""

from __future__ import annotations

import io
import os
import sys
import webbrowser
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_file, send_from_directory

from gaconfig import inject_index
from texcompile import PDF_CACHE, PDF_LOCK, compile_tex, photo_from_data_url, safe_pdf_name

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PICA_FLASK_PORT", os.environ.get("PICA_PORT", "5000")))

app = Flask(__name__, static_folder=str(ROOT / "static"), static_url_path="/static")


@app.after_request
def disable_cache(response: Response) -> Response:
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/")
def index():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    try:
        html = inject_index(html)
    except Exception:
        html = html.replace("%%GA_MEASUREMENT_ID%%", "")
    return Response(html, mimetype="text/html; charset=utf-8")


@app.post("/api/compile")
def api_compile():
    payload = request.get_json(silent=True) or {}
    tex = payload.get("tex") or ""
    if not str(tex).strip():
        return jsonify(error="Missing LaTeX source."), 400
    try:
        pdf = compile_tex(tex, photo_from_data_url(payload.get("photo") or ""))
    except Exception as exc:
        return jsonify(error=str(exc).strip() or "Compile failed."), 400
    name = str(payload.get("filename") or "resume.pdf")
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    with PDF_LOCK:
        PDF_CACHE["bytes"] = pdf
        PDF_CACHE["name"] = name
    return Response(
        pdf,
        mimetype="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{safe_pdf_name(name)}"'},
    )


@app.get("/api/resume.pdf")
@app.get("/resume.pdf")
def api_resume_pdf():
    with PDF_LOCK:
        pdf = PDF_CACHE["bytes"]
        name = PDF_CACHE["name"]
    if not pdf:
        return "No PDF yet. Click Typeset PDF first.", 404, {"Content-Type": "text/plain"}
    download = request.args.get("download")
    return send_file(
        io.BytesIO(pdf),
        mimetype="application/pdf",
        as_attachment=bool(download),
        download_name=safe_pdf_name(name),
        max_age=0,
    )


def main() -> None:
    url = f"http://127.0.0.1:{PORT}/"
    print(f"ResuForm resume builder (Flask) -> {url}")
    print("The original stdlib server is still available: start.bat or python server.py")
    print("Typesetting uses a local TeX engine if installed, otherwise TeXLive.net.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    app.run(host="127.0.0.1", port=PORT, threaded=True, debug=False)


if __name__ == "__main__":
    main()
