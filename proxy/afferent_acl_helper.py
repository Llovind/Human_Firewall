#!/usr/bin/env python3
"""Squid external ACL helper. Never logs the service credential."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path


def secret(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    file_name = os.environ.get(f"{name}_FILE", "").strip()
    return Path(file_name).read_text(encoding="utf-8").strip() if file_name else ""


API_URL = os.environ.get("PROXY_DECISION_API_URL", "http://flask_api:5000/api/proxy/decision")
TIMEOUT = float(os.environ.get("PROXY_DECISION_TIMEOUT_SECONDS", "2.5"))
FAIL_MODE = os.environ.get("PROXY_FAIL_MODE", "closed").strip().lower()
SERVICE_KEY = secret("SERVICE_API_KEY")


def decision(client_ip: str, method: str, target: str) -> tuple[bool, str]:
    event_id = str(uuid.uuid4())
    port = None
    if method.upper() == "CONNECT" and ":" in target:
        maybe_port = target.rsplit(":", 1)[-1]
        if maybe_port.isdigit():
            port = int(maybe_port)
    payload = json.dumps(
        {
            "schemaVersion": "1.0",
            "eventId": event_id,
            "requestId": event_id,
            "clientIp": client_ip,
            "method": method,
            "target": target,
            "port": port,
        },
        separators=(",", ":"),
    ).encode()
    request = urllib.request.Request(
        API_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "application/json",
            "X-Request-ID": event_id,
        },
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        result = json.loads(response.read().decode("utf-8"))
    return result.get("action") == "block", str(result.get("reason", "AFFERENT policy"))


def clean_message(value: str) -> str:
    return " ".join(value.replace('"', "'").replace("\r", " ").replace("\n", " ").split())[:180]


if not SERVICE_KEY:
    print("AFFERENT proxy helper requires SERVICE_API_KEY", file=sys.stderr, flush=True)
    raise SystemExit(1)

for raw_line in sys.stdin:
    parts = raw_line.strip().split(maxsplit=2)
    if len(parts) != 3:
        print('OK message="Invalid proxy request"', flush=True)
        continue
    try:
        blocked, reason = decision(parts[0], parts[1], parts[2])
        if blocked:
            print(f'OK message="{clean_message(reason)}"', flush=True)
        else:
            print("ERR", flush=True)
    except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError) as exc:
        print(f"AFFERENT decision API error: {type(exc).__name__}", file=sys.stderr, flush=True)
        if FAIL_MODE == "open":
            print("ERR", flush=True)
        else:
            print('OK message="AFFERENT security service unavailable"', flush=True)

