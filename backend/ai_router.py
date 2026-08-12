"""
ai_router.py — True LLM API Router dengan failover lintas provider.

Berbeda dari OpenRouter (yang hanya menjadi aggregator satu provider),
modul ini menangani failover LINTAS provider yang berbeda:
  Provider 1: OpenRouter  (banyak model free, Llama, Qwen, dsb)
  Provider 2: Google Gemini Native (Gemini Flash — free tier)
  Provider 3: Groq  (Llama 3.3 70B — sangat cepat, free tier)

Urutan:
  1. Coba OpenRouter (model list dari FALLBACK_MODELS)
  2. Jika semua model OpenRouter gagal → pindah ke Gemini native
  3. Jika Gemini gagal → pindah ke Groq
  4. Jika semua gagal → raise RuntimeError (caller tangani sebagai 503)

Exponential Backoff: 1s → 2s → 4s sebelum ganti provider.

Cara pakai di file lain:
    from ai_router import call_llm

    result = call_llm(
        system_prompt="Kamu analis keamanan...",
        user_prompt="Analisis data berikut: ...",
        expect_json=True   # True → return dict, False → return str
    )
"""

import os
import json
import time
import logging

logger = logging.getLogger(__name__)

# ─── Model list untuk OpenRouter ─────────────────────────────────────────────
# Prioritas dari atas ke bawah. Jika satu gagal (404/429/400),
# sistem otomatis lanjut ke model berikutnya dalam list ini.
OPENROUTER_FALLBACK_MODELS = [
    os.environ.get("OPENROUTER_MODEL", "openrouter/free"),
    "openrouter/free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "cohere/north-mini-code:free",
    "openai/gpt-oss-20b:free",
]

# ─── Helper: Bersihkan markdown code block dari respons LLM ──────────────────

def _strip_markdown_json(raw_text: str) -> str:
    """Hapus ```json ... ``` wrapper yang kadang ditambahkan LLM."""
    raw_text = raw_text.strip()
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    elif raw_text.startswith("```"):
        raw_text = raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]
    return raw_text.strip()


def _parse_response(raw_text: str, expect_json: bool) -> dict | str:
    """Parse raw LLM text. Raise ValueError jika JSON diminta tapi gagal parse."""
    if not expect_json:
        return raw_text

    cleaned = _strip_markdown_json(raw_text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"[ai_router] JSON parse error: {e}\nRaw preview: {cleaned[:300]}")
        raise ValueError(f"LLM mengembalikan format JSON tidak valid: {str(e)}")


# ─── Provider 1: OpenRouter ───────────────────────────────────────────────────

def _call_openrouter(system_prompt: str, user_prompt: str, expect_json: bool) -> dict | str:
    """
    Panggil OpenRouter dengan fallback antar model.
    Raise RuntimeError jika semua model gagal.
    """
    try:
        import openai
    except ImportError:
        raise RuntimeError("openai library belum terinstall. Jalankan: pip install openai")

    raw_keys = os.environ.get("OPENROUTER_API_KEY", "")
    api_keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    if not api_keys:
        raise RuntimeError("OPENROUTER_API_KEY belum diset di environment.")

    unique_models = list(dict.fromkeys(OPENROUTER_FALLBACK_MODELS))
    last_error = None

    for key_idx, api_key in enumerate(api_keys, 1):
        client = openai.OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            max_retries=0,
            timeout=25.0,
        )

        for model_name in unique_models:
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.3,
                )
                raw_text = response.choices[0].message.content or ""
                if len(api_keys) > 1:
                    logger.info(f"[ai_router][OpenRouter] Berhasil menggunakan Key #{key_idx} ({api_key[:10]}...) dengan model {model_name}")
                else:
                    logger.info(f"[ai_router][OpenRouter] Berhasil: {model_name}")
                return _parse_response(raw_text, expect_json)

            except Exception as e:
                logger.warning(f"[ai_router][OpenRouter] Key #{key_idx} - Model '{model_name}' gagal ({type(e).__name__}: {e}).")
                last_error = e
                continue

    raise RuntimeError(f"Semua API Key OpenRouter dan Model gagal. Error terakhir: {last_error}")


# ─── Provider 2: Google Gemini Native ────────────────────────────────────────

def _call_gemini(system_prompt: str, user_prompt: str, expect_json: bool) -> dict | str:
    """
    Panggil Google Gemini langsung via google-generativeai SDK.
    Raise RuntimeError jika gagal.
    """
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError("google-generativeai belum terinstall. Jalankan: pip install google-generativeai")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY belum diset di environment.")

    genai.configure(api_key=api_key)

    model_name = "gemini-1.5-flash-latest"
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system_prompt,
    )

    try:
        response = model.generate_content(user_prompt)
        raw_text = response.text or ""
        logger.info(f"[ai_router][Gemini] Berhasil: {model_name}")
        return _parse_response(raw_text, expect_json)
    except Exception as e:
        raise RuntimeError(f"Gemini Native gagal: {type(e).__name__}: {e}")


# ─── Provider 3: Groq ────────────────────────────────────────────────────────

