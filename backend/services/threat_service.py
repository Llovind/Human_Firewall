import os
import database
import integrations
import policy
import incident
from urllib.parse import urlparse, parse_qs


def _is_gophish_simulation(indicator: str) -> bool:
    """Detect if the URL belongs to our internal GoPhish phishing simulation.
    
    GoPhish campaign URLs typically contain a ?rid= parameter (recipient ID)
    and point to our own simulation server (WEBHOOK_URL or localhost:8080).
    """
    try:
        parsed = urlparse(indicator)
    except Exception:
        return False

    # Check for GoPhish ?rid= tracking parameter
    query_params = parse_qs(parsed.query)
    has_rid = "rid" in query_params

    # Check if the host matches our known simulation endpoints
    webhook_url = os.getenv("WEBHOOK_URL", "")
    gophish_hosts = {"localhost", "127.0.0.1", "hfl-gophish", "gophish"}

    # Add the WEBHOOK_URL hostname if configured
    if webhook_url:
        try:
            wh_parsed = urlparse(webhook_url)
            if wh_parsed.hostname:
                gophish_hosts.add(wh_parsed.hostname)
        except Exception:
            pass

    is_known_host = parsed.hostname in gophish_hosts if parsed.hostname else False

    # Match if: has ?rid= param AND points to known host,
    # OR just has ?rid= param (for tunnel URLs we haven't registered)
    return has_rid or is_known_host


def _build_gophish_analysis(indicator: str, user_tier: str = "Guardian") -> dict:
    """Build a synthetic analysis result for internal GoPhish simulation links."""
    pol = policy.evaluate_2d(threat_score=100, user_tier=user_tier, verdict="malicious")
    pol["confidence"] = 100
    pol["severity"] = "high"
    pol["verdict"] = "malicious"
    pol["comparative"] = {
        "Sentinel": policy.evaluate_2d(threat_score=100, user_tier="Sentinel", verdict="malicious"),
        "Guardian": policy.evaluate_2d(threat_score=100, user_tier="Guardian", verdict="malicious"),
        "Vulnerable": policy.evaluate_2d(threat_score=100, user_tier="Vulnerable", verdict="malicious"),
    }
    return {
        "cache_hit": False,
        "analysis": {
            "providers": ["Infranexia Phishing Simulator"],
            "verdict": "malicious",
            "severity": "high",
            "confidence": 100,
            "recommendation": "Block",
            "evidence": {
                "virustotal": {"vt_score": 0},
                "urlscan": {"urlscan_score": 0},
            },
        },
        "policy": pol,
    }


