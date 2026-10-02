import os
import sys
import socket
import json
import re
import urllib.parse
import pandas as pd
from pathlib import Path

# ==========================================
# 0. SETUP AUTO-IMPORT MODEL DARI BACKEND
# ==========================================
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"

if BACKEND_DIR.exists():
    sys.path.append(str(BACKEND_DIR))

try:
    from char_bilstm_scanner import scan_url_dl
    print("[INFO] Berhasil mengimpor char_bilstm_scanner dari backend.")
except ImportError:
    print("[WARN] Modul char_bilstm_scanner tidak ditemukan di path. Menggunakan fallback mock function.")
    def scan_url_dl(url):
        return {"score": 0.50}

# ==========================================
# 1. CONFIG & PATHS
# ==========================================
CSV_PATH = Path("D:/Data Ade/Antigravity 2.0/Hackaton/Human_Firewall/dataset/processed/test.csv")
OUTPUT_JSONL = Path("agent_sft_dataset_af.jsonl")

HIGH_RISK_TLDS = {".site", ".xyz", ".top", ".online", ".tech", ".vip", ".cc", ".icu", ".pw", ".click"}
INSTITUTIONAL_TLDS = {".go.id", ".ac.id", ".co.id", ".mil.id", ".net.id"}

JUDOL_PATTERNS = re.compile(r"(slot|gacor|maxwin|olympus|zeus|pragmatic|rtp|jackpot|judol)", re.IGNORECASE)
PHISHING_PATTERNS = re.compile(r"(login|verify|account|update|secure|bank|paypal|klikbca)", re.IGNORECASE)
PORN_PATTERNS = re.compile(r"(porn|sex|xxx|adult|bokep|toket|hentai|xvideos)", re.IGNORECASE)

# ==========================================
# 2. HELPER FUNCTIONS
# ==========================================
def check_domain_live(hostname, port=80, timeout=0.8):
    if not hostname:
        return False
    try:
        socket.setdefaulttimeout(timeout)
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((hostname, port))
        s.close()
        return True
    except Exception:
        return False

def extract_metadata_from_row(url_str, registered_domain):
    parsed = urllib.parse.urlparse(url_str if "://" in url_str else "http://" + url_str)
    hostname = parsed.hostname or str(registered_domain) or ""
    scheme = parsed.scheme.lower()
    
    reg_dom_str = str(registered_domain)
    tld = "." + reg_dom_str.split(".")[-1] if "." in reg_dom_str else ""
    is_institutional = any(hostname.endswith(t) for t in INSTITUTIONAL_TLDS)
    is_high_risk_tld = tld in HIGH_RISK_TLDS

    lexicon_hits = []
    if JUDOL_PATTERNS.search(url_str):
        lexicon_hits.append("judol")
    if PHISHING_PATTERNS.search(url_str):
        lexicon_hits.append("phishing_keywords")
    if PORN_PATTERNS.search(url_str):
        lexicon_hits.append("adult_content")

    is_live = check_domain_live(hostname)

    return {
        "hostname": hostname,
        "scheme": scheme,
        "tld": tld,
        "has_ssl": scheme == "https",
        "is_institutional": is_institutional,
        "is_high_risk_tld": is_high_risk_tld,
        "lexicon_hits": lexicon_hits,
        "is_domain_active": is_live
    }

