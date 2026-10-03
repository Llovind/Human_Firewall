#!/usr/bin/env python3
"""Squid external ACL helper. Never logs the service credential."""

from __future__ import annotations

import json
import os
import sys
import socket
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import unquote


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


def decision(client_ip: str, method: str, target: str) -> dict:
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
    if result.get("action") not in {"allow", "block"} or not result.get("domain"):
        raise ValueError("Invalid proxy decision response")
    return result


def clean_message(value: str) -> str:
    return " ".join(value.replace('"', "'").replace("\r", " ").replace("\n", " ").split())[:180]


def register_allowed_tunnel(client_ip, client_port, domain, started):
    payload = {"clientIp": client_ip, "clientPort": int(client_port), "domain": domain, "started": started}
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as control:
        control.settimeout(0.5)
        control.connect("/run/afferent/allow.sock")
        control.sendall(json.dumps(payload).encode() + b"\n")
        if control.recv(16).strip() != b"OK":
            raise OSError("Tunnel relay registration failed")


def main():
    if not SERVICE_KEY:
        print("AFFERENT proxy helper requires SERVICE_API_KEY", file=sys.stderr, flush=True)
        return 1
    for raw_line in sys.stdin:
        # Squid appends an optional %DATA token; decode each URL-escaped field
        # once, never log request headers, cookies, or the bearer credential.
        parts = [unquote(part) for part in raw_line.strip().split()[:6]]
        if len(parts) != 6:
            print('OK message="Invalid proxy request"', flush=True)
            continue
        client_ip, client_port, local_ip, local_port, method, target = parts
        try:
            started = time.monotonic()
            result = decision(client_ip, method, target)
            if result["action"] == "block":
                print(f'OK message="{clean_message(str(result.get("reason", "AFFERENT policy")))}"', flush=True)
            else:
                if method.upper() == "CONNECT":
                    try:
                        register_allowed_tunnel(client_ip, client_port, result["domain"], started)
                    except OSError:
                        print('OK message="AFFERENT tunnel controller unavailable"', flush=True)
                        continue  # fail closed even when an API fail-open mode was requested
                print("ERR", flush=True)
        except (OSError, ValueError, urllib.error.URLError) as exc:
            print(f"AFFERENT decision API error: {type(exc).__name__}", file=sys.stderr, flush=True)
            if FAIL_MODE == "open":
                print("ERR", flush=True)
            else:
                print('OK message="AFFERENT security service unavailable"', flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

