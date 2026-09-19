# Panduan Integrasi Machine Learning (ML URL Verdict Service)

Dokumen ini ditujukan untuk developer / rekan tim yang bertugas membangun modul **Machine Learning (ML)** untuk penentuan verdict domain/URL (apakah aman atau berbahaya) pada platform AFFERENT.

---

## 1. Arsitektur & Cara Kerja Integrasi

Terdapat dua mode integrasi yang didukung AFFERENT:

```
[Mode 1: Sinkron / Real-time Scan]
Browser / User → Squid Proxy → AFFERENT Backend → [POST ML_SCANNER_URL] → ML Service
                                              ← [JSON Verdict Response] ←

[Mode 2: Asinkron / Callback Webhook]
ML Service (Batch/Deep Scan) → [POST /api/proxy/ml/verdict] → AFFERENT Backend → Cache & Update SOC
```

---

## 2. Kontrak API: Mode 1 (Sinkron / Real-Time Scanner)

Jika ML dibangun sebagai REST service yang siap menerima query URL real-time dari backend:

### Endpoint di sisi ML Service:
* **Method**: `POST`
* **URL**: Dikonfigurasi di `.env` backend melalui variable `ML_SCANNER_URL` (misal: `http://ml_service:8000/scan`)
* **Headers**:
  * `Content-Type`: `application/json`
  * `X-Afferent-Signature`: `sha256=<HMAC-SHA256 signature payload menggunakan ML_WEBHOOK_SECRET>`
  * `X-Afferent-Schema-Version`: `1.0`
  * `Idempotency-Key`: `<UUID event>`

### Request Payload yang dikirim AFFERENT ke ML Service:
```json
{
  "schemaVersion": "1.0",
  "eventId": "c7a8b9c0-1234-5678-90ab-cdef12345678",
  "requestId": "c7a8b9c0-1234-5678-90ab-cdef12345678",
  "domain": "contoh-phishing.com",
  "observedAt": "2026-09-19T11:20:00.000Z"
}
```

### Response yang Diharapkan dari ML Service:
* **HTTP Status**: `200 OK`
* **Response Body**:
```json
{
  "verdict": "malicious",
  "confidence": 0.94,
  "reason": "Domain memiliki kemiripan leksikal tinggi dengan target perbankan (typosquatting)",
  "modelVersion": "phish-detect-v1.0"
}
```

#### Aturan Field Response:
1. `verdict`: Hanya boleh bernilai salah satu dari:
   * `"safe"`: Domain aman (diizinkan).
   * `"malicious"`: Domain berbahaya / phishing (akan memicu policy block atau alert).
   * `"unknown"`: Model tidak yakin / confidence di bawah ambang batas (diizinkan sementara dengan passive monitoring).
2. `confidence`: Angka float `0.0` sampai `1.0`.
   * Default backend: jika `verdict == "malicious"` dan `confidence >= 0.85`, backend otomatis membuat verdict `block`.
   * Jika `confidence < 0.85`, backend memperlakukan sebagai `unknown` dan menerbitkan alert di antrian SOC.
3. `reason`: String alasan / penjelasan singkat fitur yang memicu hasil model (maks 1000 karakter).
4. `modelVersion`: String versi model yang digunakan (maks 120 karakter).

---

## 3. Kontrak API: Mode 2 (Asinkron / Callback Webhook ke AFFERENT)

Jika ML melakukan background scanning / pipeline analisis yang memakan waktu (misal: scraping konten HTML, OCR, atau deep sandboxing), ML service dapat mengirimkan verdict balik ke backend AFFERENT kapan saja secara asinkron.

### Endpoint AFFERENT Backend:
* **Method**: `POST`
* **URL**: `http://<IP_HOST_ATAU_DOCKER>:5000/api/proxy/ml/verdict`
* **Headers**:
  * `Content-Type`: `application/json`
  * `X-Afferent-Signature`: `sha256=<HMAC-SHA256 signature payload>` (Wajib)

### Format Pembuatan Signature (`X-Afferent-Signature`):
```python
import hmac, hashlib, json

payload_bytes = json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8")
signature = "sha256=" + hmac.new(
    ML_WEBHOOK_SECRET.encode("utf-8"),
    payload_bytes,
    hashlib.sha256
).hexdigest()
```

### Request Body ke Webhook:
```json
{
  "schemaVersion": "1.0",
  "eventId": "c7a8b9c0-1234-5678-90ab-cdef12345678",
  "domain": "contoh-phishing.com",
  "verdict": "malicious",
  "confidence": 0.92,
  "reason": "Deteksi form login palsu dan sertifikat mencurigakan",
  "modelVersion": "deep-phish-v2.1"
}
```

---

## 4. Environment Variables yang Perlu Dikonfigurasi

Di file `.env` (atau `.env.proxy.local`):

| Variable | Fungsi | Default / Contoh |
|---|---|---|
| `ML_SCANNER_URL` | URL endpoint ML Service (Mode 1). Kosongkan jika ML belum aktif (fail-open passive mode). | `http://ml-scanner:8000/scan` |
| `ML_WEBHOOK_SECRET` | Shared secret HMAC-SHA256 antara backend dan ML service. | String acak rahasia |
| `ML_SCANNER_TIMEOUT_SECONDS` | Batas timeout toleransi backend menunggu respon ML. | `1.5` detik |
| `ML_BLOCK_CONFIDENCE_THRESHOLD`| Ambang minimal confidence untuk auto-block. | `0.85` |
| `ML_ALLOW_CONFIDENCE_THRESHOLD`| Ambang minimal confidence untuk auto-allow. | `0.80` |

---

## 5. Mock Server / Template Cepat untuk Memulai (FastAPI)

Rekan tim Anda dapat langsung menjalankan template minimal ini menggunakan Python + FastAPI:

```python
from fastapi import FastAPI, Header, HTTPException, Request
import hmac, hashlib

app = FastAPI(title="AFFERENT ML URL Scanner")
SHARED_SECRET = "Rq8Zx3Lm7Pn2Vy6Ks9Hd4WcF"  # Samakan dengan ML_WEBHOOK_SECRET di .env.proxy.local

@app.post("/scan")
async def scan_domain(request: Request, x_afferent_signature: str = Header(None)):
    raw_body = await request.body()
    
    # 1. Validasi Signature HMAC
    expected_sig = "sha256=" + hmac.new(SHARED_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, x_afferent_signature or ""):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    payload = await request.json()
    domain = payload.get("domain", "")

    # 2. Logika Model ML (ganti dengan model prediksi Anda)
    # Contoh demo sederhana:
    is_phishing = any(bad in domain for bad in ["phish", "login-fake", "bank-secure", "verify-account"])
    
    if is_phishing:
        return {
            "verdict": "malicious",
            "confidence": 0.95,
            "reason": f"Terdeteksi kata kunci mencurigakan pada domain: {domain}",
            "modelVersion": "heuristic-demo-v1.0"
        }
    else:
        return {
            "verdict": "safe",
            "confidence": 0.88,
            "reason": "Tidak ditemukan indikator ancaman pada reputasi domain",
            "modelVersion": "heuristic-demo-v1.0"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