# ==========================================
# 3. MAIN GENERATOR FUNCTION
# ==========================================
def generate_sft_dataset(max_samples=1000):
    if not CSV_PATH.exists():
        print(f"[ERROR] File CSV tidak ditemukan di: {CSV_PATH}")
        return

    print(f"Membaca dataset dari {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)

    if df.empty:
        print("[ERROR] CSV kosong!")
        return

    # Paksa konversi kolom is_malicious ke tipe data integer
    df["is_malicious"] = pd.to_numeric(df["is_malicious"], errors="coerce").fillna(0).astype(int)

    total_benign = len(df[df["is_malicious"] == 0])
    total_malicious = len(df[df["is_malicious"] == 1])
    print(f"Statistik CSV -> Total: {len(df)} | Benign (0): {total_benign} | Malicious (1): {total_malicious}")

    # Ambil sampel seimbang
    n_benign = min(max_samples // 2, total_benign)
    n_malicious = min(max_samples // 2, total_malicious)

    benign_df = df[df["is_malicious"] == 0].sample(n=n_benign) if n_benign > 0 else pd.DataFrame()
    threat_df = df[df["is_malicious"] == 1].sample(n=n_malicious) if n_malicious > 0 else pd.DataFrame()

    sampled_df = pd.concat([benign_df, threat_df]).sample(frac=1).reset_index(drop=True)
    print(f"Memproses {len(sampled_df)} sampel URL untuk SFT Dataset...")

    dataset_entries = []

    for idx, row in sampled_df.iterrows():
        # Clean & sanitize URL dari tab/newline/space
        raw_url = str(row["url"])
        url = raw_url.replace('\t', '').replace('\n', '').replace('\r', '').strip()
        
        is_malicious = int(row["is_malicious"])
        label_text = str(row.get("label", "benign" if is_malicious == 0 else "malicious")).lower()
        registered_domain = str(row.get("registered_domain", "")).strip()

        if not url:
            continue

        # Inference DL model lokal
        scan_res = scan_url_dl(url)
        p_bilstm = float(scan_res.get("score", 0.50))

        # Metadata extraction
        meta = extract_metadata_from_row(url, registered_domain)

        # Build reasoning
        reasons = []
        if is_malicious == 1 or p_bilstm >= 0.70:
            verdict = "BLOCK"
            risk_category = f"THREAT_{label_text.upper()}"
            
            if meta["lexicon_hits"]:
                reasons.append(f"terdeteksi leksikon mencurigakan ({', '.join(meta['lexicon_hits'])})")
            if meta["is_high_risk_tld"]:
                reasons.append(f"menggunakan TLD berisiko tinggi ({meta['tld']})")
            if not meta["is_domain_active"]:
                reasons.append("domain tidak aktif/DNS failure (pola khas infrastruktur penyerang yang expired)")
            if not reasons:
                reasons.append("struktur leksikal URL menunjukkan anomalus risiko tinggi")
                
            reason_text = f"URL terindikasi bahaya ({label_text}) karena " + " dan ".join(reasons) + f". Skor Char-BiLSTM: {p_bilstm:.4f}."
            risk_score = max(p_bilstm, 0.85)
            
        else:
            verdict = "ALLOW"
            risk_category = "BENIGN"
            
            if meta["is_institutional"]:
                reasons.append(f"menggunakan TLD resmi/institusional berbadan hukum ({meta['tld']})")
            if meta["is_domain_active"]:
                reasons.append("domain aktif dan merespon resolusi HTTP dengan normal")
            if not meta["lexicon_hits"]:
                reasons.append("tidak ada leksikon berbahaya")
                
            reason_text = f"URL dikategorikan aman karena " + " dan ".join(reasons) + f". Skor risiko Char-BiLSTM rendah ({p_bilstm:.4f})."
            risk_score = min(p_bilstm, 0.20)

        # Format Qwen2.5 Chat Template JSON
        prompt_entry = {
            "messages": [
                {
                    "role": "system",
                    "content": "Anda adalah Agent Keamanan Siber 'Human Firewall'. Analisis metadata URL dan berikan keputusan serta alasan logis dalam format JSON."
                },
                {
                    "role": "user",
                    "content": (
                        f"Analisis URL berikut:\n"
                        f"- URL: {url}\n"
                        f"- Registered Domain: {registered_domain}\n"
                        f"- Char-BiLSTM Score: {p_bilstm:.4f}\n"
                        f"- TLD: {meta['tld']}\n"
                        f"- Status Domain Aktif: {'Ya' if meta['is_domain_active'] else 'Tidak / Unreachable'}\n"
                        f"- Protocol HTTPS: {'Ya' if meta['has_ssl'] else 'Tidak'}\n"
                        f"- Indikator Leksikon: {meta['lexicon_hits'] if meta['lexicon_hits'] else 'Tidak Ada'}"
                    )
                },
                {
                    "role": "assistant",
                    "content": json.dumps({
                        "reasoning": reason_text,
                        "verdict": verdict,
                        "risk_score": round(risk_score, 4),
                        "category": risk_category,
                        "is_live_domain": meta["is_domain_active"]
                    }, ensure_ascii=False)
                }
            ]
        }
        dataset_entries.append(prompt_entry)

        if (idx + 1) % 100 == 0 or (idx + 1) == len(sampled_df):
            print(f"Selesai memproses {idx + 1}/{len(sampled_df)} URL...")

    # Simpan ke JSONL
    OUTPUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSONL, "w", encoding="utf-8") as f:
        for item in dataset_entries:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"\n[SELESAI] Berhasil menyimpan {len(dataset_entries)} sampel SFT dari URL-AF ke '{OUTPUT_JSONL.resolve()}'!")

if __name__ == "__main__":
    generate_sft_dataset(max_samples=1000)