"""Security helpers shared by Flask routes.

This module deliberately contains no business logic. It centralizes runtime
environment validation, constant-time service authentication, and short-lived
tokens used by the public phishing-simulation training page.
"""

from __future__ import annotations

import hmac
import os
from functools import wraps
from typing import Any

from flask import g, jsonify
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer


NON_LOCAL_ENVIRONMENTS = {"staging", "production", "prod"}
SIMULATION_TOKEN_SALT = "afferent-simulation-access-v1"


def env_flag(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def runtime_environment() -> str:
    return (
        os.environ.get("APP_ENV")
        or os.environ.get("FLASK_ENV")
        or "development"
    ).strip().lower()


def is_local_development() -> bool:
    return runtime_environment() in {"development", "dev", "local", "test"}


def validate_runtime_security() -> None:
    """Reject unsafe debug/auth bypass flags outside local development."""
    environment = runtime_environment()
    if environment not in NON_LOCAL_ENVIRONMENTS:
        return

    unsafe_flags = [
        name
        for name in ("DEV_BYPASS_AUTH", "FLASK_DEBUG")
        if env_flag(name)
    ]
    if unsafe_flags:
        joined = ", ".join(unsafe_flags)
        raise RuntimeError(
            f"CRITICAL ERROR: {joined} must be disabled when APP_ENV={environment}."
        )


def is_valid_service_request(request: Any) -> bool:
    """Validate the internal bearer token without timing-leaky equality."""
    expected = os.environ.get("SERVICE_API_KEY", "")
    authorization = request.headers.get("Authorization", "")
    if not expected or not authorization.startswith("Bearer "):
        return False
    supplied = authorization.removeprefix("Bearer ").strip()
    return bool(supplied) and hmac.compare_digest(supplied, expected)


def session_token_from_request(request: Any) -> str:
    """Read the opaque session token forwarded by the same-origin Next BFF."""
    return (
        request.headers.get("X-Afferent-Session", "").strip()
        or request.cookies.get("afferent_session", "").strip()
    )


def authenticate_session_request(request: Any):
    token = session_token_from_request(request)
    if not token:
        return None
    from services.auth_service import get_identity
    return get_identity(token)


def current_identity():
    return getattr(g, "auth_identity", None)


def require_roles(*roles: str, allow_service: bool = False):
    """Enforce server-derived RBAC; never trust role query/body headers."""
    allowed = {role.lower() for role in roles}

    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if allow_service and getattr(g, "service_authenticated", False):
                return view(*args, **kwargs)
            identity = current_identity()
            if not identity:
                return jsonify({"error": "Unauthorized", "code": "UNAUTHORIZED"}), 401
            if identity.role.lower() not in allowed:
                return jsonify({
                    "error": "Role tidak memiliki akses ke resource ini",
                    "code": "FORBIDDEN",
                }), 403
            return view(*args, **kwargs)
        return wrapped
    return decorator


def require_employee_match(email: str):
    """Return an authorization response when an employee requests another profile."""
    identity = current_identity()
    if not identity:
        return jsonify({"error": "Unauthorized", "code": "UNAUTHORIZED"}), 401
    if identity.role != "employee" or not hmac.compare_digest(identity.email.lower(), email.lower()):
        return jsonify({"error": "Akses employee tidak sesuai", "code": "FORBIDDEN"}), 403
    return None


def _simulation_serializer() -> URLSafeTimedSerializer:
    secret_key = os.environ.get("SECRET_KEY", "")
    if not secret_key:
        raise RuntimeError("SECRET_KEY is required for simulation access tokens")
    return URLSafeTimedSerializer(secret_key, salt=SIMULATION_TOKEN_SALT)


def create_simulation_token(email: str, campaign_id: str | None = None) -> str:
    return _simulation_serializer().dumps(
        {"email": email, "campaign_id": campaign_id or ""}
    )


def verify_simulation_token(token: str, email: str) -> bool:
    if not token or not email:
        return False

    try:
        max_age = int(os.environ.get("SIMULATION_TOKEN_TTL_SECONDS", "7200"))
    except ValueError:
        max_age = 7200

    try:
        payload = _simulation_serializer().loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return False

    token_email = str(payload.get("email", ""))
    return hmac.compare_digest(token_email, email)