def _call_groq(system_prompt: str, user_prompt: str, expect_json: bool) -> dict | str:
    """
    Panggil Groq API (Llama 3.3 70B — cepat dan gratis).
    Raise RuntimeError jika gagal atau key tidak tersedia.
    """
    try:
        import openai
    except ImportError:
        raise RuntimeError("openai library belum terinstall.")

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY belum diset di environment. Daftar gratis di console.groq.com")

    client = openai.OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=api_key,
        max_retries=0,
        timeout=20.0,
    )

    groq_model = "llama-3.3-70b-versatile"
    try:
        response = client.chat.completions.create(
            model=groq_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
        )
        raw_text = response.choices[0].message.content or ""
        logger.info(f"[ai_router][Groq] Berhasil: {groq_model}")
        return _parse_response(raw_text, expect_json)
    except Exception as e:
        raise RuntimeError(f"Groq gagal: {type(e).__name__}: {e}")


# ─── Main Entry Point ─────────────────────────────────────────────────────────

def call_llm(
    system_prompt: str,
    user_prompt: str,
    expect_json: bool = True,
    backoff_seconds: float = 1.0,
) -> dict | str:
    """
    Entry point utama untuk memanggil LLM dari mana saja di codebase.

    Urutan failover:
      1. OpenRouter (model list internal)
      2. Google Gemini Native (jika GEMINI_API_KEY ada)
      3. Groq (jika GROQ_API_KEY ada)

    Args:
        system_prompt: Instruksi sistem untuk LLM.
        user_prompt: Konten utama yang dianalisis.
        expect_json: True → parse dan return dict. False → return string mentah.
        backoff_seconds: Waktu tunggu (detik) sebelum pindah ke provider berikutnya.

    Returns:
        dict jika expect_json=True, str jika expect_json=False.

    Raises:
        RuntimeError: Jika semua provider gagal (caller harus return HTTP 503).
    """
    providers = [
        ("OpenRouter", _call_openrouter),
        ("Gemini",     _call_gemini),
        ("Groq",       _call_groq),
    ]

    last_error = None
    current_backoff = backoff_seconds

    for provider_name, provider_fn in providers:
        try:
            logger.info(f"[ai_router] Mencoba provider: {provider_name}")
            result = provider_fn(system_prompt, user_prompt, expect_json)
            return result

        except RuntimeError as e:
            logger.warning(
                f"[ai_router] Provider '{provider_name}' gagal: {e}. "
                f"Menunggu {current_backoff}s sebelum mencoba provider berikutnya..."
            )
            last_error = e
            time.sleep(current_backoff)
            current_backoff *= 2  # Exponential backoff: 1s → 2s → 4s
            continue

    # Semua provider gagal
    raise RuntimeError(
        f"Semua LLM provider gagal. Error terakhir dari provider '{providers[-1][0]}': {last_error}"
    )


# ─── Tool-Calling Provider Factory ────────────────────────────────────────

def get_tool_calling_providers() -> list[tuple]:
    """
    Return a list of (provider_name, client, model_list) tuples for providers
    that support OpenAI-style tool calling (function calling).

    Used by agentic endpoints that need multi-turn conversations with tool use.
    This centralizes provider/model configuration so it is defined in ONE place.

    Returns:
        List of tuples: [("OpenRouter", client, [model1, ...]), ("Groq", client, [model]), ...]

    Raises:
        RuntimeError: If no provider is configured.
    """
    try:
        import openai
    except ImportError:
        raise RuntimeError("openai library belum terinstall. Jalankan: pip install openai")

    providers = []

    # Provider 1: OpenRouter (multiple free models)
    raw_keys = os.environ.get("OPENROUTER_API_KEY", "")
    api_keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    if api_keys:
        for key in api_keys:
            client = openai.OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=key,
                max_retries=0,
                timeout=25.0,
            )
            providers.append((
                "OpenRouter",
                client,
                list(dict.fromkeys(OPENROUTER_FALLBACK_MODELS)),
            ))

    # Provider 2: Groq (OpenAI-compatible, supports tool calling)
    groq_key = os.environ.get("GROQ_API_KEY")
    if groq_key:
        client = openai.OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=groq_key,
            max_retries=0,
            timeout=20.0,
        )
        providers.append(("Groq", client, ["llama-3.3-70b-versatile"]))

    if not providers:
        raise RuntimeError(
            "Tidak ada provider AI yang dikonfigurasi untuk tool calling. "
            "Set OPENROUTER_API_KEY atau GROQ_API_KEY di environment."
        )

    return providers


# ─── Health Check ─────────────────────────────────────────────────────────────

def get_provider_status() -> dict:
    """
    Kembalikan status konfigurasi tiap provider (apakah API key tersedia).
    Berguna untuk endpoint debugging/monitoring.
    """
    return {
        "openrouter": {
            "configured": bool(os.environ.get("OPENROUTER_API_KEY")),
            "models_count": len(OPENROUTER_FALLBACK_MODELS),
        },
        "gemini": {
            "configured": bool(os.environ.get("GEMINI_API_KEY")),
            "model": "gemini-1.5-flash-latest",
        },
        "groq": {
            "configured": bool(os.environ.get("GROQ_API_KEY")),
            "model": "llama-3.3-70b-versatile",
        },
    }
