"""
routes/ai_routes.py — Flask Blueprint untuk semua endpoint AI Behavioral Analysis.

Endpoints:
  GET  /api/ai/classify-all           → Klasifikasi batch semua user
  GET  /api/ai/user/<email>           → Analisis mendalam satu user
  GET  /api/ai/report?days=<n>        → Generate laporan naratif organisasi
  POST /api/ai/cache/invalidate       → Force-invalidate cache (admin only)
  GET  /api/ai/cache/stats            → Status cache (untuk debugging)
  GET  /api/ai/router/status          → Status konfigurasi tiap LLM provider
  POST /api/ai/gophish/generate       → Generate template phishing dengan AI + push ke Gophish

Semua endpoint protected oleh middleware auth di app.py (Bearer token / session).
"""

from flask import Blueprint, request, jsonify
import os
import json
import logging
import ai_analysis
import ai_prompts
import ai_cache
import ai_router
import gophish_client
from datetime import datetime

logger = logging.getLogger(__name__)
ai_bp = Blueprint('ai', __name__)


# ─── LLM Caller (delegasi ke ai_router) ─────────────────────────────────────
# Semua pemanggilan LLM sekarang dilakukan melalui ai_router.call_llm().
# ai_router menangani failover lintas provider: OpenRouter → Gemini → Groq.
# Fungsi _call_openrouter() lama sudah dipensiunkan.



# ─── Endpoint 1: Klasifikasi Semua User (Batch) ─────────────────────────────

@ai_bp.route('/api/ai/classify-all', methods=['GET'])
def classify_all_users():
    """
    Klasifikasi risk level semua user sekaligus.
    Cocok untuk SOC overview dashboard.
    Cache TTL: 1 jam.
    """
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    cache_key = "ai:classify_all"

    if not force_refresh:
        cached = ai_cache.get_cached(cache_key)
        if cached:
            cached["_from_cache"] = True
            return jsonify(cached), 200

    try:
        users = ai_analysis.get_all_users_summary()
        if not users:
            return jsonify({"error": "Tidak ada data user di database"}), 404

        prompt = ai_prompts.build_batch_classification_prompt(users)
        result = ai_router.call_llm(
            system_prompt=ai_prompts.USER_ANALYSIS_SYSTEM,
            user_prompt=prompt,
            expect_json=True
        )

        result["_generated_at"] = datetime.utcnow().isoformat()
        result["_from_cache"] = False
        result["_total_users"] = len(users)

        ai_cache.set_cache(cache_key, result)
        return jsonify(result), 200

    except RuntimeError as e:
        return jsonify({"error": "Konfigurasi AI Error", "detail": str(e)}), 503
    except ValueError as e:
        return jsonify({"error": "AI response tidak valid", "detail": str(e)}), 502
    except Exception as e:
        logger.exception("classify_all_users error")
        return jsonify({"error": "Internal error", "detail": str(e)}), 500


# ─── Endpoint 2: Analisis Mendalam Per User ─────────────────────────────────

@ai_bp.route('/api/ai/user/<path:email>', methods=['GET'])
def analyze_user(email: str):
    """
    Analisis mendalam satu user: klasifikasi + edukasi personal + rekomendasi.
    Cache TTL: 1 jam per user.
    """
    days = int(request.args.get('days', 30))
    if days not in (1, 7, 14, 30):
        days = 30

    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    cache_key = f"ai:user:{email}:days{days}"

    if not force_refresh:
        cached = ai_cache.get_cached(cache_key)
        if cached:
            cached["_from_cache"] = True
            return jsonify(cached), 200

    try:
        user_ctx = ai_analysis.build_user_context(email, days)
        if user_ctx is None:
            return jsonify({"error": f"User '{email}' tidak ditemukan di database"}), 404

        prompt = ai_prompts.build_user_analysis_prompt(user_ctx)
        result = ai_router.call_llm(
            system_prompt=ai_prompts.USER_ANALYSIS_SYSTEM,
            user_prompt=prompt,
            expect_json=True
        )

        # Tambahkan konteks asli ke response agar frontend bisa pakai
        result["_raw_context"] = {
            "divisi": user_ctx["divisi"],
            "period_days": days,
            "summary": user_ctx["summary"],
            "trend": user_ctx["trend"],
        }
        result["_generated_at"] = datetime.utcnow().isoformat()
        result["_from_cache"] = False

        ai_cache.set_cache(cache_key, result)
        return jsonify(result), 200

    except RuntimeError as e:
        return jsonify({"error": "Konfigurasi AI Error", "detail": str(e)}), 503
    except ValueError as e:
        return jsonify({"error": "AI response tidak valid", "detail": str(e)}), 502
    except Exception as e:
        logger.exception(f"analyze_user error for {email}")
        return jsonify({"error": "Internal error", "detail": str(e)}), 500


