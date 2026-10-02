import os
import base64
import requests

VT_API_KEY = os.getenv("VT_API_KEY")
URLSCAN_API_KEY = os.getenv("URLSCAN_API_KEY")

VT_BASE_URL = "https://www.virustotal.com/api/v3/urls"
URLSCAN_SEARCH_URL = "https://urlscan.io/api/v1/search/"


# Domain reputation — lazy import to avoid circular dependency
def _get_domain_rep(url: str):
    try:
        import domain_reputation
        return domain_reputation.check_domain_reputation(url)
    except Exception as e:
        print(f"[DomainRep] Could not check reputation: {e}")
        return None


# ==========================================================
# VirusTotal
# ==========================================================

def encode_vt_url(url: str) -> str:
    """
    Encode URL sesuai spesifikasi VirusTotal API v3.
    """
    return base64.urlsafe_b64encode(url.encode()).decode().rstrip("=")


def scan_virustotal(url: str):
    if not VT_API_KEY:
        return {
            "success": False,
            "provider": "virustotal",
            "status_code": 503,
            "error": "VT_API_KEY not configured",
            "data": None
        }

    headers = {
        "x-apikey": VT_API_KEY
    }

    url_id = encode_vt_url(url)

    try:
        response = requests.get(
            f"{VT_BASE_URL}/{url_id}",
            headers=headers,
            timeout=8
        )
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "provider": "virustotal",
            "status_code": 408,
            "error": "Timeout querying VirusTotal API",
            "data": None
        }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "provider": "virustotal",
            "status_code": 502,
            "error": f"Network error connecting to VirusTotal: {str(e)}",
            "data": None
        }

    if response.status_code != 200:
        return {
            "success": False,
            "provider": "virustotal",
            "status_code": response.status_code,
            "error": "Rate limit exceeded (429)" if response.status_code == 429 else f"HTTP {response.status_code}",
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
    if not URLSCAN_API_KEY:
        return {
            "success": False,
            "provider": "urlscan",
            "status_code": 503,
            "error": "URLSCAN_API_KEY not configured",
            "data": None
        }

    headers = {
        "API-Key": URLSCAN_API_KEY
    }

    try:
        response = requests.get(
            URLSCAN_SEARCH_URL,
            params={
                "q": f'page.url:"{url}"'
            },
            headers=headers,
            timeout=8
        )
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "provider": "urlscan",
            "status_code": 408,
            "error": "Timeout querying urlscan.io API",
            "data": None
        }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "provider": "urlscan",
            "status_code": 502,
            "error": f"Network error connecting to urlscan.io: {str(e)}",
            "data": None
        }

    if response.status_code != 200:
        return {
            "success": False,
            "provider": "urlscan",
            "status_code": response.status_code,
            "error": "Rate limit exceeded (429)" if response.status_code == 429 else f"HTTP {response.status_code}",
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
# Char-BiLSTM Deep Learning Scanner (Afferent v5)
# ==========================================================

def scan_char_bilstm(url: str):
    """Scan a URL using local Char-BiLSTM deep learning model."""
    try:
        import char_bilstm_scanner
        return char_bilstm_scanner.scan_url_dl(url)
    except Exception as e:
        print(f"[Char-BiLSTM] Integration scan error: {e}")
        return None


# ==========================================================
# Merge Analysis
# ==========================================================

def merge_analysis(vt, urlscan, char_bilstm=None, url: str = ""):
    """
    Merge results from all providers with domain-reputation-aware weighting.

    Decision priority:
      Tier 1 trusted domain  → DL suppressed; VT/URLScan is authoritative.
      Tier 2 institutional   → DL confidence penalised ×0.3; VT cross-validates.
      Suspicious TLD         → DL confidence amplified (×1.3, capped at 100).
      Unknown domain         → DL at full weight; all providers merged equally.
    """

    providers = []
    evidence = {}
    verdict = "clean"
    severity = "low"
    recommendation = "Allow"
    confidence = []

    # ------------------------------------------------------------------
    # 0. Domain Reputation Pre-Check
    # ------------------------------------------------------------------
    domain_rep = _get_domain_rep(url) if url else None
    dl_weight = domain_rep["dl_weight"] if domain_rep else 1.0
    domain_trusted = domain_rep["trusted"] if domain_rep else False
    evidence["domain_reputation"] = domain_rep

    # ------------------------------------------------------------------
    # 1. Char-BiLSTM Deep Learning Model
    # ------------------------------------------------------------------
    if char_bilstm:
        providers.append("char_bilstm")

        # Apply domain-reputation weighting to DL confidence
        raw_conf = char_bilstm.get("confidence", 0)
        raw_p_mal = char_bilstm.get("p_malicious", 0.0)
        adj_conf = int(min(100, raw_conf * dl_weight))
        adj_p_mal = min(1.0, raw_p_mal * dl_weight)

        # Recalculate DL verdict based on adjusted p_malicious
        thr_block  = char_bilstm.get("thresholds", {}).get("block_auto",   0.95)
        thr_review = char_bilstm.get("thresholds", {}).get("block_review", 0.70)

        if adj_p_mal >= thr_block:
            dl_verdict   = "malicious"
            dl_severity  = "high"
            dl_recommend = "Block"
        elif adj_p_mal >= thr_review:
            dl_verdict   = "suspicious"
            dl_severity  = "medium"
            dl_recommend = "Review"
        else:
            dl_verdict   = "clean"
            dl_severity  = "low"
            dl_recommend = "Allow"

        # Annotate the char_bilstm evidence with adjusted values
        annotated = dict(char_bilstm)
        annotated["adj_confidence"]  = adj_conf
        annotated["adj_p_malicious"] = round(adj_p_mal, 4)
        annotated["adj_verdict"]     = dl_verdict
        annotated["dl_weight"]       = dl_weight
        evidence["char_bilstm"] = annotated

        # Only escalate overall verdict if DL model is not suppressed
        if dl_weight > 0.0:
            confidence.append(adj_conf)
            if dl_verdict == "malicious":
                verdict = "malicious"
                severity = "high"
                recommendation = "Block"
            elif dl_verdict == "suspicious" and verdict != "malicious":
                verdict = "suspicious"
                severity = "medium"
                recommendation = "Review"
        else:
            # dl_weight == 0.0 means Tier 1 trusted domain — DL verdict ignored
            print(f"[MergeAnalysis] DL verdict suppressed (trusted domain). DL said: {char_bilstm.get('verdict')}")
    else:
        evidence["char_bilstm"] = None

    # ------------------------------------------------------------------
    # 2. VirusTotal (authoritative for trusted domains)
    # ------------------------------------------------------------------
    if vt:
        providers.append("virustotal")
        evidence["virustotal"] = vt
        confidence.append(vt["confidence"])

        if vt["verdict"] == "malicious":
            verdict = "malicious"
            severity = "high"
            recommendation = "Block"
        elif vt["verdict"] == "suspicious" and verdict != "malicious":
            verdict = "suspicious"
            severity = "medium"
            if recommendation != "Block":
                recommendation = "Review"
        elif vt["verdict"] == "clean" and domain_trusted:
            # VT says clean AND domain is trusted → downgrade any DL-driven escalation
            if verdict in ("suspicious", "malicious"):
                print(f"[MergeAnalysis] VT clean + trusted domain → downgrading verdict from '{verdict}' to 'clean'")
                verdict       = "clean"
                severity      = "low"
                recommendation = "Allow"
    else:
        evidence["virustotal"] = None
        # If no VT data and domain is trusted → still allow (benefit of the doubt)
        if domain_trusted and verdict in ("suspicious", "malicious"):
            print(f"[MergeAnalysis] No VT data but domain is trusted → downgrading verdict from '{verdict}' to 'clean'")
            verdict        = "clean"
            severity       = "low"
            recommendation = "Allow"

    # ------------------------------------------------------------------
    # 3. URLScan
    # ------------------------------------------------------------------
    if urlscan:
        providers.append("urlscan")
        evidence["urlscan"] = urlscan
        confidence.append(urlscan["confidence"])
        if urlscan.get("verdict") == "malicious":
            verdict = "malicious"
            severity = "high"
            recommendation = "Block"
        elif urlscan.get("verdict") == "suspicious" and verdict != "malicious":
            verdict = "suspicious"
            if severity != "high":
                severity = "medium"
            if recommendation != "Block":
                recommendation = "Review"
    else:
        evidence["urlscan"] = None

    avg = round(sum(confidence) / len(confidence)) if confidence else 0

    return {
        "providers": providers,
        "verdict": verdict,
        "severity": severity,
        "confidence": avg,
        "recommendation": recommendation,
        "evidence": evidence,
        "domain_reputation": domain_rep,
    }
