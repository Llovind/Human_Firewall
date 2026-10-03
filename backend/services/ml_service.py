"""Bounded, CPU-only inference shared by direct URL scans and the proxy.

No reputation whitelist or external threat-intelligence provider overrides the
trained model. SOC policy is enforced separately, before this service is called.
"""

import hashlib
import json
import os
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from urllib.parse import urlsplit, urlunsplit

import char_bilstm_scanner

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="afferent-ml")
_slots = threading.BoundedSemaphore(2)


def validate_url(value: str) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > 4096:
        raise ValueError("URL wajib diisi dan maksimal 4096 karakter")
    if any(ord(char) < 32 for char in value):
        raise ValueError("URL mengandung karakter kontrol")
    value = value.strip()
    parsed = urlsplit(value if "://" in value else "https://" + value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Gunakan URL HTTP/HTTPS tanpa kredensial")
    _ = parsed.port  # rejects malformed ports
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", parsed.query, ""))


def scan(value: str) -> dict | None:
    url = validate_url(value)
    digest = hashlib.sha256(url.encode()).hexdigest()
    version = char_bilstm_scanner._MODEL_VERSION or "cold"
    cache_key = f"proxy:ml-url:{version}:{digest}"
    redis = None
    if os.environ.get("PROXY_FEATURE_ENABLED", "false").lower() in {"true", "1", "yes"}:
        try:
            from services.proxy_store import redis_client
            redis = redis_client()
            cached = redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            redis = None
    if not _slots.acquire(blocking=False):
        return None  # overload is Unknown, never a fabricated clean verdict
    try:
        future = _executor.submit(char_bilstm_scanner.scan_url_dl, url)
    except Exception:
        _slots.release()
        raise
    future.add_done_callback(lambda _future: _slots.release())
    try:
        result = future.result(timeout=float(os.environ.get("ML_SCANNER_TIMEOUT_SECONDS", "1.5")))
    except TimeoutError:
        return None
    if result and redis:
        try:
            key = f"proxy:ml-url:{result['model_version']}:{digest}"
            redis.setex(key, int(os.environ.get("ML_URL_CACHE_TTL_SECONDS", "3600")), json.dumps(result))
        except Exception:
            pass
    return result


def proxy_verdict(value: str) -> dict:
    # URL-trained DL remains available for an explicitly submitted full URL.
    # Its calibration/thresholds cannot be reused for hostname-only traffic.
    from services.domain_scanner import scan as scan_domain
    return scan_domain(value)