# ─── Endpoint 3: Laporan Organisasi ─────────────────────────────────────────

@ai_bp.route('/api/ai/report', methods=['GET'])
def generate_org_report():
    """
    Generate laporan naratif analisis perilaku keamanan organisasi.
    Parameter: days = 1 | 7 | 14 | 30 (default: 7)
    Cache TTL: 1 jam.
    """
    days = int(request.args.get('days', 7))
    if days not in (1, 7, 14, 30):
        days = 7

    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    cache_key = f"ai:report:days{days}"

    if not force_refresh:
        cached = ai_cache.get_cached(cache_key)
        if cached:
            cached["_from_cache"] = True
            return jsonify(cached), 200

    try:
        org_ctx = ai_analysis.build_org_context(days)
        prompt = ai_prompts.build_org_report_prompt(org_ctx, days)

        result = ai_router.call_llm(
            system_prompt=ai_prompts.ORG_REPORT_SYSTEM,
            user_prompt=prompt,
            expect_json=True
        )

        # Format markdown_report string for frontend rendering & PDF export
        md_lines = [
            f"# {result.get('report_title', 'Laporan Analisis Keamanan Perilaku')}",
            f"*Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} | Periode: {days} Hari*\n",
            "## Executive Summary",
            f"{result.get('executive_summary', '')}\n",
            "## Key Findings",
        ]
        for item in result.get('key_findings', []):
            md_lines.append(f"- {item}")

        if result.get('positive_highlights'):
            md_lines.append("\n## Positive Highlights")
            for item in result.get('positive_highlights', []):
                md_lines.append(f"- {item}")

        if result.get('next_steps'):
            md_lines.append("\n## Recommended Next Steps")
            md_lines.append(f"{result.get('next_steps')}")

        result["markdown_report"] = "\n".join(md_lines)
        result["_generated_at"] = datetime.utcnow().isoformat()
        result["_from_cache"] = False
        result["_org_context_snapshot"] = {
            "total_employees": org_ctx["total_employees"],
            "risk_distribution": org_ctx["risk_distribution"],
            "period_days": days,
        }

        ai_cache.set_cache(cache_key, result)
        return jsonify(result), 200

    except RuntimeError as e:
        return jsonify({"error": "Konfigurasi AI Error", "detail": str(e)}), 503
    except ValueError as e:
        return jsonify({"error": "AI response tidak valid", "detail": str(e)}), 502
    except Exception as e:
        logger.exception("generate_org_report error")
        return jsonify({"error": "Internal error", "detail": str(e)}), 500


# ─── Endpoint 4: Cache Management ───────────────────────────────────────────

