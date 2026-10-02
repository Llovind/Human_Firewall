import time
import json
import re
import numpy as np
import onnxruntime as ort
from pathlib import Path
from transformers import AutoTokenizer

# ==========================================
# 1. SETUP PATH & CONFIG
# ==========================================
BASE_DIR = Path(r"D:\Data Ade\Antigravity 2.0\Hackaton\Human_Firewall\results nlp")
ONNX_FILE = BASE_DIR / "minilm_onnx" / "model.onnx"
TOKENIZER_DIR = BASE_DIR / "minilm_onnx"

tokenizer = AutoTokenizer.from_pretrained(str(TOKENIZER_DIR))
providers = ['DmlExecutionProvider', 'CPUExecutionProvider']
session = ort.InferenceSession(str(ONNX_FILE), providers=providers)

# Threshold Terkalibrasi Pragmatis
THR_BLOCK = 0.75
THR_REVIEW = 0.45

# ==========================================
# 2. METADATA RULES ENGINE (LOKAL & TLD)
# ==========================================
HIGH_RISK_TLDS = {".site", ".xyz", ".top", ".online", ".tech", ".vip", ".cc", ".icu", ".pw", ".click"}
SAFE_INDONESIA_TLDS = {".go.id", ".ac.id", ".co.id", ".mil.id", ".net.id"}
JUDOL_PATTERNS = re.compile(r"(slot|gacor|maxwin|olympus|zeus|pragmatic|rtp|jackpot|judol)", re.IGNORECASE)
BRAND_SPOOF_PATTERNS = re.compile(r"(paypal|bank|login|verify|account|update|secure)", re.IGNORECASE)

def calculate_metadata_offset(url_string):
    """
    Menghitung penyesuaian skor risiko berdasarkan fakta metadata & leksikal.
    """
    offset = 0.0
    reasons = []

    # Extract Domain & TLD
    url_lower = url_string.lower()
    
    # 1. TLD Indonesia Resmi (.co.id, .go.id, .ac.id)
    if any(url_lower.endswith(tld) or f"{tld}/" in url_lower for tld in SAFE_INDONESIA_TLDS):
        offset -= 0.45
        reasons.append("TLD Resmi Terverifikasi (.id)")

    # 2. TLD Murah / Risiko Tinggi Phishing & Judol
    if any(url_lower.endswith(tld) or f"{tld}/" in url_lower for tld in HIGH_RISK_TLDS):
        offset += 0.25
        reasons.append("TLD Risiko Tinggi")

    # 3. Kata Kunci Judol Lokal
    if JUDOL_PATTERNS.search(url_lower):
        offset += 0.40
        reasons.append("Indikator Judol Detected")

    # 4. Brand Spoofing / Subdomain Stuffing (e.g. paypal-security-update.xyz)
    if BRAND_SPOOF_PATTERNS.search(url_lower) and any(tld in url_lower for tld in HIGH_RISK_TLDS):
        offset += 0.30
        reasons.append("Indikator Brand Spoofing + Risk TLD")

    return offset, reasons

# ==========================================
# 3. INFERENCE WITH METADATA FUSION
# ==========================================
def predict_url_with_fusion(url_string):
    t0 = time.perf_counter()
    
    # --- STEP 1: AI Model Prediction ---
    inputs = tokenizer(
        url_string,
        truncation=True,
        padding="max_length",
        max_length=200,
        return_tensors="np"
    )
    
    onnx_inputs = {
        "input_ids": inputs["input_ids"].astype(np.int64),
        "attention_mask": inputs["attention_mask"].astype(np.int64),
        "token_type_ids": inputs.get("token_type_ids", np.zeros_like(inputs["input_ids"])).astype(np.int64)
    }
    
    logits = session.run(None, onnx_inputs)[0]
    exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
    probas = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
    
    p_ai_malicious = float(1.0 - probas[0][0])  # Skor Murni AI

    # --- STEP 2: Metadata Fusion ---
    offset, reasons = calculate_metadata_offset(url_string)
    p_final = float(np.clip(p_ai_malicious + offset, 0.0, 1.0))  # Batasi 0.0 - 1.0

    # --- STEP 3: Action Decision ---
    if p_final >= THR_BLOCK:
        action = "BLOCK"
    elif p_final >= THR_REVIEW:
        action = "REVIEW"
    else:
        action = "ALLOW"
        
    latency_ms = (time.perf_counter() - t0) * 1000

    return {
        "url": url_string,
        "p_ai": round(p_ai_malicious, 4),
        "offset": round(offset, 2),
        "p_final": round(p_final, 4),
        "action": action,
        "reasons": ", ".join(reasons) if reasons else "None",
        "latency_ms": round(latency_ms, 2)
    }

# ==========================================
# 4. RUN METADATA FUSION TEST
# ==========================================
if __name__ == "__main__":
    test_urls = [
        "https://www.google.com/search?q=python+tutorial",
        "http://login.paypal-security-update.account-verify.xyz/login.php",
        "http://slot-gacor-maxwin-olympus.site/register",
        "https://mandiri-utama-finance.co.id/layanan",
        "https://lms.cpslaboratory.com",
        "https://sci-hub.net",
        "https://support.microsoft.com/en-us/windows/security/firewall/risks-of-allowing-apps-through-windows-firewall#:~:text=There%20are%20two%20ways%20to%20allow%20an%20app,though%20you%20drilled%20a%20hole%20in%20the%20firewall.",
        "https://pornhub.com",
        "https://stake.com"
    ]

    print("\n" + "="*80)
    print("HASIL TESTING MODEL AI + METADATA FUSION ENGINE")
    print("="*80)
    
    for u in test_urls:
        res = predict_url_with_fusion(u)
        print(f"URL       : {res['url']}")
        print(f"Skor AI   : {res['p_ai']} | Offset Meta: {res['offset']:+.2f} -> Skor Akhir: {res['p_final']}")
        print(f"Aksi      : [{res['action']}] (Alasan: {res['reasons']})")
        print(f"Latensi   : {res['latency_ms']} ms\n" + "-"*80)