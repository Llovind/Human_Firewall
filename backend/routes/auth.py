"""Email/password + OTP authentication endpoints for AFFERENT."""

from __future__ import annotations

import os
import uuid
import logging

from flask import Blueprint, g, jsonify, redirect, request

from services import auth_service


auth_bp = Blueprint("auth", __name__)
logger = logging.getLogger(__name__)


def _request_id() -> str:
    return request.headers.get("X-Request-ID", "").strip()[:128] or str(uuid.uuid4())


def _client_ip() -> str:
    if os.environ.get("TRUST_PROXY_HEADERS", "false").lower() in {"1", "true", "yes"}:
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
    return request.remote_addr or "unknown"


def _session_token() -> str:
    return (
        request.headers.get("X-Afferent-Session", "").strip()
        or request.cookies.get("afferent_session", "").strip()
    )


def _error_response(exc: auth_service.AuthError):
    payload = {"error": exc.message, "code": exc.code, "requestId": _request_id()}
    if exc.retry_after is not None:
        payload["retryAfter"] = exc.retry_after
    response = jsonify(payload)
    response.status_code = exc.status
    if exc.retry_after is not None:
        response.headers["Retry-After"] = str(exc.retry_after)
    return response


@auth_bp.route("/admin/login", methods=["GET"])
def admin_login():
    dashboard_base = os.environ.get("NEXT_PUBLIC_BASE_URL", "http://localhost:3000")
    return redirect(f"{dashboard_base}/auth")


@auth_bp.route("/admin/logout", methods=["GET"])
def admin_logout():
    dashboard_base = os.environ.get("NEXT_PUBLIC_BASE_URL", "http://localhost:3000")
    return redirect(f"{dashboard_base}/auth")


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    if not body.get("email") or not body.get("password"):
        return jsonify({"error": "Email dan password wajib diisi", "code": "INVALID_PAYLOAD"}), 400
    try:
        result = auth_service.request_login(
            email=str(body["email"]),
            password=str(body["password"]),
            ip_address=_client_ip(),
            request_id=_request_id(),
        )
        return jsonify({"success": True, **result}), 200
    except auth_service.AuthError as exc:
        return _error_response(exc)


@auth_bp.route("/api/auth/resend-otp", methods=["POST"])
def resend_otp():
    body = request.get_json(silent=True) or {}
    challenge_id = str(body.get("challengeId", "")).strip()
    if not challenge_id:
        return jsonify({"error": "challengeId wajib diisi", "code": "INVALID_PAYLOAD"}), 400
    try:
        result = auth_service.resend_otp(
            challenge_id=challenge_id,
            ip_address=_client_ip(),
            request_id=_request_id(),
        )
        return jsonify({"success": True, **result}), 200
    except auth_service.AuthError as exc:
        return _error_response(exc)


@auth_bp.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    body = request.get_json(silent=True) or {}
    challenge_id = str(body.get("challengeId", "")).strip()
    otp_code = str(body.get("otp", "")).strip()
    if not challenge_id or len(otp_code) != 6 or not otp_code.isdigit():
        return jsonify({"error": "Challenge dan kode OTP 6 digit wajib diisi", "code": "INVALID_PAYLOAD"}), 400
    try:
        token, user, expires_in = auth_service.verify_login_otp(
            challenge_id=challenge_id,
            otp_code=otp_code,
            ip_address=_client_ip(),
            user_agent=request.headers.get("User-Agent", ""),
            request_id=_request_id(),
        )
        return jsonify({
            "success": True,
            "sessionToken": token,
            "expiresIn": expires_in,
            "user": user,
        }), 200
    except auth_service.AuthError as exc:
        return _error_response(exc)


@auth_bp.route("/api/auth/session", methods=["GET"])
def session_info():
    identity = getattr(g, "auth_identity", None)
    if not identity:
        return jsonify({"error": "Session tidak valid", "code": "UNAUTHORIZED"}), 401
    return jsonify({"authenticated": True, "user": identity.as_dict()}), 200


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    token = _session_token()
    identity = getattr(g, "auth_identity", None) or auth_service.get_identity(token)
    if identity:
        try:
            from services.proxy_service import deactivate_devices
            deactivate_devices(identity.account_id)
        except Exception as exc:
            logger.warning("Proxy device deactivation failed during logout: %s", type(exc).__name__)
    auth_service.revoke_session(token)
    return jsonify({"success": True}), 200


# Explicit tombstones prevent old integrations from silently issuing identity.
@auth_bp.route("/api/auth/admin", methods=["POST"])
@auth_bp.route("/api/telegram/command", methods=["POST"])
@auth_bp.route("/api/auth/validate-token", methods=["GET"])
def retired_auth_flow():
    return jsonify({
        "error": "Alur autentikasi lama telah dinonaktifkan. Gunakan email, password, dan OTP.",
        "code": "AUTH_FLOW_RETIRED",
    }), 410
