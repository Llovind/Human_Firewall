from flask import Blueprint, request, jsonify
import integrations
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
    result = analyze_indicator(indicator, is_scan=True)

    return jsonify({

        "success": True,

    "indicator": indicator,

    "chat_id": chat_id,

    "reported_url": indicator,

    "cache_hit": result["cache_hit"],

    "analysis": result["analysis"],

    "policy": result["policy"]


    }), 200
@threat_bp.route("/api/debug/vt", methods=["POST"])
def debug_vt():

    body = request.get_json()

    indicator = body["indicator"]

    raw = integrations.scan_virustotal(indicator)

    return jsonify(raw)