from flask import Blueprint, request, jsonify
import integrations
import database
from security import current_identity, authenticate_session_request
from services.threat_service import analyze_indicator

threat_bp = Blueprint("threat", __name__)


@threat_bp.route("/api/threat/analyze", methods=["POST"])
def analyze_threat():

    body = request.get_json(silent=True)

    if body is None:
        return jsonify({
            "success": False,
            "error": "Request body harus berupa JSON."
        }), 400

    indicator = body.get("indicator")

    if not indicator:
        return jsonify({
            "success": False,
            "error": "Field 'indicator' wajib diisi."
        }), 400
    chat_id = body.get("chat_id")

    # SERVER-SIDE RESOLUTION: Resolve user tier strictly from authenticated session.
    # Never accept user_tier or tier from client request body or query params.
    identity = current_identity() or authenticate_session_request(request)
    user_tier = "Guardian"
    user_email = None

    if identity and getattr(identity, "email", None):
        user_email = identity.email
        profile = database.get_user_history(user_email)
        user_tier = profile.get("badge") or "Guardian"
    elif chat_id:
        user_row = database.get_user_by_telegram_chat_id(chat_id)
        if user_row:
            user_email = user_row.get("email")
            user_tier = user_row.get("badge") or "Guardian"

    result = analyze_indicator(indicator, is_scan=True, user_tier=user_tier)

    # Award points bounded by daily cap (3/day WIB) and deduplicated
    reward = None
    if user_email:
        reward = database.award_threat_reward(
            email=user_email,
            target=indicator,
            verdict=result["analysis"].get("verdict", "clean")
        )

    wib_date = database.get_current_wib_date()
    daily_count = database.get_daily_threat_reward_count(user_email, wib_date) if user_email else 0
    daily_stats = {
        "daily_count": daily_count,
        "daily_cap": database.DAILY_REWARD_CAP,
        "wib_date": wib_date
    }

    return jsonify({
        "success": True,
        "indicator": indicator,
        "chat_id": chat_id,
        "reported_url": indicator,
        "user_email": user_email,
        "user_tier": user_tier,
        "cache_hit": result["cache_hit"],
        "is_demo_seed": result.get("is_demo_seed", False),
        "scanner_busy": result.get("scanner_busy", False),
        "analysis": result["analysis"],
        "policy": result["policy"],
        "ticket_id": result.get("ticket_id"),
        "soc_status": result.get("soc_status"),
        "reward": reward,
        "daily_stats": daily_stats
    }), 200


@threat_bp.route("/api/threat/stats", methods=["GET"])
def threat_stats():
    identity = current_identity() or authenticate_session_request(request)
    wib_date = database.get_current_wib_date()
    email = identity.email if identity and getattr(identity, "email", None) else None
    count = database.get_daily_threat_reward_count(email, wib_date) if email else 0
    return jsonify({
        "authenticated": bool(email),
        "email": email,
        "daily_count": count,
        "daily_cap": database.DAILY_REWARD_CAP,
        "wib_date": wib_date
    }), 200
@threat_bp.route("/api/debug/vt", methods=["POST"])
def debug_vt():

    body = request.get_json()

    indicator = body["indicator"]

    raw = integrations.scan_virustotal(indicator)

    return jsonify(raw)