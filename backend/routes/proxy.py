"""Centralized proxy, device binding, ML integration, and SOC controls."""

from __future__ import annotations

import os
import uuid

from flask import Blueprint, Response, jsonify, render_template, request, stream_with_context

from security import current_identity, require_roles
from services import proxy_service, proxy_store


proxy_bp = Blueprint("proxy", __name__)


def _request_id() -> str:
    return request.headers.get("X-Request-ID", "").strip()[:128] or str(uuid.uuid4())


def _client_ip() -> str:
    if os.environ.get("TRUST_PROXY_HEADERS", "false").lower() in {"1", "true", "yes"}:
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
    return request.remote_addr or "unknown"


def _error(exc: proxy_service.ProxyError):
    return jsonify({"error": exc.message, "code": exc.code, "requestId": _request_id()}), exc.status


@proxy_bp.route("/visit", methods=["GET", "POST"])
@proxy_bp.route("/go", methods=["GET", "POST"])
def retired_manual_proxy():
    return jsonify({
        "error": "Form proxy manual telah dinonaktifkan. Gunakan AFFERENT Centralized Proxy pada level perangkat.",
        "code": "MANUAL_PROXY_RETIRED",
    }), 410


@proxy_bp.route("/blocked")
def blocked():
    domain = request.args.get("domain") or request.args.get("url", "")
    threat_data = {
        "url": domain,
        "engine": request.args.get("source", "AFFERENT Security Gateway"),
        "threat_type": "Malicious Domain",
        "cache_id": request.args.get("requestId", "PROXY-BLOCK"),
        "threat_score": 100,
        "severity": "critical",
        "verdict": "malicious",
        "confidence": 1,
        "reason": request.args.get("reason", "Akses ditolak oleh kebijakan keamanan AFFERENT"),
    }
    return render_template("blocked.html", threat=threat_data)


@proxy_bp.route("/api/proxy/device/register", methods=["POST"])
@require_roles("employee")
def register_device():
    body = request.get_json(silent=True) or {}
    try:
        status = proxy_service.register_device(
            current_identity(), _client_ip(), str(body.get("label", ""))
        )
        return jsonify({"success": True, "status": status}), 201
    except proxy_service.ProxyError as exc:
        return _error(exc)


@proxy_bp.route("/api/proxy/device/heartbeat", methods=["POST"])
@require_roles("employee")
def heartbeat_device():
    try:
        status = proxy_service.heartbeat_device(current_identity(), _client_ip())
        return jsonify({"success": True, "status": status}), 200
    except proxy_service.ProxyError as exc:
        return _error(exc)


@proxy_bp.route("/api/proxy/device/status", methods=["GET"])
@require_roles("employee")
def device_status():
    return jsonify({
        "status": proxy_service.current_device_status(current_identity(), _client_ip())
    }), 200


@proxy_bp.route("/api/proxy/decision", methods=["POST"])
@require_roles("soc", "ciso", allow_service=True)
def proxy_decision():
    """Synchronous Squid external-ACL decision endpoint."""
    body = request.get_json(silent=True) or {}
    if str(body.get("schemaVersion", "")) != proxy_service.SCHEMA_VERSION:
        return jsonify({"error": "schemaVersion tidak didukung", "code": "UNSUPPORTED_SCHEMA"}), 422
    event_id = str(body.get("eventId") or uuid.uuid4())
    try:
        uuid.UUID(event_id)
        result = proxy_service.decide(
            target=str(body.get("target", "")),
            method=str(body.get("method", "GET")),
            port=int(body["port"]) if body.get("port") else None,
            client_ip=str(body.get("clientIp") or _client_ip()),
            event_id=event_id,
            request_id=str(body.get("requestId") or _request_id())[:128],
        )
        return jsonify(result), 200
    except proxy_service.ProxyError as exc:
        return _error(exc)
    except (TypeError, ValueError):
        return jsonify({"error": "eventId/port tidak valid", "code": "INVALID_PAYLOAD"}), 400


@proxy_bp.route("/api/proxy/ml/verdict", methods=["POST"])
def ml_verdict_webhook():
    """HMAC-authenticated callback for the separately developed ML service."""
    raw = request.get_data(cache=True)
    signature = request.headers.get("X-Afferent-Signature", "")
    if not proxy_service.verify_ml_signature(raw, signature):
        return jsonify({"error": "Invalid HMAC signature", "code": "INVALID_SIGNATURE"}), 401
    body = request.get_json(silent=True) or {}
    try:
        return jsonify(proxy_service.accept_ml_callback(body)), 202
    except proxy_service.ProxyError as exc:
        return _error(exc)


