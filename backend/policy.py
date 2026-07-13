"""
Policy Decision Engine
Human Firewall
"""

ALLOW = "allow"
REVIEW = "review"
BLOCK = "block"


def evaluate(analysis: dict):

    recommendation = analysis.get(
        "recommendation",
        "Review"
    )

    verdict = analysis.get(
        "verdict",
        "unknown"
    )

    severity = analysis.get(
        "severity",
        "unknown"
    )

    confidence = analysis.get(
        "confidence",
        0
    )

    # =====================================
    # BLOCK
    # =====================================

    if recommendation == "Block":

        return {

            "action": BLOCK,

            "reason": "Threat Intelligence marked as malicious.",

            "confidence": confidence,

            "severity": severity,

            "verdict": verdict

        }

    # =====================================
    # REVIEW
    # =====================================

    if recommendation == "Review":

        return {

            "action": REVIEW,

            "reason": "Manual review recommended.",

            "confidence": confidence,

            "severity": severity,

            "verdict": verdict

        }

    # =====================================
    # DEFAULT
    # =====================================

    return {

        "action": ALLOW,

        "reason": "Threat Intelligence marked as safe.",

        "confidence": confidence,

        "severity": severity,

        "verdict": verdict

    }