@ai_bp.route('/api/ai/cache/invalidate', methods=['POST'])
def invalidate_ai_cache():
    """Force-invalidate semua cache AI. Berguna setelah seed ulang database."""
    try:
        ai_cache.invalidate_all()
        return jsonify({"message": "Semua cache AI berhasil dihapus"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@ai_bp.route('/api/ai/cache/stats', methods=['GET'])
def cache_stats():
    """Return statistik cache untuk debugging."""
    try:
        stats = ai_cache.get_cache_stats()
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Endpoint 5: Agentic Investigate ────────────────────────────────────────

# ─── Tool Definitions untuk Agentic AI ──────────────────────────────────────
# Agent dapat memanggil tool-tool ini secara otonom selama proses investigasi.
# Setiap tool merepresentasikan sebuah "kemampuan" untuk mengambil data konteks.

AGENTIC_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_user_behavior_history",
            "description": "Ambil histori perilaku user: click_count phishing, training yang ditonton/diskip, poin gamifikasi, badge, dan timestamp terakhir klik. Gunakan ini pertama kali untuk memahami profil user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "Alamat email user yang ingin diinvestigasi."
                    }
                },
                "required": ["email"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_division_risk_ranking",
            "description": "Ambil ranking risiko semua divisi berdasarkan poin rata-rata. Gunakan ini untuk membandingkan user dengan rata-rata divisinya.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_open_incidents_by_division",
            "description": "Ambil daftar insiden keamanan yang masih 'open' di divisi tertentu. Gunakan ini untuk melihat apakah ada ancaman aktif di lingkungan kerja user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "divisi": {
                        "type": "string",
                        "description": "Nama divisi yang ingin dicek insidennya."
                    }
                },
                "required": ["divisi"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_recent_events",
            "description": "Ambil 10 event terbaru user (klik, training, dll). Gunakan ini untuk melihat pola aktivitas paling baru.",
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {
                        "type": "string",
                        "description": "Alamat email user."
                    }
                },
                "required": ["email"]
            }
        }
    }
]


def _execute_tool(tool_name: str, tool_args: dict) -> str:
    """Eksekusi tool yang dipanggil Agent dan kembalikan hasilnya sebagai string JSON."""
    import database

    if tool_name == "get_user_behavior_history":
        result = database.get_user_history(tool_args["email"])
        return json.dumps(result, default=str)

    elif tool_name == "get_division_risk_ranking":
        lb = database.get_leaderboard()
        return json.dumps(lb.get("by_divisi", []), default=str)

    elif tool_name == "get_open_incidents_by_division":
        incidents = database.list_incidents(status="open")
        divisi = tool_args.get("divisi", "").lower()
        filtered = [i for i in incidents if (i.get("divisi") or "").lower() == divisi]
        return json.dumps(filtered, default=str)

    elif tool_name == "get_user_recent_events":
        conn = database.get_connection()
        try:
            rows = conn.execute(
                "SELECT event_type, divisi, created_at, campaign_id FROM events WHERE email = ? ORDER BY created_at DESC LIMIT 10",
                (tool_args["email"],)
            ).fetchall()
            return json.dumps([dict(r) for r in rows], default=str)
        finally:
            conn.close()

    return json.dumps({"error": f"Tool '{tool_name}' tidak dikenal."})


@ai_bp.route('/api/ai/agentic/investigate', methods=['POST'])
def agentic_investigate():
    """
    ─── AGENTIC AI INVESTIGATOR ───────────────────────────────────────────────
    Endpoint ini menjalankan multi-step agentic reasoning.

    Agent bertindak sebagai "Security Analyst" virtual yang secara otonom:
    1. Menerima target investigasi (email user atau free-text query).
    2. Memutuskan sendiri tool mana yang perlu dipanggil untuk mengumpulkan data.
    3. Melakukan iterasi (max 5 langkah) sampai agent puas dengan konteksnya.
    4. Menghasilkan laporan investigasi final + rekomendasi tindakan.

    Request body (JSON):
        {
            "email": "rina.kusuma@netengineering-dummy.local",  // target user
            "query": "Apakah user ini berisiko tinggi?"         // optional, free text
        }

    Response:
        {
            "email": "...",
            "investigation_steps": [...],   // jejak langkah agent
            "final_report": {...},          // laporan final terstruktur
            "_steps_taken": 3,
            "_generated_at": "..."
        }
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    query = data.get("query", f"Lakukan investigasi mendalam pada user dengan email {email} dan berikan rekomendasi tindakan.")

    if not email:
        return jsonify({"error": "Field 'email' wajib diisi."}), 400

    # ── Get providers from centralized router (no more hardcoded model list) ──
    try:
        providers = ai_router.get_tool_calling_providers()
    except RuntimeError as e:
        return jsonify({"error": "Konfigurasi AI Error", "detail": str(e)}), 503

    AGENTIC_SYSTEM_PROMPT = """Kamu adalah AI Security Analyst dari sistem Human Firewall.