def _limit() -> int:
    try:
        return min(max(int(request.args.get("limit", 200)), 1), 500)
    except ValueError:
        return 200


@proxy_bp.route("/api/proxy/alerts", methods=["GET"])
@require_roles("soc", "ciso")
def alerts():
    return jsonify({"alerts": proxy_service.list_alerts(_limit())})


@proxy_bp.route("/api/proxy/verdicts", methods=["GET"])
@require_roles("soc", "ciso")
def verdicts():
    return jsonify({"verdicts": proxy_service.list_verdicts(_limit())})


@proxy_bp.route("/api/proxy/traffic", methods=["GET"])
@require_roles("soc", "ciso")
def traffic():
    return jsonify({"events": proxy_service.list_traffic(_limit())})


@proxy_bp.route("/api/proxy/audit", methods=["GET"])
@require_roles("soc", "ciso")
def audit_log():
    return jsonify({"audit": proxy_service.list_audit(_limit())})


@proxy_bp.route("/api/proxy/manual-decision", methods=["POST"])
@require_roles("soc")
def manual_decision():
    body = request.get_json(silent=True) or {}
    try:
        verdict = proxy_service.manual_decision(
            domain_value=str(body.get("domain", "")),
            action=str(body.get("action", "")),
            reason=str(body.get("reason", "")),
            identity=current_identity(),
            request_id=_request_id(),
        )
        return jsonify({"success": True, "verdict": verdict}), 200
    except proxy_service.ProxyError as exc:
        return _error(exc)


@proxy_bp.route("/api/proxy/alerts/<alert_id>/decision", methods=["POST"])
@require_roles("soc")
def alert_decision(alert_id: str):
    body = request.get_json(silent=True) or {}
    alert = proxy_store.get_alert(alert_id)
    if not alert:
        return jsonify({"error": "Alert tidak ditemukan", "code": "NOT_FOUND"}), 404
    try:
        verdict = proxy_service.manual_decision(
            domain_value=alert["domain"],
            action=str(body.get("action", "")),
            reason=str(body.get("reason", "")),
            identity=current_identity(),
            request_id=_request_id(),
            alert_id=alert_id,
        )
        return jsonify({"success": True, "verdict": verdict}), 200
    except proxy_service.ProxyError as exc:
        return _error(exc)


@proxy_bp.route("/api/proxy/alerts/stream", methods=["GET"])
@require_roles("soc", "ciso")
def alert_stream():
    @stream_with_context
    def generate():
        pubsub = proxy_store.redis_client().pubsub(ignore_subscribe_messages=True)
        pubsub.subscribe("proxy:soc-events")
        try:
            yield "event: ready\ndata: {\"connected\":true}\n\n"
            while True:
                message = pubsub.get_message(timeout=15)
                if message and message.get("type") == "message":
                    yield f"event: update\ndata: {message['data']}\n\n"
                else:
                    yield ": keepalive\n\n"
        finally:
            pubsub.close()

    response = Response(generate(), mimetype="text/event-stream")
    response.headers["Cache-Control"] = "no-cache, no-transform"
    response.headers["X-Accel-Buffering"] = "no"
    return response


@proxy_bp.route("/api/proxy/config", methods=["GET"])
@require_roles("employee", "soc", "ciso")
def proxy_config():
    return jsonify({
        "proxyUrl": os.environ.get("PUBLIC_PROXY_URL", "http://127.0.0.1:3128"),
        "monitoringScope": "full-url",
        "tlsInspection": True,
        "caDownloadUrl": "/api/proxy/ca.crt",
    })


@proxy_bp.route("/api/proxy/ca.crt", methods=["GET"])
def download_ca_cert():
    """Public endpoint to download the AFFERENT Proxy CA certificate for client installation."""
    from pathlib import Path
    ca_path = Path("/app/../proxy/ssl/afferent-proxy-ca.crt")
    if not ca_path.exists():
        # Fallback to direct path inside project
        ca_path = Path("/etc/afferent-proxy/afferent-proxy-ca.crt")
    if not ca_path.exists():
        local_path = Path(__file__).resolve().parent.parent.parent / "proxy" / "ssl" / "afferent-proxy-ca.crt"
        ca_path = local_path
    if not ca_path.exists():
        return Response("CA certificate not found on server", status=404, mimetype="text/plain")
    return Response(
        ca_path.read_text(encoding="utf-8"),
        mimetype="application/x-x509-ca-cert",
        headers={"Content-Disposition": 'attachment; filename="afferent-proxy-ca.crt"'},
    )

