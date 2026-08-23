"""
start_webhook.py — One-Click Automated Cloudflare Tunnel & Telegram Webhook Sync
"""

import subprocess
import time
import re
import sys
import os
import requests

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

CLOUDFLARED_PATH = r"C:\Program Files (x86)\cloudflared\cloudflared.exe"

# Read bot token from .env / environment
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
if not BOT_TOKEN and os.path.exists('.env'):
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith("TELEGRAM_BOT_TOKEN="):
                BOT_TOKEN = line.split("=", 1)[1].strip()
                break

if not BOT_TOKEN:
    BOT_TOKEN = "8771953552:AAEVMI5AcgvFX0BaZwXc88oyNrI9A5EqS0E"

WEBHOOK_PATH = "/webhook/d7e352ba-9e3b-45f1-92cd-dee3d8bc1565/webhook"
N8N_URL = "http://localhost:5678"

def main():
    print("=" * 65)
    print(">>> AFFERENT BOT WEBHOOK & TUNNEL ONE-CLICK SYNC")
    print("=" * 65)

    # 1. Matikan instance cloudflared lama
    print("\n[1/5] Membersihkan proses cloudflared lama...")
    subprocess.run(
        ["powershell", "-Command", "Get-Process -Name '*cloudflared*' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"],
        capture_output=True
    )
    time.sleep(1)

    # 2. Jalankan Cloudflare Tunnel baru
    print("[2/5] Membuka Cloudflare Tunnel baru ke port 5678...")
    process = subprocess.Popen(
        [CLOUDFLARED_PATH, "tunnel", "--url", N8N_URL],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace"
    )

    # 3. Tangkap URL *.trycloudflare.com dari stderr (abaikan api.trycloudflare.com)
    tunnel_url = None
    start_time = time.time()
    print("⏳ Menunggu URL tunnel dari Cloudflare...")

    while time.time() - start_time < 25:
        line = process.stderr.readline()
        if not line:
            time.sleep(0.1)
            continue
        
        m = re.search(r"https://(?!(?:api|pkg)\.)[a-zA-Z0-9-]+\.trycloudflare\.com", line)
        if m:
            tunnel_url = m.group(0)
            break

    if not tunnel_url:
        print("[!] Gagal mendapatkan URL Cloudflare Tunnel. Coba cek koneksi internet.")
        process.kill()
        return

    print(f"\n[+] Tunnel Aktif: {tunnel_url}")

    # 4. Update .env file dengan WEBHOOK_URL baru
    print(f"[3/5] Mengupdate .env dengan WEBHOOK_URL baru...")
    try:
        with open('.env', 'r', encoding='utf-8') as f:
            env_content = f.read()
        env_content = re.sub(r'WEBHOOK_URL=https://[^\r\n]+', f'WEBHOOK_URL={tunnel_url}', env_content)
        with open('.env', 'w', encoding='utf-8') as f:
            f.write(env_content)
        print("    .env berhasil diupdate.")
    except Exception as e:
        print(f"    Gagal update .env: {e}")

    # 5. Recreate n8n container agar membaca WEBHOOK_URL baru
    print("[4/5] Menyinkronkan container n8n...")
    subprocess.run(["docker", "compose", "up", "-d", "n8n"], capture_output=True)
    time.sleep(3)

    # 6. Daftarkan Webhook ke Telegram API
    full_webhook_url = f"{tunnel_url}{WEBHOOK_PATH}"
    print(f"[5/5] Mendaftarkan Webhook ke Telegram Bot...")
    print(f"    Target: {full_webhook_url}")

    registered = False
    for attempt in range(1, 6):
        time.sleep(2)
        SECRET_TOKEN = "4MfgpvkKEnWjfH41_1f55aebf-5103-44e9-b4ec-1a5a6085769d"
        res = requests.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook",
            json={"url": full_webhook_url, "secret_token": SECRET_TOKEN}
        ).json()

        if res.get("ok"):
            print(f"    Telegram Webhook BERHASIL didaftarkan pada percobaan ke-{attempt}!")
            registered = True
            break
        else:
            print(f"    Percobaan {attempt}/5: Menunggu DNS... ({res.get('description')})")

    if not registered:
        print("[!] Gagal mendaftarkan Telegram Webhook.")
        process.kill()
        return

    # 7. Verifikasi Status Webhook
    info = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo").json().get("result", {})
    print("\n" + "=" * 65)
    print("STATUS WEBHOOK TELEGRAM SAAT INI:")
    print(f"  • Webhook URL     : {info.get('url')}")
    print(f"  • Pending Updates : {info.get('pending_update_count')}")
    print(f"  • Last Error      : {info.get('last_error_message', 'TIDAK ADA (0 Error)')}")
    print("=" * 65)
    print("\n[OK] BOT SUDAH AKTIF DAN SIAP MENERIMA LAPORAN!")
    print("[*] JANGAN TUTUP JENDELA INI AGAR BOT TETAP HIDUP.")
    print("    Tekan Ctrl+C jika ingin mematikan bot/tunnel.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Mematikan Cloudflare Tunnel...")
        process.kill()
        print("[OK] Tunnel dimatikan.")

if __name__ == "__main__":
    main()
