"""Persistent and real-time storage for AFFERENT's centralized proxy.

PostgreSQL is the source of truth. Redis is deliberately treated as a hot
path only: cached verdicts, short-lived device bindings, event buffering, and
SOC notifications can all be rebuilt from PostgreSQL.
"""

from __future__ import annotations

import json
import os
import socket
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


_pool = None
_redis = None
_init_lock = threading.Lock()
_consumer_started = False


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS proxy_devices (
    id UUID PRIMARY KEY,
    account_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    label TEXT,
    source_ip_hash TEXT NOT NULL UNIQUE,
    source_ip_hint TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_proxy_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS proxy_url_verdicts (
    id UUID PRIMARY KEY,
    domain TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('soc', 'ml', 'employee_report')),
    decision TEXT NOT NULL CHECK (decision IN ('allow', 'block')),
    verdict TEXT NOT NULL CHECK (verdict IN ('safe', 'malicious', 'unknown')),
    reason TEXT NOT NULL,
    confidence DOUBLE PRECISION,
    model_version TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT,
    UNIQUE(domain, source)
);

CREATE TABLE IF NOT EXISTS proxy_traffic_events (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    schema_version TEXT NOT NULL,
    device_id UUID,
    account_id INTEGER,
    employee_email TEXT,
    domain TEXT NOT NULL,
    port INTEGER,
    method TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('allow', 'block')),
    decision_source TEXT NOT NULL,
    reason TEXT NOT NULL,
    request_id TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proxy_alerts (
    sequence BIGSERIAL PRIMARY KEY,
    id UUID NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    device_id UUID,
    account_id INTEGER,
    employee_email TEXT,
    urgency TEXT NOT NULL CHECK (urgency IN ('Critical', 'Unknown')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'blocked', 'allowed')),
    verdict TEXT NOT NULL CHECK (verdict IN ('malicious', 'unknown')),
    reason TEXT NOT NULL,
    confidence DOUBLE PRECISION,
    source TEXT NOT NULL,
    request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT
);