Tugasmu adalah melakukan investigasi mendalam terhadap perilaku keamanan seorang karyawan.

Cara kerja:
1. Gunakan tool yang tersedia untuk mengumpulkan semua informasi yang relevan.
2. Analisis data secara holistik: bandingkan dengan rata-rata divisi, cek insiden aktif, lihat tren terbaru.
3. Setelah kamu merasa informasi cukup, buat laporan final dalam format JSON berikut:
{
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "risk_score": <0-100>,
  "summary": "<ringkasan singkat situasi user>",
  "key_findings": ["<temuan 1>", "<temuan 2>", ...],
  "recommended_actions": ["<aksi 1>", "<aksi 2>", ...],
  "narrative": "<penjelasan lengkap untuk SOC analyst>"
}

Gunakan Bahasa Indonesia. Jadilah spesifik dan gunakan data aktual yang kamu temukan."""

    messages = [
        {"role": "system", "content": AGENTIC_SYSTEM_PROMPT},
        {"role": "user", "content": f"Target investigasi: {email}\n\nQuery: {query}"}
    ]

    investigation_steps = []
    MAX_ITERATIONS = 5
    used_provider = "unknown"
    used_model = "unknown"

    def _call_with_failover(msgs, use_tools=True):
        """Try all providers and their models until one succeeds."""
        nonlocal used_provider, used_model
        last_error = None
        for provider_name, client, model_list in providers:
            for model_name in model_list:
                try:
                    kwargs = {
                        "model": model_name,
                        "messages": msgs,
                        "temperature": 0.2,
                    }
                    if use_tools:
                        kwargs["tools"] = AGENTIC_TOOLS
                        kwargs["tool_choice"] = "auto"
                    response = client.chat.completions.create(**kwargs)
                    used_provider = provider_name
                    used_model = model_name
                    logger.info(f"[Agentic] Berhasil: {provider_name}/{model_name}")
                    return response
                except Exception as e:
                    logger.warning(f"[Agentic] {provider_name}/{model_name} gagal: {e}")
                    last_error = e
                    continue
        return None

    def _parse_final_text(text: str) -> dict:
        """Parse final agent response into structured JSON."""
        cleaned = ai_router._strip_markdown_json(text)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {"narrative": text, "risk_level": "UNKNOWN"}

    # ── Agentic Loop ──────────────────────────────────────────────────────────
    for iteration in range(MAX_ITERATIONS):
        response = _call_with_failover(messages)

        if not response:
            return jsonify({
                "error": "Semua provider dan model gagal merespons",
                "detail": "Cek konfigurasi OPENROUTER_API_KEY / GROQ_API_KEY",
            }), 503

        choice = response.choices[0]
        msg = choice.message

        # Tambahkan response agent ke history
        messages.append({"role": "assistant", "content": msg.content, "tool_calls": [
            {
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.function.name, "arguments": tc.function.arguments}
            } for tc in (msg.tool_calls or [])
        ]})

        # Jika agent tidak memanggil tool lagi — selesai
        if not msg.tool_calls:
            final_report = _parse_final_text(msg.content or "")
            return jsonify({
                "email": email,
                "investigation_steps": investigation_steps,
                "final_report": final_report,
                "_steps_taken": iteration + 1,
                "_generated_at": datetime.utcnow().isoformat(),
                "_provider_used": used_provider,
                "_model_used": used_model,
            }), 200

        # Eksekusi setiap tool yang dipanggil agent
        for tool_call in msg.tool_calls:
            tool_name = tool_call.function.name
            try:
                tool_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                tool_args = {}

            tool_result = _execute_tool(tool_name, tool_args)

            step_log = {
                "step": iteration + 1,
                "tool_called": tool_name,
                "args": tool_args,
                "result_preview": tool_result[:300] + "..." if len(tool_result) > 300 else tool_result
            }
            investigation_steps.append(step_log)
            logger.info(f"[Agentic] Step {iteration+1}: Called {tool_name}({tool_args})")

            # Kembalikan hasil tool ke agent
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": tool_result
            })

    # Jika sudah max iterasi, minta kesimpulan paksa (tanpa tools)
    messages.append({
        "role": "user",
        "content": "Kamu telah mencapai batas investigasi. Berikan laporan final sekarang dalam format JSON yang sudah ditentukan."
    })
    final_response = _call_with_failover(messages, use_tools=False)

    if not final_response:
        return jsonify({
            "error": "Gagal mendapatkan laporan final dari semua provider",
        }), 503

    final_text = (final_response.choices[0].message.content or "").strip()
    final_report = _parse_final_text(final_text)

    return jsonify({
        "email": email,
        "investigation_steps": investigation_steps,
        "final_report": final_report,
        "_steps_taken": MAX_ITERATIONS,
        "_generated_at": datetime.utcnow().isoformat(),
        "_provider_used": used_provider,
        "_model_used": used_model,
        "_warning": "Batas iterasi maksimum tercapai."
    }), 200


# ─── Endpoint: Router Status ──────────────────────────────────────────────────

@ai_bp.route('/api/ai/router/status', methods=['GET'])
def router_status():
    """Kembalikan status konfigurasi tiap LLM provider (ada API key atau tidak)."""
    return jsonify(ai_router.get_provider_status()), 200


# ─── Endpoint: Gophish Generative AI ────────────────────────────────────────────

GOPHISH_GEN_SYSTEM = """Kamu adalah spesialis keamanan siber yang membantu tim SOC 
merancang simulasi phishing realistis untuk program pelatihan keamanan internal.

