"""Minimal multipart parser so the stdlib server can accept PDF uploads."""

from __future__ import annotations

import re


def parse_multipart(content_type: str, body: bytes) -> tuple[dict[str, str], dict[str, bytes]]:
    fields: dict[str, str] = {}
    files: dict[str, bytes] = {}
    match = re.search(r"boundary=([^;]+)", content_type or "", re.I)
    if not match or not body:
        return fields, files
    boundary = match.group(1).strip().strip('"').encode("utf-8")
    for part in body.split(b"--" + boundary):
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        header_blob, sep, content = part.partition(b"\r\n\r\n")
        if not sep:
            continue
        if content.endswith(b"\r\n"):
            content = content[:-2]
        headers = header_blob.decode("utf-8", "replace")
        name_m = re.search(r'name="([^"]+)"', headers, re.I)
        if not name_m:
            continue
        name = name_m.group(1)
        if re.search(r"filename=", headers, re.I):
            files[name] = content
        else:
            fields[name] = content.decode("utf-8", "replace")
    return fields, files
