import os
import base64
import requests

VT_API_KEY = os.getenv("VT_API_KEY")
URLSCAN_API_KEY = os.getenv("URLSCAN_API_KEY")

VT_BASE_URL = "https://www.virustotal.com/api/v3/urls"
URLSCAN_SEARCH_URL = "https://urlscan.io/api/v1/search/"


# ==========================================================
# VirusTotal
# ==========================================================

def encode_vt_url(url: str) -> str:
    """
    Encode URL sesuai spesifikasi VirusTotal API v3.
    """
    return base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")


def scan_virustotal(url: str):

    headers = {
        "x-apikey": VT_API_KEY
    }

    url_id = encode_vt_url(url)

    response = requests.get(
        f"{VT_BASE_URL}/{url_id}",
        headers=headers,
        timeout=30
    )
    print("=" * 60)
    print("VirusTotal Status :", response.status_code)
    print("VirusTotal Response:")
    print(response.text)
    print("=" * 60)
    if response.status_code != 200:
        return {
            "success": False,
            "provider": "virustotal",
            "status_code": response.status_code,
            "data": None
        }

    return {
        "success": True,
        "provider": "virustotal",
        "status_code": 200,
        "data": response.json()
    }


def normalize_virustotal(result):

    if not result["success"]:
        return None

    data = result["data"]["data"]["attributes"]

    stats = data["last_analysis_stats"]

    malicious = stats.get("malicious", 0)
    suspicious = stats.get("suspicious", 0)
    harmless = stats.get("harmless", 0)

    total = malicious + suspicious + harmless

    if malicious > 0:
        verdict = "malicious"
        severity = "high"

    elif suspicious > 0:
        verdict = "suspicious"
        severity = "medium"

    else:
        verdict = "clean"
        severity = "low"

    confidence = 0

    if total > 0:
        confidence = round(
            (harmless / total) * 100
        )

    return {

        "provider": "virustotal",

        "verdict": verdict,

        "severity": severity,

        "confidence": confidence,

        "vt_score": malicious,

        "raw": result["data"]

    }
# ==========================================================
# URLScan
# ==========================================================

def scan_urlscan(url):

    headers = {
        "API-Key": URLSCAN_API_KEY
    }

    response = requests.get(

        URLSCAN_SEARCH_URL,

        params={
            "q": f'page.url:"{url}"'
        },

        headers=headers,

        timeout=30

    )

    if response.status_code != 200:

        return {

            "success": False,

            "provider": "urlscan",

            "status_code": response.status_code,

            "data": None

        }

    return {

        "success": True,

        "provider": "urlscan",

        "status_code": 200,

        "data": response.json()

    }
# ==========================================================
# Threat Decision Engine
# ==========================================================

def build_threat_decision(vt_result):

    if vt_result is None:

        return {

            "verdict": "unknown",

            "severity": "unknown",

            "confidence": 0,

            "recommendation": "Unable to analyze indicator."

        }

    verdict = vt_result["verdict"]

    severity = vt_result["severity"]

    confidence = vt_result["confidence"]

    if verdict == "malicious":

        recommendation = "Block"

    elif verdict == "suspicious":

        recommendation = "Review"

    elif verdict == "clean":

        recommendation = "Allow"

    else:

        recommendation = "Unknown"

    return {

        "verdict": verdict,

        "severity": severity,

        "confidence": confidence,

        "recommendation": recommendation

    }
# ==========================================================
# URLScan Normalizer
# ==========================================================

def normalize_urlscan(result):

    if result is None:
        return None

    if not result["success"]:
        return None

    data = result["data"]

    total = data.get("total", 0)

    if total == 0:

        return {

            "provider": "urlscan",

            "verdict": "clean",

            "severity": "low",

            "confidence": 100,

            "urlscan_score": 0,

            "raw": data

        }

    return {

        "provider": "urlscan",

        "verdict": "suspicious",

        "severity": "medium",

        "confidence": 80,

        "urlscan_score": total,

        "raw": data

    }
# ==========================================================
# Merge Analysis
# ==========================================================

def merge_analysis(vt, urlscan):

    providers = []

    evidence = {}

    verdict = "clean"

    severity = "low"

    recommendation = "Allow"

    confidence = []

    if vt:

        providers.append("virustotal")

        evidence["virustotal"] = vt

        confidence.append(vt["confidence"])

        if vt["verdict"] == "malicious":

            verdict = "malicious"

            severity = "high"

            recommendation = "Block"

        elif vt["verdict"] == "suspicious":

            verdict = "suspicious"

            severity = "medium"

            recommendation = "Review"

    else:

        evidence["virustotal"] = None

    if urlscan:

        providers.append("urlscan")

        evidence["urlscan"] = urlscan

        confidence.append(urlscan["confidence"])

    else:

        evidence["urlscan"] = None

    avg = round(sum(confidence) / len(confidence)) if confidence else 0

    return {

        "providers": providers,

        "verdict": verdict,

        "severity": severity,

        "confidence": avg,

        "recommendation": recommendation,

        "evidence": evidence

    }