def analyze_indicator(indicator, is_scan=False, user_tier="Guardian"):

    indicator = database.normalize_indicator(indicator)

    # =====================================================
    # CACHE LOOKUP
    # =====================================================

    cache = database.get_cached_indicator(indicator)

    if cache:
        source_str = cache["source"] if "source" in cache and cache["source"] else "cached"
        analysis = {
            "providers": source_str.split(","),
            "source": source_str,
            "is_demo_seed": "demo_seed" in source_str,
            "verdict": cache["verdict"],
            "severity": cache["severity"],
            "confidence": cache["confidence"],
            "recommendation": (
                "Block"
                if cache["severity"] == "high"
                else "Review"
                if cache["severity"] == "medium"
                else "Allow"
            ),
        }

        policy_result = policy.evaluate(analysis, user_tier=user_tier)

        ticket_id = None
        if policy_result["action"] == "block" and is_scan:
            ticket_id = incident.create_incident(indicator, analysis)
            incident.send_to_n8n(ticket_id, indicator, analysis)

        if ticket_id:
            soc_status_msg = f"Dispatched to SOC (Ticket #{ticket_id})"
        else:
            soc_status_msg = None

        return {
            "cache_hit": True,
            "is_demo_seed": "demo_seed" in source_str,
            "analysis": analysis,
            "policy": policy_result,
            "ticket_id": ticket_id,
            "ticket_created": bool(ticket_id),
            "soc_status": soc_status_msg,
        }

    # =====================================================
    # INTERNAL GOPHISH SIMULATION DETECTOR
    # =====================================================
    # If the URL is from our own GoPhish simulation, we skip
    # external API calls (VT/URLScan would return clean anyway)
    # and directly mark it as malicious + cache it.
    # ONLY run this during active scan/report actions. Normal visits
    # should NOT be blocked unless they are a cache hit (reported).

    if is_scan and _is_gophish_simulation(indicator):
        result = _build_gophish_analysis(indicator, user_tier=user_tier)

        # Save to cache so future clicks are instantly blocked
        database.save_threat_cache(
            indicator,
            "url",
            result["analysis"],
        )

        # Create incident for dashboard visibility
        ticket_id = incident.create_incident(indicator, result["analysis"])
        incident.send_to_n8n(ticket_id, indicator, result["analysis"])

        result["ticket_id"] = ticket_id
        result["ticket_created"] = bool(ticket_id)
        result["soc_status"] = f"Dispatched to SOC (Ticket #{ticket_id})" if ticket_id else None

        return result

    # =====================================================
    # CHAR-BILSTM DEEP LEARNING (AFFERENT v5)
    # =====================================================

    char_bilstm = integrations.scan_char_bilstm(indicator)

    # =====================================================
    # VIRUSTOTAL
    # =====================================================

    vt_raw = integrations.scan_virustotal(indicator)
    vt = integrations.normalize_virustotal(vt_raw)

    # =====================================================
    # URLSCAN
    # =====================================================

    urlscan_raw = integrations.scan_urlscan(indicator)
    urlscan = integrations.normalize_urlscan(urlscan_raw)

    # Rate limit and timeout detection
    vt_status = vt_raw.get("status_code") if isinstance(vt_raw, dict) else None
    urlscan_status = urlscan_raw.get("status_code") if isinstance(urlscan_raw, dict) else None
    vt_rate_limited = vt_status in (429, 408)
    urlscan_rate_limited = urlscan_status in (429, 408)
    is_scanner_busy = vt_rate_limited or urlscan_rate_limited

    # =====================================================
    # MERGE ANALYSIS
    # =====================================================

    analysis = integrations.merge_analysis(vt, urlscan, char_bilstm=char_bilstm, url=indicator)
    analysis["scanner_busy"] = is_scanner_busy and (vt is None and urlscan is None and char_bilstm is None)

    # =====================================================
    # POLICY ENGINE
    # =====================================================

    policy_result = policy.evaluate(analysis, user_tier=user_tier)

    # =====================================================
    # SAVE CACHE
    # =====================================================

    if vt or urlscan:
        database.save_threat_cache(indicator, "url", analysis)

    # =====================================================
    # INCIDENT + N8N
    # =====================================================

    ticket_id = None
    if policy_result["action"] == "block":
        ticket_id = incident.create_incident(indicator, analysis)
        incident.send_to_n8n(ticket_id, indicator, analysis)

    # STRICT REQUIREMENT:
    # "pesan 'dispatched to SOC' hanya muncul kalau tiket benar-benar dibuat,
    # kalau tidak pakai 'scanner busy, retry'"
    if ticket_id:
        soc_status_msg = f"Dispatched to SOC (Ticket #{ticket_id})"
    elif is_scanner_busy:
        soc_status_msg = "Scanner busy, retry"
    else:
        soc_status_msg = None

    # =====================================================
    # RETURN
    # =====================================================

    return {
        "cache_hit": False,
        "is_demo_seed": False,
        "scanner_busy": analysis.get("scanner_busy", False),
        "analysis": analysis,
        "policy": policy_result,
        "ticket_id": ticket_id,
        "ticket_created": bool(ticket_id),
        "soc_status": soc_status_msg,
    }


def reconcile_report_source(url: str, verdict: str) -> str:
    """Reconcile whether a reported URL/indicator is an active GoPhish campaign,
    a real-world threat, or unverified.
    """
    import gophish_client

    # 1. First run the static simulation check
    is_sim = _is_gophish_simulation(url)

    # 2. Try verifying dynamically with GoPhish API if not already flagged statically
    if not is_sim:
        try:
            parsed_target = urlparse(url)
            target_host = parsed_target.hostname.lower() if parsed_target.hostname else ""

            if target_host:
                campaigns = gophish_client.get_campaigns()
                for c in campaigns:
                    # Match in-progress campaigns
                    if c.get("status") in ("In Progress", "active"):
                        c_url = c.get("url", "")
                        if c_url:
                            parsed_c = urlparse(c_url)
                            c_host = parsed_c.hostname.lower() if parsed_c.hostname else ""
                            if c_host == target_host:
                                is_sim = True
                                break
        except Exception as e:
            # Fallback quietly to static check if GoPhish is offline
            print(f"[Reconciliation] GoPhish API check failed, falling back to static check: {e}")

    # 3. Determine the source verdict
    if is_sim:
        return "simulation_correctly_reported"
    elif verdict in ("malicious", "suspicious"):
        return "real_threat"
    else:
        return "unverified"