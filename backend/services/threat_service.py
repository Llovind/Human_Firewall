import database
import integrations
import policy
import incident


def analyze_indicator(indicator):

    indicator = database.normalize_indicator(indicator)

    # =====================================================
    # CACHE LOOKUP
    # =====================================================

    cache = database.get_cached_indicator(indicator)

    if cache:

        analysis = {

            "providers": cache["source"].split(","),

            "verdict": cache["verdict"],

            "severity": cache["severity"],

            "confidence": cache["confidence"],

            "recommendation": (

                "Block"

                if cache["severity"] == "high"

                else "Review"

                if cache["severity"] == "medium"

                else "Allow"

            )

        }

        policy_result = policy.evaluate(analysis)

        return {

            "cache_hit": True,

            "analysis": analysis,

            "policy": policy_result

        }

    # =====================================================
    # VIRUSTOTAL
    # =====================================================

    vt_raw = integrations.scan_virustotal(indicator)
    print("="*60)
    print("VT RAW")
    print(vt_raw)
    print("="*60)
    vt = integrations.normalize_virustotal(vt_raw)
    print("="*60)
    print("VT NORMALIZED")
    print(vt)
    print("="*60)

    # =====================================================
    # URLSCAN
    # =====================================================

    urlscan_raw = integrations.scan_urlscan(indicator)

    urlscan = integrations.normalize_urlscan(urlscan_raw)

    # =====================================================
    # MERGE ANALYSIS
    # =====================================================

    analysis = integrations.merge_analysis(

        vt,

        urlscan

    )

    # =====================================================
    # POLICY ENGINE
    # =====================================================

    policy_result = policy.evaluate(analysis)

    # =====================================================
    # SAVE CACHE
    # =====================================================

    database.save_threat_cache(

        indicator,

        "url",

        analysis

    )

    # =====================================================
    # INCIDENT + N8N
    # =====================================================

    if policy_result["action"] == "block":

        ticket_id = incident.create_incident(

            indicator,

            analysis

        )

        incident.send_to_n8n(

            ticket_id,

            indicator,

            analysis

        )

    # =====================================================
    # RETURN
    # =====================================================

    return {

        "cache_hit": False,

        "analysis": analysis,

        "policy": policy_result

    }