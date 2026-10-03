"""Synchronize the legacy Telegram webhook without embedded credentials."""

from __future__ import annotations

import os
import sys

import requests
from dotenv import load_dotenv


load_dotenv()


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Environment variable {name} is required")
    return value


def main() -> None:
    bot_token = require_env("TELEGRAM_BOT_TOKEN")
    webhook_secret = require_env("TELEGRAM_WEBHOOK_SECRET")
    webhook_path = require_env("N8N_TELEGRAM_WEBHOOK_PATH")
    base_url = (
        sys.argv[1].strip().rstrip("/")
        if len(sys.argv) > 1
        else require_env("WEBHOOK_URL").rstrip("/")
    )

    if not base_url.startswith("https://"):
        raise RuntimeError("WEBHOOK_URL must use HTTPS")
    if not webhook_path.startswith("/webhook/"):
        raise RuntimeError("N8N_TELEGRAM_WEBHOOK_PATH must start with /webhook/")

    webhook_url = f"{base_url}{webhook_path}"
    response = requests.post(
        f"https://api.telegram.org/bot{bot_token}/setWebhook",
        json={"url": webhook_url, "secret_token": webhook_secret},
        timeout=15,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("ok"):
        raise RuntimeError(payload.get("description", "Telegram rejected the webhook"))

    print(f"Telegram webhook synchronized: {webhook_url}")


if __name__ == "__main__":
    main()
