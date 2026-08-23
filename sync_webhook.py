import os
import sys
import re
import requests

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Read bot token from .env / environment
token = os.environ.get("TELEGRAM_BOT_TOKEN")
if not token and os.path.exists('.env'):
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith("TELEGRAM_BOT_TOKEN="):
                token = line.split("=", 1)[1].strip()
                break

if not token:
    token = "8771953552:AAEVMI5AcgvFX0BaZwXc88oyNrI9A5EqS0E"

target_path = "/webhook/d7e352ba-9e3b-45f1-92cd-dee3d8bc1565/webhook"

# 1. Baca URL dari argumen atau dari .env
new_webhook_url = None
if len(sys.argv) > 1 and sys.argv[1].startswith("http"):
    new_webhook_url = sys.argv[1].rstrip("/")
else:
    # Baca dari .env
    try:
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                if line.startswith("WEBHOOK_URL="):
                    new_webhook_url = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception as e:
        print(f"Gagal membaca .env: {e}")

if not new_webhook_url:
    print("❌ Error: WEBHOOK_URL tidak ditemukan di .env atau argumen.")
    print("   Contoh penggunaan: python sync_webhook.py https://contoh-nama.trycloudflare.com")
    sys.exit(1)

print("=" * 60)
print("📡 TELEGRAM WEBHOOK SYNC")
print("=" * 60)

# 2. Cek n8n local
print("\n[1/3] Memeriksa status n8n lokal...")
try:
    r = requests.get("http://localhost:5678/healthz", timeout=3)
    print(f"  ✅ n8n Local Status: OK (HTTP {r.status_code})")
except Exception as e:
    print(f"  ⚠️ n8n tidak merespon: {e}")

# 3. Daftarkan Webhook ke Telegram API
target_full = f"{new_webhook_url}{target_path}"
print(f"\n[2/3] Mendaftarkan ke Telegram API...")
print(f"  Target: {target_full}")

SECRET_TOKEN = "4MfgpvkKEnWjfH41_1f55aebf-5103-44e9-b4ec-1a5a6085769d"

result = requests.post(
    f"https://api.telegram.org/bot{token}/setWebhook",
    json={"url": target_full, "secret_token": SECRET_TOKEN}
).json()

if result.get("ok"):
    print("  ✅ Telegram API: Berhasil mendaftarkan webhook!")
else:
    print(f"  ❌ Telegram API Error: {result.get('description')}")

# 4. Status Webhook Terbaru
print(f"\n[3/3] Status Webhook Telegram:")
info2 = requests.get(f"https://api.telegram.org/bot{token}/getWebhookInfo").json().get("result", {})
print(f"  • Webhook URL     : {info2.get('url', 'KOSONG')}")
print(f"  • Pending Updates : {info2.get('pending_update_count', 0)}")
print(f"  • Last Error      : {info2.get('last_error_message', 'TIDAK ADA (0 Error)')}")
print("=" * 60)
