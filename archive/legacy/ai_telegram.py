"""
ai_telegram.py — Modul AI Assistant untuk Telegram Bot.

Menyediakan fungsi untuk:
  1. Menganalisis URL/teks yang dilaporkan karyawan via Telegram
  2. Memformat respons yang ramah dan mudah dipahami karyawan awam
  3. Mengirim balasan langsung ke Telegram chat ID karyawan

Flow:
  Karyawan forward link ke Telegram Bot
  → n8n (Flow B) panggil /api/telegram/ai-analyze
  → ai_telegram.analyze_report() → ai_router.call_llm()
  → Format respons → kirim ke Telegram via Bot API
"""

import os
import logging
import requests
from datetime import datetime
import ai_router

logger = logging.getLogger(__name__)

# ─── Telegram Bot API Helper ─────────────────────────────────────────────────

def _send_telegram_message(chat_id: str, text: str) -> bool:
    """
    Kirim pesan teks ke Telegram user via Bot API.
    Return True jika berhasil, False jika gagal (non-blocking).
    """
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        logger.warning("[ai_telegram] TELEGRAM_BOT_TOKEN tidak diset — pesan tidak terkirim.")
        return False

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    try:
        resp = requests.post(url, json=payload, timeout=10)
        resp.raise_for_status()
        logger.info(f"[ai_telegram] Pesan terkirim ke chat_id={chat_id}")
        return True
    except requests.RequestException as e:
        logger.error(f"[ai_telegram] Gagal kirim ke Telegram: {e}")
        return False


# ─── Prompt Builder ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Kamu adalah asisten keamanan siber untuk karyawan perusahaan.
Tugasmu adalah menganalisis URL, teks email, atau pesan yang dicurigai karyawan sebagai phishing.

ATURAN RESPONS:
- Gunakan Bahasa Indonesia yang SEDERHANA dan RAMAH — karyawan bukan teknisi.
- Berikan verdict yang JELAS: AMAN, MENCURIGAKAN, atau BERBAHAYA.
- Jelaskan KENAPA dalam 1-2 kalimat sederhana.
- Beri 1 saran tindakan konkret.
- Jangan gunakan jargon teknis.
- Respons maksimal 4 paragraf pendek.

FORMAT RESPONS (selalu ikuti):
🔍 <Verdict dalam 1 baris>

📋 <Penjelasan singkat kenapa — 1-2 kalimat>

💡 <Saran tindakan konkret>

🛡️ <Penutup singkat yang menenangkan/mengedukasi>"""


def _build_analysis_prompt(reported_content: str, reporter_email: str = "", context: dict = None) -> str:
    """Bangun user prompt untuk analisis konten yang dilaporkan."""
    ctx_parts = []
    if reporter_email:
        ctx_parts.append(f"Dilaporkan oleh: {reporter_email}")
    if context:
        if context.get("vt_result"):
            ctx_parts.append(f"Hasil VirusTotal: {context['vt_result']}")
        if context.get("urlscan_result"):
            ctx_parts.append(f"Hasil URLScan: {context['urlscan_result']}")

    ctx_block = "\n".join(ctx_parts) if ctx_parts else "Tidak ada konteks tambahan."

    return f"""Karyawan melaporkan konten berikut untuk dianalisis:

--- KONTEN YANG DILAPORKAN ---
{reported_content}
--- AKHIR KONTEN ---

Konteks tambahan:
{ctx_block}

Waktu laporan: {datetime.utcnow().strftime('%d %B %Y, %H:%M UTC')}

Analisis konten di atas dan berikan respons sesuai format yang ditetapkan."""


# ─── Main Analysis Function ───────────────────────────────────────────────────

def analyze_and_reply(
    reported_content: str,
    chat_id: str,
    reporter_email: str = "",
    context: dict = None,
    send_reply: bool = True,
) -> dict:
    """
    Analisis konten yang dilaporkan karyawan, lalu kirim balasan ke Telegram.

    Args:
        reported_content: URL/teks email/pesan yang dicurigai.
        chat_id: Telegram chat ID karyawan pelapor.
        reporter_email: Email karyawan (opsional, untuk konteks).
        context: Dict opsional dari n8n — bisa berisi vt_result, urlscan_result.
        send_reply: Jika True, langsung kirim ke Telegram. Jika False, hanya return teks.

    Returns:
        dict: {
            "verdict_text": str,   — teks respons AI lengkap
            "sent": bool,          — apakah pesan berhasil dikirim ke Telegram
            "error": str | None    — pesan error jika ada
        }
    """
    if not reported_content or not reported_content.strip():
        return {"verdict_text": "", "sent": False, "error": "Konten laporan kosong"}

    # Tambah pesan loading agar karyawan tahu sedang diproses
    if send_reply and chat_id:
        _send_telegram_message(
            chat_id,
            "🔍 <b>Sedang menganalisis...</b>\nMohon tunggu beberapa detik."
        )

    try:
        user_prompt = _build_analysis_prompt(reported_content, reporter_email, context)
        verdict_text = ai_router.call_llm(
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            expect_json=False,   # Respons Telegram adalah teks, bukan JSON
        )

        logger.info(f"[ai_telegram] Analisis selesai untuk chat_id={chat_id}")

        sent = False
        if send_reply and chat_id:
            # Tambah header sebelum respons AI
            full_message = (
                f"<b>🤖 Analisis Human Firewall AI</b>\n"
                f"<i>Laporan diterima: {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC</i>\n\n"
                f"{verdict_text}\n\n"
                f"<i>⚠️ Selalu laporkan email mencurigakan ke tim IT Security.</i>"
            )
            sent = _send_telegram_message(chat_id, full_message)

        return {"verdict_text": verdict_text, "sent": sent, "error": None}

    except RuntimeError as e:
        error_msg = f"Layanan analisis AI sedang tidak tersedia: {str(e)}"
        logger.error(f"[ai_telegram] {error_msg}")

        # Kirim pesan error yang ramah ke karyawan
        if send_reply and chat_id:
            _send_telegram_message(
                chat_id,
                "⚠️ <b>Maaf, asisten AI sedang tidak dapat dijangkau.</b>\n\n"
                "Laporan Anda sudah kami terima dan akan ditinjau oleh tim IT Security.\n"
                "Sebaiknya <b>jangan klik</b> link atau lampiran yang Anda curigai sampai mendapat konfirmasi."
            )

        return {"verdict_text": "", "sent": False, "error": error_msg}
