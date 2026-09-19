"""Business logic for device-bound proxy access and domain verdicts."""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

import requests

from services import proxy_store


SCHEMA_VERSION = "1.0"

# Guard against accidentally turning a public suffix into an organization-wide
# block policy. This is intentionally small and covers the deployment's common
# Indonesian/global suffixes without adding a network-fetched PSL dependency.
_PUBLIC_SUFFIXES = {
    "com", "net", "org", "edu", "gov", "mil", "io", "id",
    "co.id", "ac.id", "go.id", "or.id", "sch.id", "web.id", "my.id",
    "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "org.au",
}


class ProxyError(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def validate_runtime_configuration() -> None:
    missing = []
    if not (_secret("PROXY_IDENTITY_PEPPER") or _secret("AUTH_AUDIT_PEPPER")):
        missing.append("PROXY_IDENTITY_PEPPER")
    if not _secret("ML_WEBHOOK_SECRET"):
        missing.append("ML_WEBHOOK_SECRET")
    if missing:
        raise RuntimeError(f"Proxy runtime requires: {', '.join(missing)}")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, str(default)))
    except ValueError:
        return default


def _secret(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    file_name = os.environ.get(f"{name}_FILE", "").strip()
    if file_name:
        with open(file_name, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    return ""


def normalize_domain(value: str) -> str:
    """Normalize a URL, CONNECT authority, or hostname to an IDNA domain."""
    raw = (value or "").strip()
    if not raw or len(raw) > 4096:
        raise ProxyError("INVALID_TARGET", "Target URL/domain tidak valid")

    candidate = raw if "://" in raw else f"//{raw}"
    parsed = urlsplit(candidate)
    host = parsed.hostname
    if not host:
        raise ProxyError("INVALID_TARGET", "Hostname tidak ditemukan")
    host = host.rstrip(".").lower()
    try:
        ipaddress.ip_address(host)
        return host
    except ValueError:
        pass
    try:
        normalized = host.encode("idna").decode("ascii")
    except UnicodeError as exc:
        raise ProxyError("INVALID_TARGET", "Hostname tidak valid") from exc
    labels = normalized.split(".")
    if (
        len(normalized) > 253
        or any(
            not label
            or len(label) > 63
            or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
            for label in labels
        )
    ):
        raise ProxyError("INVALID_TARGET", "Hostname tidak valid")
    return normalized


def normalize_policy_domain(value: str) -> str:
    """Canonical SOC policy scope: root alias plus all of its subdomains."""
    domain = normalize_domain(value)
    try:
        ipaddress.ip_address(domain)
        return domain
    except ValueError:
        pass
    if domain.startswith("www."):
        domain = domain[4:]
    if domain in _PUBLIC_SUFFIXES or "." not in domain:
        raise ProxyError("INVALID_POLICY_SCOPE", "Domain policy terlalu luas atau tidak valid")
    return domain


def _domain_candidates(domain: str) -> list[str]:
    """Return the exact host followed by safe parent-policy candidates."""
    try:
        ipaddress.ip_address(domain)
        return [domain]
    except ValueError:
        pass
    # Treat the conventional leading ``www.`` host as an alias of the
    # canonical policy domain. Older demo data may still contain an exact
    # ``www`` verdict, so put the canonical name first to prevent that stale
    # row from overriding a newly-applied canonical SOC policy.
    canonical = domain[4:] if domain.startswith("www.") else domain
    labels = canonical.split(".")
    candidates = [canonical]
    if domain != canonical:
        candidates.append(domain)
    candidates.extend(
        ".".join(labels[index:])
        for index in range(1, max(1, len(labels) - 1))
    )
    return list(dict.fromkeys(
        candidate for candidate in candidates if candidate not in _PUBLIC_SUFFIXES
    ))


def source_ip_hash(ip_address: str) -> str:
    pepper = _secret("PROXY_IDENTITY_PEPPER") or _secret("AUTH_AUDIT_PEPPER")
    if not pepper:
        raise RuntimeError("PROXY_IDENTITY_PEPPER or AUTH_AUDIT_PEPPER is required")
    normalized = (ip_address or "unknown").strip()
    return hmac.new(pepper.encode(), normalized.encode(), hashlib.sha256).hexdigest()


def _ip_hint(ip_address: str) -> str:
    """Keep only a troubleshooting hint; the full address is never persisted."""
    try:
        address = ipaddress.ip_address(ip_address)
        if address.version == 4:
            parts = str(address).split(".")
            return f"{parts[0]}.{parts[1]}.x.x"
        return f"{address.exploded.split(':')[0]}:{address.exploded.split(':')[1]}::/32"
    except ValueError:
        return "unknown"


def _serialize(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, dict):
        return {key: _serialize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    return value


def register_device(identity: Any, ip_address: str, label: str = "") -> dict[str, Any]:
    if identity.role != "employee":
        raise ProxyError("EMPLOYEE_REQUIRED", "Hanya employee yang dapat mengaktifkan proxy", 403)
    record = proxy_store.upsert_device(
        {
            "id": str(uuid.uuid4()),
            "account_id": identity.account_id,
            "email": identity.email,
            "role": identity.role,
            "label": (label or "Perangkat utama")[:120],
            "source_ip_hash": source_ip_hash(ip_address),
            "source_ip_hint": _ip_hint(ip_address),
        },
        _env_int("PROXY_DEVICE_TTL_SECONDS", 28800),
    )
    if not record:
        raise ProxyError(
            "SOURCE_IP_ALREADY_BOUND",
            "Alamat jaringan ini sedang terikat ke akun employee lain",
            409,
        )
    return device_status(identity.account_id, record)


def heartbeat_device(identity: Any, ip_address: str) -> dict[str, Any]:
    record = proxy_store.heartbeat_device(
        source_ip_hash(ip_address),
        _env_int("PROXY_DEVICE_TTL_SECONDS", 28800),
    )
    if not record or int(record["account_id"]) != int(identity.account_id):
        raise ProxyError(
            "DEVICE_NOT_REGISTERED",
            "Perangkat belum terdaftar dari alamat jaringan ini",
            409,
        )
    return device_status(identity.account_id, record)


def device_status(account_id: int, record: dict[str, Any] | None = None) -> dict[str, Any]:
    record = record or proxy_store.get_device_for_account(account_id)
    if not record:
        return {"registered": False, "connected": False}
    last_seen = record.get("last_proxy_seen_at")
    connected = False
    if last_seen:
        if isinstance(last_seen, str):
            last_seen = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        connected = last_seen >= _utcnow() - timedelta(
            seconds=_env_int("PROXY_CONNECTED_WINDOW_SECONDS", 90)
        )
    return {
        "registered": bool(record.get("active")),
        "connected": connected,
        "deviceId": str(record["id"]),
        "label": record.get("label"),
        "sourceIpHint": record.get("source_ip_hint"),
        "lastHeartbeatAt": _serialize(record.get("last_heartbeat_at")),
        "lastProxySeenAt": _serialize(record.get("last_proxy_seen_at")),
    }


def current_device_status(identity: Any, ip_address: str) -> dict[str, Any]:
    record = proxy_store.get_device(source_ip_hash(ip_address))
    if not record or int(record["account_id"]) != int(identity.account_id):
        return {"registered": False, "connected": False}
    return device_status(identity.account_id, record)


def deactivate_devices(account_id: int) -> None:
    if os.environ.get("PROXY_FEATURE_ENABLED", "false").lower() in {"1", "true", "yes"}:
        proxy_store.deactivate_account_devices(account_id)


def _cache_ttl(verdict: dict[str, Any]) -> int:
    source = verdict.get("source")
    return _env_int(
        "PROXY_SOC_CACHE_TTL_SECONDS" if source == "soc" else "PROXY_ML_CACHE_TTL_SECONDS",
        86400 if source == "soc" else 3600,
    )


def _effective_verdict(domain: str) -> dict[str, Any] | None:
    matches: list[tuple[int, dict[str, Any]]] = []
    for specificity, candidate in enumerate(_domain_candidates(domain)):
        verdict = proxy_store.get_cached_verdict(candidate)
        if not verdict:
            row = proxy_store.get_effective_verdict(candidate)
            if row:
                verdict = _serialize(row)
                proxy_store.cache_verdict(candidate, verdict, _cache_ttl(verdict))
        if verdict:
            matches.append((specificity, verdict))
    if not matches:
        return None
    source_priority = {"soc": 0, "ml": 1, "employee_report": 2, "ml_unknown": 3}
    return min(
        matches,
        key=lambda item: (source_priority.get(str(item[1].get("source")), 9), item[0]),
    )[1]


def _ml_signature(raw_body: bytes) -> str:
    secret = _secret("ML_WEBHOOK_SECRET")
    if not secret:
        raise RuntimeError("ML_WEBHOOK_SECRET or ML_WEBHOOK_SECRET_FILE is required")
    return "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()


def verify_ml_signature(raw_body: bytes, supplied: str) -> bool:
    try:
        expected = _ml_signature(raw_body)
    except RuntimeError:
        return False
    return bool(supplied) and hmac.compare_digest(expected, supplied.strip())


def _call_ml(domain: str, request_id: str) -> dict[str, Any]:
    endpoint = os.environ.get("ML_SCANNER_URL", "").strip()
    if not endpoint:
        return {
            "verdict": "unknown",
            "confidence": None,
            "reason": "Model ML belum dikonfigurasi",
            "modelVersion": None,
        }
    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "eventId": str(uuid.uuid4()),
        "requestId": request_id,
        "domain": domain,
        "observedAt": _utcnow().isoformat(),
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    ca_bundle = os.environ.get("ML_TLS_CA_BUNDLE", "").strip()
    response = requests.post(
        endpoint,
        data=raw,
        headers={
            "Content-Type": "application/json",
            "X-Afferent-Signature": _ml_signature(raw),
            "X-Afferent-Schema-Version": SCHEMA_VERSION,
            "Idempotency-Key": payload["eventId"],
        },
        timeout=_env_float("ML_SCANNER_TIMEOUT_SECONDS", 1.5),
        verify=ca_bundle or True,
    )
    response.raise_for_status()
    result = response.json()
    return _validated_ml_result(result)


def _validated_ml_result(payload: dict[str, Any]) -> dict[str, Any]:
    verdict = str(payload.get("verdict", "unknown")).strip().lower()
    if verdict not in {"safe", "malicious", "unknown"}:
        raise ProxyError("INVALID_ML_VERDICT", "Verdict ML tidak valid")
    confidence = payload.get("confidence")
    if confidence is not None:
        confidence = float(confidence)
        if not 0 <= confidence <= 1:
            raise ProxyError("INVALID_ML_CONFIDENCE", "Confidence ML harus 0..1")
    return {
        "verdict": verdict,
        "confidence": confidence,
        "reason": str(payload.get("reason") or "Model tidak memberi alasan")[:1000],
        "modelVersion": str(payload.get("modelVersion") or "unversioned")[:120],
    }


def _persist_ml_verdict(domain: str, result: dict[str, Any]) -> dict[str, Any] | None:
    verdict = result["verdict"]
    block_threshold = _env_float("ML_BLOCK_CONFIDENCE_THRESHOLD", 0.85)
    allow_threshold = _env_float("ML_ALLOW_CONFIDENCE_THRESHOLD", 0.80)
    confidence = result.get("confidence")
    if verdict == "malicious" and (confidence is None or confidence < block_threshold):
        return None
    if verdict == "safe" and (confidence is None or confidence < allow_threshold):
        return None
    if verdict not in {"safe", "malicious"}:
        return None
    ttl = _env_int("PROXY_ML_VERDICT_TTL_SECONDS", 604800)
    row = proxy_store.upsert_verdict(
        {
            "id": str(uuid.uuid4()),
            "domain": domain,
            "source": "ml",
            "decision": "block" if verdict == "malicious" else "allow",
            "verdict": verdict,
            "reason": result["reason"],
            "confidence": confidence,
            "model_version": result.get("modelVersion"),
            "expires_at": _utcnow() + timedelta(seconds=ttl),
            "updated_by": "ml-integration",
        }
    )
    serial = _serialize(row)
    proxy_store.cache_verdict(domain, serial, min(ttl, _cache_ttl(serial)))
    return serial


def _alert_for_result(
    *, domain: str, device: dict[str, Any] | None, result: dict[str, Any], request_id: str
) -> dict[str, Any]:
    malicious = result["verdict"] == "malicious"
    return proxy_store.create_alert(
        {
            "id": str(uuid.uuid4()),
            "domain": domain,
            "device_id": str(device["id"]) if device else None,
            "account_id": device.get("account_id") if device else None,
            "employee_email": device.get("email") if device else None,
            "urgency": "Critical" if malicious else "Unknown",
            "verdict": "malicious" if malicious else "unknown",
            "reason": result["reason"],
            "confidence": result.get("confidence"),
            "source": "ml",
            "request_id": request_id,
        }
    )


def decide(
    *, target: str, method: str, port: int | None, client_ip: str,
    event_id: str, request_id: str
) -> dict[str, Any]:
    domain = normalize_domain(target)
    previous = proxy_store.get_idempotent_decision(event_id)
    if previous:
        return previous
    device = proxy_store.get_device(source_ip_hash(client_ip))

    if device:
        proxy_store.mark_proxy_seen(str(device["id"]))
    cached = _effective_verdict(domain)
    if cached:
        # Respect block decision from both explicit SOC policy and high-confidence ML verdict.
        action = "block" if cached.get("decision") == "block" else "allow"
        source = cached["source"]
        reason = cached["reason"]
    else:
        action, source, reason = _decide_unknown(domain, device, request_id)

    event = {
        "event_id": event_id,
        "schema_version": SCHEMA_VERSION,
        "device_id": str(device["id"]) if device else None,
        "account_id": device.get("account_id") if device else None,
        "employee_email": device.get("email") if device else None,
        "domain": domain,
        "port": port,
        "method": (method or "GET").upper()[:16],
        "action": action,
        "decision_source": source,
        "reason": reason,
        "request_id": request_id,
        "occurred_at": _utcnow().isoformat(),
    }
    # Every request that actually traverses Squid belongs in the SOC feed.
    # Device binding enriches attribution but is not a static allowlist.
    proxy_store.enqueue_traffic(event)
    response = {
        "schemaVersion": SCHEMA_VERSION,
        "eventId": event_id,
        "domain": domain,
        "action": action,
        "source": source,
        "reason": reason,
        "deviceAuthenticated": bool(device),
    }
    proxy_store.cache_idempotent_decision(event_id, response)
    return response


def _decide_unknown(
    domain: str, device: dict[str, Any] | None, request_id: str
) -> tuple[str, str, str]:
    if not proxy_store.acquire_scan_lock(domain):
        return "allow", "ml_pending", "Analisis domain sedang diproses; diizinkan sementara"
    try:
        try:
            result = _call_ml(domain, request_id)
        except Exception as exc:
            result = {
                "verdict": "unknown",
                "confidence": None,
                "reason": f"Model ML tidak tersedia: {type(exc).__name__}",
                "modelVersion": None,
            }
        persisted = _persist_ml_verdict(domain, result)
        if persisted:
            if persisted["decision"] == "block":
                _alert_for_result(domain=domain, device=device, result=result, request_id=request_id)
                return "block", "ml", persisted["reason"]
            return "allow", "ml", persisted["reason"]

        # An absent integration is an operational state, not a threat. Keep the
        # traffic and short unknown cache, but do not flood the SOC queue until
        # an actual ML endpoint is configured and returns an unknown verdict.
        if os.environ.get("ML_SCANNER_URL", "").strip():
            _alert_for_result(domain=domain, device=device, result=result, request_id=request_id)
        proxy_store.cache_verdict(
            domain,
            {
                "domain": domain,
                "decision": "allow",
                "source": "ml_unknown",
                "reason": "Belum ada verdict konklusif; diizinkan sementara",
                "verdict": "unknown",
            },
            _env_int("PROXY_UNKNOWN_RETRY_SECONDS", 60),
        )
        return "allow", "ml_unknown", "Belum ada verdict konklusif; diizinkan sementara"
    finally:
        proxy_store.release_scan_lock(domain)


def accept_ml_callback(payload: dict[str, Any]) -> dict[str, Any]:
    if str(payload.get("schemaVersion")) != SCHEMA_VERSION:
        raise ProxyError("UNSUPPORTED_SCHEMA", "schemaVersion ML tidak didukung", 422)
    event_id = str(payload.get("eventId", "")).strip()
    domain = normalize_domain(str(payload.get("domain", "")))
    if not event_id:
        raise ProxyError("INVALID_EVENT_ID", "eventId wajib diisi")
    if not proxy_store.record_ml_event(event_id, domain, payload):
        return {"accepted": True, "duplicate": True, "domain": domain}
    result = _validated_ml_result(payload)
    persisted = _persist_ml_verdict(domain, result)
    if not persisted:
        _alert_for_result(domain=domain, device=None, result=result, request_id=event_id)
    elif persisted["decision"] == "block":
        _alert_for_result(domain=domain, device=None, result=result, request_id=event_id)
    return {"accepted": True, "duplicate": False, "domain": domain, "verdict": result["verdict"]}


def manual_decision(
    *, domain_value: str, action: str, reason: str, identity: Any,
    request_id: str, alert_id: str | None = None
) -> dict[str, Any]:
    domain = normalize_policy_domain(domain_value)
    action = action.strip().lower()
    if action not in {"block", "allow"}:
        raise ProxyError("INVALID_ACTION", "Action harus block atau allow")
    if len(reason.strip()) < 5:
        raise ProxyError("REASON_REQUIRED", "Alasan keputusan minimal 5 karakter")
    verdict_record = {
        "id": str(uuid.uuid4()),
        "domain": domain,
        "source": "soc",
        "decision": action,
        "verdict": "malicious" if action == "block" else "safe",
        "reason": reason.strip()[:1000],
        "confidence": 1.0,
        "model_version": None,
        "expires_at": None,
        "updated_by": identity.email,
    }
    _before, row, resolved_alert = proxy_store.apply_manual_decision(
        verdict_record,
        {
            "actor_email": identity.email,
            "actor_role": identity.role,
            "action": action,
            "reason": reason.strip()[:1000],
            "request_id": request_id,
            "alert_id": alert_id,
            "domain": domain,
        },
        alert_id,
    )
    proxy_store.cache_verdict(domain, _serialize(row), _cache_ttl(row))
    if resolved_alert:
        proxy_store.publish_alert({"type": "alert.updated", "alert": _serialize(resolved_alert)})
    proxy_store.publish_alert({"type": "verdict.updated", "verdict": _serialize(row)})
    return _serialize(row)


def list_alerts(limit: int = 200) -> list[dict[str, Any]]:
    return _serialize(proxy_store.list_alerts(limit))


def list_verdicts(limit: int = 200) -> list[dict[str, Any]]:
    return _serialize(proxy_store.list_verdicts(limit))


def list_traffic(limit: int = 200, account_id: int | None = None) -> list[dict[str, Any]]:
    return _serialize(proxy_store.list_traffic(limit, account_id))


def list_audit(limit: int = 200) -> list[dict[str, Any]]:
    return _serialize(proxy_store.list_audit(limit))
