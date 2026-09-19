"""Start a Cloudflare tunnel and register the Telegram webhook securely.

Legacy helper retained until Flow B is archived in Phase 3. All credentials and
paths are mandatory environment configuration; this file contains no fallback
secret.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time

import requests
from dotenv import load_dotenv


load_dotenv()

CLOUDFLARED_PATH = os.environ.get(
    "CLOUDFLARED_PATH",
    r"C:\Program Files (x86)\cloudflared\cloudflared.exe",
)
N8N_LOCAL_URL = os.environ.get("N8N_LOCAL_URL", "http://localhost:5678")


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Environment variable {name} is required")
    return value


def main() -> None:
    bot_token = require_env("TELEGRAM_BOT_TOKEN")
    webhook_secret = require_env("TELEGRAM_WEBHOOK_SECRET")
    webhook_path = require_env("N8N_TELEGRAM_WEBHOOK_PATH")
    if not webhook_path.startswith("/webhook/"):
        raise RuntimeError("N8N_TELEGRAM_WEBHOOK_PATH must start with /webhook/")

    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    subprocess.run(
        [
            "powershell",
            "-Command",
            "Get-Process -Name '*cloudflared*' -ErrorAction SilentlyContinue | "
            "Stop-Process -Force -ErrorAction SilentlyContinue",
        ],
        capture_output=True,
        check=False,
    )

    process = subprocess.Popen(
        [CLOUDFLARED_PATH, "tunnel", "--url", N8N_LOCAL_URL],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    tunnel_url = None
    deadline = time.time() + 25
    while time.time() < deadline and process.stderr:
        line = process.stderr.readline()
        match = re.search(
            r"https://(?!(?:api|pkg)\.)[a-zA-Z0-9-]+\.trycloudflare\.com",
            line,
        )
        if match:
            tunnel_url = match.group(0)
            break

    if not tunnel_url:
        process.kill()
        raise RuntimeError("Cloudflare tunnel URL was not available within 25 seconds")

    webhook_url = f"{tunnel_url}{webhook_path}"
    response = requests.post(
        f"https://api.telegram.org/bot{bot_token}/setWebhook",
        json={"url": webhook_url, "secret_token": webhook_secret},
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("ok"):
        process.kill()
        raise RuntimeError(payload.get("description", "Telegram rejected the webhook"))

    print(f"Tunnel and webhook active: {webhook_url}")
    try:
        process.wait()
    except KeyboardInterrupt:
        process.terminate()


if __name__ == "__main__":
    main()
