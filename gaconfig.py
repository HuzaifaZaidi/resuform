"""Read the GA4 Measurement ID from the environment. Never hard-code it."""

from __future__ import annotations

import os
import re
from pathlib import Path

PLACEHOLDER = "%%GA_MEASUREMENT_ID%%"
_ID_RE = re.compile(r"^G-[A-Z0-9]+$", re.IGNORECASE)


def _load_dotenv() -> None:
    path = Path(__file__).resolve().parent / ".env"
    if not path.is_file():
        return
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, _, value = stripped.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
    except OSError:
        pass


_load_dotenv()


def measurement_id() -> str:
    raw = (
        os.environ.get("VITE_GA_MEASUREMENT_ID")
        or os.environ.get("GA_MEASUREMENT_ID")
        or ""
    ).strip()
    return raw if _ID_RE.fullmatch(raw) else ""


def inject_index(html: str) -> str:
    return html.replace(PLACEHOLDER, measurement_id())