Tugas kamu: buat template email phishing yang REALISTIS dan MEYAKINKAN dalam Bahasa Indonesia,
disesuaikan dengan tema dan divisi target yang diberikan.

ATURAN PENTING:
- Gunakan gaya bahasa formal korporat Indonesia
- Sertakan elemen urgensi atau otoritas (IT Helpdesk, HRD, Finance, dsb)
- HTML harus clean dan bisa langsung dipakai di Gophish
- Gunakan {{.FirstName}} untuk nama depan penerima
- Gunakan {{.URL}} untuk link phishing (WAJIB ada)
- Jangan tambahkan penjelasan atau komentar di luar JSON
- Respons HARUS berupa JSON yang valid"""


def _scrape_with_firecrawl(url: str) -> str:
    """
    Scrape URL menggunakan Firecrawl API dan kembalikan konten Markdown.
    Return string kosong jika Firecrawl tidak dikonfigurasi atau gagal.
    """
    api_key = os.environ.get("FIRECRAWL_API_KEY", "").strip()
    if not api_key:
        logger.info("[gophish_gen] FIRECRAWL_API_KEY tidak diset — skip scraping.")
        return ""

    try:
        import requests as req
        resp = req.post(
            "https://api.firecrawl.dev/v1/scrape",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"url": url, "formats": ["markdown"]},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data.get("data", {}).get("markdown", "") or ""
        # Batasi panjang agar tidak membengkakkan prompt
        return content[:3000] if content else ""
    except Exception as e:
        logger.warning(f"[gophish_gen] Firecrawl gagal untuk {url}: {e}")
        return ""


@ai_bp.route('/api/ai/gophish/generate', methods=['POST'])
def gophish_generate():
    """
    Generate template email phishing realistis menggunakan AI, lalu push ke Gophish.

    Body JSON:
      {
        "tema": "BPJS Ketenagakerjaan",          // tema/topik phishing (wajib)
        "divisi_target": "Finance",              // divisi target (opsional)
        "template_name": "BPJS-Juli-2026",      // nama template di Gophish (opsional)
        "reference_url": "https://bpjs.go.id",  // URL untuk Firecrawl (opsional)
        "push_to_gophish": true                  // push ke Gophish? default: true
      }

    Returns:
      201: { "template": {...}, "gophish_response": {...} | null }
      400: validasi gagal
      503: semua LLM provider gagal
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": {"code": "missing_body", "message": "Body JSON wajib diisi"}}), 400

    tema = (data.get("tema") or "").strip()
    if not tema:
        return jsonify({"error": {"code": "missing_tema", "message": "Field 'tema' wajib diisi"}}), 400

    divisi_target = (data.get("divisi_target") or "semua divisi").strip()
    reference_url = (data.get("reference_url") or "").strip()
    push_to_gophish = data.get("push_to_gophish", True)
    template_name = (data.get("template_name") or f"AI-Gen-{tema[:30]}-{datetime.utcnow().strftime('%d%m%Y')}").strip()

    # ── (Opsional) Scrape URL referensi dengan Firecrawl ─────────────────
    scraped_context = ""
    if reference_url:
        scraped_context = _scrape_with_firecrawl(reference_url)
        if scraped_context:
            logger.info(f"[gophish_gen] Berhasil scrape {reference_url} ({len(scraped_context)} chars)")

    # ── Bangun prompt ──────────────────────────────────────────────────
    context_block = (
        f"\n\nKonteks tambahan dari website referensi ({reference_url}):\n{scraped_context}"
        if scraped_context else ""
    )

    user_prompt = f"""Buat template email phishing simulasi dengan detail berikut:

Tema / Dalih: {tema}
Divisi Target: {divisi_target}
Tanggal Pembuatan: {datetime.utcnow().strftime('%d %B %Y')}
{context_block}

Hasilkan JSON dengan format PERSIS seperti ini:
{{
  "subject": "<subject email yang meyakinkan>",
  "sender_name": "<nama pengirim palsu yang meyakinkan>",
  "sender_email": "<email pengirim palsu, domain mirip resmi>",
  "html_body": "<HTML email lengkap, gunakan {{{{.FirstName}}}} dan {{{{.URL}}}}, styling sederhana>",
  "text_body": "<versi plain text>",
  "phishing_indicators": ["<indikator 1>", "<indikator 2>", "<indikator 3>"],
  "education_note": "<penjelasan singkat kenapa email ini mencurigakan, untuk halaman edukasi>"
}}"""

    # ── Panggil LLM ───────────────────────────────────────────────────
    try:
        template_data = ai_router.call_llm(
            system_prompt=GOPHISH_GEN_SYSTEM,
            user_prompt=user_prompt,
            expect_json=True,
        )
    except RuntimeError as e:
        return jsonify({
            "error": {
                "code": "ai_provider_unavailable",
                "message": f"Semua LLM provider gagal: {str(e)}"
            }
        }), 503
    except ValueError as e:
        return jsonify({
            "error": {
                "code": "ai_invalid_response",
                "message": f"AI mengembalikan format tidak valid: {str(e)}"
            }
        }), 502

    # Validasi field wajib dari respons AI
    required_fields = ["subject", "html_body"]
    missing = [f for f in required_fields if not template_data.get(f)]
    if missing:
        return jsonify({
            "error": {
                "code": "ai_incomplete_response",
                "message": f"Respons AI tidak lengkap, field berikut kosong: {missing}"
            }
        }), 502

    # ── (Opsional) Push ke Gophish ────────────────────────────────────
    gophish_response = None
    gophish_error = None

    if push_to_gophish:
        try:
            gophish_response = gophish_client.create_template(
                name=template_name,
                subject=template_data["subject"],
                html_body=template_data["html_body"],
                text_body=template_data.get("text_body", ""),
            )
            logger.info(f"[gophish_gen] Template '{template_name}' berhasil dipush ke Gophish (id={gophish_response.get('id')})")
        except Exception as e:
            gophish_error = str(e)
            logger.warning(f"[gophish_gen] Gagal push ke Gophish: {e}")

    return jsonify({
        "template_name": template_name,
        "tema": tema,
        "divisi_target": divisi_target,
        "template": template_data,
        "gophish_response": gophish_response,
        "gophish_error": gophish_error,
        "firecrawl_used": bool(scraped_context),
        "_generated_at": datetime.utcnow().isoformat(),
    }), 201
