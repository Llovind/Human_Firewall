"""
Template Mock Service untuk Pengujian Integrasi ML URL Scanner dengan AFFERENT Backend.

Cara menjalankan:
  pip install fastapi uvicorn
  python mock_ml_service.py
"""

from fastapi import FastAPI, Header, HTTPException, Request
import hmac
import hashlib
import os

app = FastAPI(title="AFFERENT ML URL Scanner Mock")

# Samakan secret ini dengan ML_WEBHOOK_SECRET yang ada di .env / .env.proxy.local backend
SHARED_SECRET = os.environ.get("ML_WEBHOOK_SECRET", "Rq8Zx3Lm7Pn2Vy6Ks9Hd4WcF")


@app.post("/scan")
async def scan_domain(request: Request, x_afferent_signature: str = Header(None)):
    raw_body = await request.body()

    # 1. Validasi Autentikasi HMAC Signature
    expected_sig = "sha256=" + hmac.new(SHARED_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, x_afferent_signature or ""):
        raise HTTPException(status_code=401, detail="Invalid X-Afferent-Signature")

    payload = await request.json()
    domain = payload.get("domain", "")

    # 2. Logika Prediksi / Model Machine Learning
    # TODO: Ganti bagian ini dengan load model (e.g. PyTorch, scikit-learn, XGBoost, ONNX)
    malicious_indicators = ["phish", "fakelogin", "secure-bank", "account-update", "verification-login"]
    is_malicious = any(indicator in domain.lower() for indicator in malicious_indicators)

    if is_malicious:
        return {
            "verdict": "malicious",
            "confidence": 0.95,
            "reason": f"Model mendeteksi pola phishing/typosquatting pada domain: {domain}",
            "modelVersion": "mock-model-v1.0"
        }
    elif "test-unknown" in domain.lower():
        return {
            "verdict": "unknown",
            "confidence": 0.40,
            "reason": "Skor confidence fitur leksikal tidak konklusif",
            "modelVersion": "mock-model-v1.0"
        }
    else:
        return {
            "verdict": "safe",
            "confidence": 0.91,
            "reason": "Fitur reputasi dan struktur leksikal tergolong aman",
            "modelVersion": "mock-model-v1.0"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

