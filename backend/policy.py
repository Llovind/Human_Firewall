"""
Adaptive Policy Decision Engine
Afferent Platform
2D Adaptive Decision Matrix: Threat Severity × Employee Vulnerability Tier
"""

ALLOW = "allow"
WARNING = "warning"
BLOCK = "block"
NOTIFY_SOC = "notify_soc"


def evaluate_2d(threat_score: int, user_tier: str = "Guardian", verdict: str = "unknown") -> dict:
    """
    2D Adaptive Policy Decision Matrix:
    - BLOCK (Red): Threat Score >= 75 OR (Threat Score >= 50 AND User Tier == 'Vulnerable')
    - WARN & MANDATE (Amber): Threat Score 40-74 AND User Tier == 'Guardian' (or moderate risk)
    - ALLOW & AUDIT (Green): Threat Score < 40 AND User Tier == 'Sentinel' (or clean reputation)
    """
    tier_normalized = (user_tier or "Guardian").strip().capitalize()
    threat_score = max(0, min(100, int(threat_score or 0)))

    # BLOCK condition
    if threat_score >= 75 or (threat_score >= 50 and tier_normalized == "Vulnerable") or verdict == "malicious":
        if tier_normalized == "Vulnerable" and threat_score < 75:
            reason = f"Automated block triggered: Moderate threat score ({threat_score}) elevated due to employee Vulnerable risk tier."
        else:
            reason = f"Automated block: Critical threat severity ({threat_score}/100) detected across threat feeds."
        return {
            "action": BLOCK,
            "threatScore": threat_score,
            "userTier": tier_normalized,
            "reason": reason
        }

    # WARN & MANDATE condition
    if (40 <= threat_score < 75 and tier_normalized == "Guardian") or (40 <= threat_score < 50 and tier_normalized == "Vulnerable") or (threat_score >= 50 and tier_normalized in ("Sentinel", "Champion")):
        if tier_normalized == "Guardian":
            reason = f"Access warning enforced: Threat score ({threat_score}) requires step-up verification and training mandate for Guardian tier."
        elif tier_normalized in ("Sentinel", "Champion"):
            reason = f"Security checkpoint: Elevated threat score ({threat_score}) requires Sentinel acknowledgement before proceeding."
        else:
            reason = f"Warning issued: Threat score ({threat_score}) requires security confirmation."
        return {
            "action": WARNING,
            "threatScore": threat_score,
            "userTier": tier_normalized,
            "reason": reason
        }

    # ALLOW & AUDIT condition
    if threat_score < 40 or verdict == "safe":
        reason = f"Access permitted: Low risk threat score ({threat_score}) verified safe for {tier_normalized} tier."
        return {
            "action": ALLOW,
            "threatScore": threat_score,
            "userTier": tier_normalized,
            "reason": reason
        }

    # Fallback review
    return {
        "action": WARNING,
        "threatScore": threat_score,
        "userTier": tier_normalized,
        "reason": f"Adaptive policy review: Moderate indicator score ({threat_score}) audited for {tier_normalized} tier."
    }


def evaluate(analysis: dict, user_tier: str = "Guardian") -> dict:
    """Legacy backward-compatible evaluate adapter that uses 2D matrix."""
    confidence = analysis.get("confidence", 0)
    verdict = analysis.get("verdict", "unknown")
    vt_score = analysis.get("evidence", {}).get("virustotal", {}).get("vt_score", 0) if isinstance(analysis.get("evidence"), dict) else 0
    urlscan_score = analysis.get("evidence", {}).get("urlscan", {}).get("urlscan_score", 0) if isinstance(analysis.get("evidence"), dict) else 0

    threat_score = max(confidence, vt_score * 5, urlscan_score)
    res = evaluate_2d(threat_score=threat_score, user_tier=user_tier, verdict=verdict)
    res["confidence"] = confidence
    res["verdict"] = verdict
    res["severity"] = analysis.get("severity", "medium")
    return res