CREATE TABLE IF NOT EXISTS proxy_decision_audit (
    id BIGSERIAL PRIMARY KEY,
    actor_email TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    before_state JSONB,
    after_state JSONB NOT NULL,
    request_id TEXT NOT NULL,
    alert_id UUID,
    domain TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proxy_ml_verdict_events (
    event_id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proxy_verdict_domain_active
    ON proxy_url_verdicts(domain, active, source);
CREATE INDEX IF NOT EXISTS idx_proxy_traffic_created
    ON proxy_traffic_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proxy_traffic_account
    ON proxy_traffic_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proxy_alert_status_sequence
    ON proxy_alerts(status, sequence DESC);

CREATE OR REPLACE FUNCTION reject_proxy_audit_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'proxy_decision_audit is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proxy_audit_no_update ON proxy_decision_audit;
CREATE TRIGGER proxy_audit_no_update
BEFORE UPDATE ON proxy_decision_audit
FOR EACH ROW EXECUTE FUNCTION reject_proxy_audit_mutation();

DROP TRIGGER IF EXISTS proxy_audit_no_delete ON proxy_decision_audit;
CREATE TRIGGER proxy_audit_no_delete
BEFORE DELETE ON proxy_decision_audit
FOR EACH ROW EXECUTE FUNCTION reject_proxy_audit_mutation();
"""


def _secret(name: str, default: str = "") -> str:
    direct = os.environ.get(name, "").strip()
    if direct:
        return direct
    file_name = os.environ.get(f"{name}_FILE", "").strip()
    if file_name:
        return Path(file_name).read_text(encoding="utf-8").strip()
    return default


def _database_dsn() -> str:
    explicit = os.environ.get("PROXY_DATABASE_URL", "").strip()
    if explicit:
        return explicit
    password = _secret("PROXY_DB_PASSWORD")
    if not password:
        raise RuntimeError("PROXY_DB_PASSWORD or PROXY_DB_PASSWORD_FILE is required")
    return (
        f"host={os.environ.get('PROXY_DB_HOST', 'proxy_postgres')} "
        f"port={os.environ.get('PROXY_DB_PORT', '5432')} "
        f"dbname={os.environ.get('PROXY_DB_NAME', 'afferent_proxy')} "
        f"user={os.environ.get('PROXY_DB_USER', 'afferent')} "
        f"password={password} connect_timeout=5"
    )


def _get_pool():
    global _pool
    if _pool is None:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        _pool = ConnectionPool(
            conninfo=_database_dsn(),
            min_size=1,
            max_size=int(os.environ.get("PROXY_DB_POOL_SIZE", "10")),
            kwargs={"row_factory": dict_row},
            open=False,
        )
        _pool.open(wait=True, timeout=15)
    return _pool


def redis_client():
    global _redis
    if _redis is None:
        import redis

        _redis = redis.Redis(
            host=os.environ.get("REDIS_HOST", "proxy_redis"),
            port=int(os.environ.get("REDIS_PORT", "6379")),
            password=_secret("REDIS_PASSWORD") or None,
            db=int(os.environ.get("REDIS_DB", "0")),
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
            health_check_interval=30,
        )
    return _redis


@contextmanager
def connection() -> Iterator[Any]:
    with _get_pool().connection() as conn:
        yield conn


def init_proxy_runtime() -> None:
    """Create the schema and start the Redis Stream persistence worker."""
    global _consumer_started
    with _init_lock:
        with connection() as conn:
            conn.execute(SCHEMA_SQL)
        redis_client().ping()
        if not _consumer_started:
            _ensure_stream_group()
            threading.Thread(
                target=_traffic_consumer,
                name="afferent-proxy-traffic-writer",
                daemon=True,
            ).start()
            _consumer_started = True


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return str(value)


def _ensure_stream_group() -> None:
    client = redis_client()
    try:
        client.xgroup_create("proxy:traffic", "postgres-writers", id="0", mkstream=True)
    except Exception as exc:
        if "BUSYGROUP" not in str(exc):
            raise


def cache_verdict(domain: str, verdict: dict[str, Any], ttl_seconds: int) -> None:
    redis_client().setex(
        f"proxy:verdict:{domain}",
        max(1, ttl_seconds),
        json.dumps(verdict, default=_json_default, separators=(",", ":")),
    )


def get_cached_verdict(domain: str) -> dict[str, Any] | None:
    try:
        raw = redis_client().get(f"proxy:verdict:{domain}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


def invalidate_verdict(domain: str) -> None:
    try:
        redis_client().delete(f"proxy:verdict:{domain}")
    except Exception:
        pass


def acquire_scan_lock(domain: str, ttl_seconds: int = 10) -> bool:
    try:
        return bool(redis_client().set(f"proxy:scan-lock:{domain}", "1", nx=True, ex=ttl_seconds))
    except Exception:
        return True


def release_scan_lock(domain: str) -> None:
    try:
        redis_client().delete(f"proxy:scan-lock:{domain}")
    except Exception:
        pass


def get_idempotent_decision(event_id: str) -> dict[str, Any] | None:
    try:
        raw = redis_client().get(f"proxy:decision:{event_id}")
        return json.loads(raw) if raw else None
    except Exception:
        return None


def cache_idempotent_decision(event_id: str, payload: dict[str, Any]) -> None:
    try:
        redis_client().setex(
            f"proxy:decision:{event_id}",
            int(os.environ.get("PROXY_IDEMPOTENCY_TTL_SECONDS", "600")),
            json.dumps(payload, separators=(",", ":")),
        )
    except Exception:
        pass


def upsert_device(device: dict[str, Any], ttl_seconds: int) -> dict[str, Any] | None:
    with connection() as conn:
        row = conn.execute(
            """
            INSERT INTO proxy_devices
                (id, account_id, email, role, label, source_ip_hash, source_ip_hint,
                 active, registered_at, last_heartbeat_at)
            VALUES (%(id)s, %(account_id)s, %(email)s, %(role)s, %(label)s,
                    %(source_ip_hash)s, %(source_ip_hint)s, TRUE, NOW(), NOW())
            ON CONFLICT (source_ip_hash) DO UPDATE SET
                account_id = EXCLUDED.account_id,
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                label = EXCLUDED.label,
                active = TRUE,
                last_heartbeat_at = NOW()
            WHERE proxy_devices.account_id = EXCLUDED.account_id
            RETURNING *
            """,
            device,
        ).fetchone()
    if not row:
        return None
    payload = dict(row)
    redis_client().setex(
        f"proxy:device:{device['source_ip_hash']}",
        ttl_seconds,
        json.dumps(payload, default=_json_default, separators=(",", ":")),
    )
    return payload


def heartbeat_device(source_ip_hash: str, ttl_seconds: int) -> dict[str, Any] | None:
    with connection() as conn:
        row = conn.execute(
            """
            UPDATE proxy_devices SET active = TRUE, last_heartbeat_at = NOW()
            WHERE source_ip_hash = %s
            RETURNING *
            """,
            (source_ip_hash,),
        ).fetchone()
    if not row:
        return None
    payload = dict(row)
    redis_client().setex(
        f"proxy:device:{source_ip_hash}",
        ttl_seconds,
        json.dumps(payload, default=_json_default, separators=(",", ":")),
    )
    return payload


def get_device(source_ip_hash: str) -> dict[str, Any] | None:
    try:
        raw = redis_client().get(f"proxy:device:{source_ip_hash}")
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    ttl = int(os.environ.get("PROXY_DEVICE_TTL_SECONDS", "28800"))
    with connection() as conn:
        row = conn.execute(
            """
            SELECT * FROM proxy_devices
            WHERE source_ip_hash = %s AND active = TRUE
              AND last_heartbeat_at >= NOW() - (%s * INTERVAL '1 second')
            """,
            (source_ip_hash, ttl),
        ).fetchone()
    if not row:
        return None
    payload = dict(row)
    try:
        redis_client().setex(
            f"proxy:device:{source_ip_hash}",
            ttl,
            json.dumps(payload, default=_json_default, separators=(",", ":")),
        )
    except Exception:
        pass
    return payload


def get_device_for_account(account_id: int) -> dict[str, Any] | None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT * FROM proxy_devices WHERE account_id = %s
            ORDER BY last_heartbeat_at DESC LIMIT 1
            """,
            (account_id,),
        ).fetchone()
    return dict(row) if row else None


def deactivate_account_devices(account_id: int) -> None:
    with connection() as conn:
        rows = conn.execute(
            "UPDATE proxy_devices SET active = FALSE WHERE account_id = %s RETURNING source_ip_hash",
            (account_id,),
        ).fetchall()
    try:
        if rows:
            redis_client().delete(*(f"proxy:device:{row['source_ip_hash']}" for row in rows))
    except Exception:
        pass


def mark_proxy_seen(device_id: str) -> None:
    with connection() as conn:
        row = conn.execute(
            "UPDATE proxy_devices SET last_proxy_seen_at = NOW() WHERE id = %s RETURNING *",
            (device_id,),
        ).fetchone()
    if not row:
        return
    payload = dict(row)
    try:
        redis_client().setex(
            f"proxy:device:{payload['source_ip_hash']}",
            int(os.environ.get("PROXY_DEVICE_TTL_SECONDS", "28800")),
            json.dumps(payload, default=_json_default, separators=(",", ":")),
        )
    except Exception:
        pass


def get_effective_verdict(domain: str) -> dict[str, Any] | None:
    with connection() as conn:
        row = conn.execute(
            """
            SELECT * FROM proxy_url_verdicts
            WHERE domain = %s AND active = TRUE
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY CASE WHEN source = 'soc' THEN 0 WHEN source = 'ml' THEN 1 ELSE 2 END,
                     updated_at DESC
            LIMIT 1
            """,
            (domain,),
        ).fetchone()
    return dict(row) if row else None


def upsert_verdict(verdict: dict[str, Any]) -> dict[str, Any]:
    with connection() as conn:
        row = conn.execute(
            """
            INSERT INTO proxy_url_verdicts
                (id, domain, source, decision, verdict, reason, confidence,
                 model_version, active, expires_at, updated_by)
            VALUES (%(id)s, %(domain)s, %(source)s, %(decision)s, %(verdict)s,
                    %(reason)s, %(confidence)s, %(model_version)s, TRUE,
                    %(expires_at)s, %(updated_by)s)
            ON CONFLICT (domain, source) DO UPDATE SET
                decision = EXCLUDED.decision,
                verdict = EXCLUDED.verdict,
                reason = EXCLUDED.reason,
                confidence = EXCLUDED.confidence,
                model_version = EXCLUDED.model_version,
                active = TRUE,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
            RETURNING *
            """,
            verdict,
        ).fetchone()
    invalidate_verdict(verdict["domain"])
    return dict(row)


def list_verdicts(limit: int = 200) -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM proxy_url_verdicts WHERE active = TRUE
            ORDER BY updated_at DESC LIMIT %s
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def enqueue_traffic(event: dict[str, Any]) -> None:
    try:
        redis_client().xadd(
            "proxy:traffic",
            {"payload": json.dumps(event, default=_json_default, separators=(",", ":"))},
            maxlen=int(os.environ.get("PROXY_TRAFFIC_STREAM_MAXLEN", "10000")),
            approximate=True,
        )
    except Exception:
        _insert_traffic(event)


def _insert_traffic(event: dict[str, Any]) -> None:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO proxy_traffic_events
                (event_id, schema_version, device_id, account_id, employee_email,
                 domain, port, method, action, decision_source, reason,
                 request_id, occurred_at)
            VALUES (%(event_id)s, %(schema_version)s, %(device_id)s, %(account_id)s,
                    %(employee_email)s, %(domain)s, %(port)s, %(method)s,
                    %(action)s, %(decision_source)s, %(reason)s, %(request_id)s,
                    %(occurred_at)s)
            ON CONFLICT (event_id) DO NOTHING
            """,
            event,
        )
    # Publish only after commit so an SSE-triggered refresh can read this row.
    publish_alert({"type": "traffic.observed", "traffic": event})


def _traffic_consumer() -> None:
    consumer = f"{socket.gethostname()}-{os.getpid()}"
    while True:
        try:
            records = redis_client().xreadgroup(
                "postgres-writers",
                consumer,
                {"proxy:traffic": ">"},
                count=100,
                block=5000,
            )
            for _stream, messages in records:
                for message_id, fields in messages:
                    _insert_traffic(json.loads(fields["payload"]))
                    redis_client().xack("proxy:traffic", "postgres-writers", message_id)
        except Exception:
            time.sleep(2)


def list_traffic(limit: int = 200, account_id: int | None = None) -> list[dict[str, Any]]:
    query = "SELECT * FROM proxy_traffic_events"
    params: tuple[Any, ...]
    if account_id is not None:
        query += " WHERE account_id = %s"
        params = (account_id, limit)
    else:
        params = (limit,)
    query += " ORDER BY created_at DESC LIMIT %s"
    with connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(row) for row in rows]


def create_alert(alert: dict[str, Any]) -> dict[str, Any]:
    with connection() as conn:
        existing = conn.execute(
            """
            SELECT * FROM proxy_alerts
            WHERE domain = %(domain)s AND source = %(source)s AND status = 'open'
            ORDER BY sequence DESC LIMIT 1
            """,
            alert,
        ).fetchone()
        if existing:
            return dict(existing)
        row = conn.execute(
            """
            INSERT INTO proxy_alerts
                (id, domain, device_id, account_id, employee_email, urgency,
                 status, verdict, reason, confidence, source, request_id)
            VALUES (%(id)s, %(domain)s, %(device_id)s, %(account_id)s,
                    %(employee_email)s, %(urgency)s, 'open', %(verdict)s,
                    %(reason)s, %(confidence)s, %(source)s, %(request_id)s)
            RETURNING *
            """,
            alert,
        ).fetchone()
    payload = dict(row)
    publish_alert({"type": "alert.created", "alert": payload})
    return payload


def list_alerts(limit: int = 200) -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM proxy_alerts
            WHERE NOT (
                source = 'ml' AND reason = 'Model ML belum dikonfigurasi'
            )
            ORDER BY sequence DESC LIMIT %s
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_alert(alert_id: str) -> dict[str, Any] | None:
    with connection() as conn:
        row = conn.execute("SELECT * FROM proxy_alerts WHERE id = %s", (alert_id,)).fetchone()
    return dict(row) if row else None


def resolve_alert(alert_id: str, status: str, actor_email: str) -> dict[str, Any] | None:
    with connection() as conn:
        row = conn.execute(
            """
            UPDATE proxy_alerts SET status = %s, resolved_at = NOW(), resolved_by = %s
            WHERE id = %s RETURNING *
            """,
            (status, actor_email, alert_id),
        ).fetchone()
    payload = dict(row) if row else None
    if payload:
        publish_alert({"type": "alert.updated", "alert": payload})
    return payload


def append_audit(entry: dict[str, Any]) -> None:
    with connection() as conn:
        conn.execute(
            """
            INSERT INTO proxy_decision_audit
                (actor_email, actor_role, action, reason, before_state,
                 after_state, request_id, alert_id, domain)
            VALUES (%(actor_email)s, %(actor_role)s, %(action)s, %(reason)s,
                    %(before_state)s::jsonb, %(after_state)s::jsonb, %(request_id)s,
                    %(alert_id)s, %(domain)s)
            """,
            {
                **entry,
                "before_state": json.dumps(entry.get("before_state"), default=_json_default),
                "after_state": json.dumps(entry["after_state"], default=_json_default),
            },
        )


def apply_manual_decision(
    verdict: dict[str, Any], audit: dict[str, Any], alert_id: str | None
) -> tuple[dict[str, Any] | None, dict[str, Any], dict[str, Any] | None]:
    """Atomically persist the SOC verdict, alert resolution, and audit row."""
    with connection() as conn:
        before_row = conn.execute(
            """
            SELECT * FROM proxy_url_verdicts
            WHERE domain = %s AND active = TRUE
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY CASE WHEN source = 'soc' THEN 0 WHEN source = 'ml' THEN 1 ELSE 2 END,
                     updated_at DESC
            LIMIT 1
            """,
            (verdict["domain"],),
        ).fetchone()
        row = conn.execute(
            """
            INSERT INTO proxy_url_verdicts
                (id, domain, source, decision, verdict, reason, confidence,
                 model_version, active, expires_at, updated_by)
            VALUES (%(id)s, %(domain)s, %(source)s, %(decision)s, %(verdict)s,
                    %(reason)s, %(confidence)s, %(model_version)s, TRUE,
                    %(expires_at)s, %(updated_by)s)
            ON CONFLICT (domain, source) DO UPDATE SET
                decision = EXCLUDED.decision,
                verdict = EXCLUDED.verdict,
                reason = EXCLUDED.reason,
                confidence = EXCLUDED.confidence,
                model_version = EXCLUDED.model_version,
                active = TRUE,
                expires_at = EXCLUDED.expires_at,
                updated_at = NOW(),
                updated_by = EXCLUDED.updated_by
            RETURNING *
            """,
            verdict,
        ).fetchone()
        resolved = None
        if alert_id:
            resolved = conn.execute(
                """
                UPDATE proxy_alerts SET status = %s, resolved_at = NOW(), resolved_by = %s
                WHERE id = %s RETURNING *
                """,
                (
                    "blocked" if verdict["decision"] == "block" else "allowed",
                    verdict["updated_by"],
                    alert_id,
                ),
            ).fetchone()
        before = dict(before_row) if before_row else None
        after = dict(row)
        conn.execute(
            """
            INSERT INTO proxy_decision_audit
                (actor_email, actor_role, action, reason, before_state,
                 after_state, request_id, alert_id, domain)
            VALUES (%(actor_email)s, %(actor_role)s, %(action)s, %(reason)s,
                    %(before_state)s::jsonb, %(after_state)s::jsonb, %(request_id)s,
                    %(alert_id)s, %(domain)s)
            """,
            {
                **audit,
                "before_state": json.dumps(before, default=_json_default),
                "after_state": json.dumps(after, default=_json_default),
            },
        )
    invalidate_verdict(verdict["domain"])
    return before, after, dict(resolved) if resolved else None


def list_audit(limit: int = 200) -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute(
            "SELECT * FROM proxy_decision_audit ORDER BY id DESC LIMIT %s",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def record_ml_event(event_id: str, domain: str, payload: dict[str, Any]) -> bool:
    with connection() as conn:
        row = conn.execute(
            """
            INSERT INTO proxy_ml_verdict_events (event_id, domain, payload)
            VALUES (%s, %s, %s::jsonb)
            ON CONFLICT (event_id) DO NOTHING
            RETURNING event_id
            """,
            (event_id, domain, json.dumps(payload, separators=(",", ":"))),
        ).fetchone()
    return bool(row)


def publish_alert(payload: dict[str, Any]) -> None:
    try:
        redis_client().publish(
            "proxy:soc-events",
            json.dumps(payload, default=_json_default, separators=(",", ":")),
        )
    except Exception:
        pass
