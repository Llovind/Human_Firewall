"""
seed_threat_cache.py — Pre-warm threat_cache dengan URL dan file demo untuk HackNusa.
Menandai source="demo_seed" sehingga respons instan (<50ms) dan menampilkan badge 'cached'.
"""

import os
import sys
from datetime import datetime, timedelta, timezone

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import database


DEMO_INDICATORS = [
    {
        "indicator": "https://internal.telkom.co.id/portal",
        "indicator_type": "url",
        "source": "demo_seed,urlscan,VirusTotal",
        "verdict": "safe",
        "severity": "low",
        "confidence": 95,
        "vt_score": 0,
        "urlscan_score": 0,
        "raw_json": '{"provider": "demo_seed", "note": "Verified legitimate internal portal"}',
    },
    {
        "indicator": "https://portal-payroll-sso.xyz/login",
        "indicator_type": "url",
        "source": "demo_seed,urlscan",
        "verdict": "suspicious",
        "severity": "medium",
        "confidence": 55,
        "vt_score": 2,
        "urlscan_score": 55,
        "raw_json": '{"provider": "demo_seed", "note": "Moderate risk credential lure — triggers 2D Policy divergence between Sentinel and Vulnerable"}',
    },
    {
        "indicator": "https://finance-urgent-invoice.top/update.exe",
        "indicator_type": "url",
        "source": "demo_seed,VirusTotal",
        "verdict": "malicious",
        "severity": "high",
        "confidence": 95,
        "vt_score": 19,
        "urlscan_score": 92,
        "raw_json": '{"provider": "demo_seed", "note": "Confirmed malicious ransomware dropper executable"}',
    },
    {
        "indicator": "eicar_test.txt",
        "indicator_type": "file",
        "source": "demo_seed,VirusTotal",
        "verdict": "malicious",
        "severity": "high",
        "confidence": 100,
        "vt_score": 67,
        "urlscan_score": 0,
        "raw_json": '{"provider": "demo_seed", "note": "Standard European Anti-Virus test file signature"}',
    },
]


def seed_threat_cache():
    conn = database.get_connection()
    cursor = conn.cursor()
    far_future = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()

    print("[*] Pre-warming threat_cache dengan demo seed indicators...")
    count = 0
    for item in DEMO_INDICATORS:
        norm = database.normalize_indicator(item["indicator"])
        h = database.hash_indicator(norm)
        cursor.execute("""
            INSERT OR REPLACE INTO threat_cache (
                indicator,
                indicator_hash,
                indicator_type,
                source,
                verdict,
                confidence,
                severity,
                vt_score,
                urlscan_score,
                raw_json,
                expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            norm,
            h,
            item["indicator_type"],
            item["source"],
            item["verdict"],
            item["confidence"],
            item["severity"],
            item["vt_score"],
            item["urlscan_score"],
            item["raw_json"],
            far_future,
        ))
        count += 1
        print(f"  [+] Seeded: {norm} -> {item['verdict'].upper()} (source={item['source']})")

    conn.commit()
    conn.close()
    print(f"[OK] Berhasil menyuntikkan {count} demo indicators ke threat_cache.")


if __name__ == "__main__":
    seed_threat_cache()
