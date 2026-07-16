from flask import Blueprint, render_template, request, redirect, url_for
import os
import database
from services.threat_service import analyze_indicator

proxy_bp = Blueprint("proxy", __name__)


@proxy_bp.route("/visit")
def visit():
    return render_template("visit.html")


@proxy_bp.route("/go", methods=["GET", "POST"])
def go():
    # Support both GET (?url=...) and POST (form data)
    url = request.values.get("url", "").strip()

    if not url:
        return render_template("visit.html", error="URL wajib diisi.")

    # Normalize scheme — ensure URL has http:// or https://
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "http://" + url

    # DNS Pre-flight Check
    import socket
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return render_template("visit.html", error="Format URL tidak valid.")
        socket.gethostbyname(hostname)
    except socket.gaierror:
        return render_template("visit.html", error=f"Situs tidak dapat dijangkau: Domain '{hostname}' tidak terdaftar atau tidak memiliki catatan DNS di internet.")
    except Exception:
        pass

    result = analyze_indicator(url)
    action = result["policy"]["action"]

    if action == "allow":
        return redirect(url)

    # Blocked or review — redirect to blocked page with URL context
    from urllib.parse import quote
    return redirect(f"/blocked?url={quote(url, safe='')}")


@proxy_bp.route("/blocked")
def blocked():
    url = request.args.get("url", "")

    # Fetch threat details from cache for display
    threat_data = {}
    if url:
        cache = database.get_cached_indicator(url)
        if cache:
            cache = dict(cache)
            # Determine threat type from verdict/source
            threat_type = "Phishing"
            verdict = cache.get("verdict", "unknown")
            if verdict == "malicious":
                threat_type = "Credential Harvesting"
            elif verdict == "suspicious":
                threat_type = "Suspicious Activity"

            # Determine detection engine from source field
            source = cache.get("source", "")
            engines = []
            if "virustotal" in source.lower() or "vt" in source.lower():
                engines.append("VirusTotal")
            if "urlscan" in source.lower():
                engines.append("URLScan")
            if "infranexia" in source.lower() or "gophish" in source.lower():
                engines.append("Infranexia Simulator")
            if not engines:
                engines = [source] if source else ["Threat Intelligence"]

            # Calculate threat score from VT and URLScan scores
            vt_score = cache.get("vt_score", 0) or 0
            urlscan_score = cache.get("urlscan_score", 0) or 0
            threat_score = max(vt_score, urlscan_score)
            if threat_score == 0 and verdict == "malicious":
                threat_score = 95  # Internal detection high confidence

            threat_data = {
                "url": url,
                "engine": " + ".join(engines),
                "threat_type": threat_type,
                "cache_id": f"TC-{cache.get('id', '0000')}",
                "threat_score": threat_score,
                "severity": cache.get("severity", "high"),
                "verdict": verdict,
                "confidence": cache.get("confidence", 0),
            }
        else:
            # No cache entry — generic block info
            threat_data = {
                "url": url,
                "engine": "Threat Intelligence",
                "threat_type": "Suspicious Activity",
                "cache_id": "TC-PENDING",
                "threat_score": 75,
                "severity": "high",
                "verdict": "suspicious",
                "confidence": 0,
            }

    return render_template("blocked.html", threat=threat_data)