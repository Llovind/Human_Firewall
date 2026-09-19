"""Database-backed password, OTP, session, and RBAC identity service."""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

import database
from services.email_service import EmailDeliveryError, EmailService


VALID_ROLES = {"employee", "phishing_admin", "soc", "grc", "ciso"}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PASSWORD_HASHER = PasswordHasher(
    time_cost=int(os.environ.get("ARGON2_TIME_COST", "3")),
    memory_cost=int(os.environ.get("ARGON2_MEMORY_COST_KIB", "65536")),
    parallelism=int(os.environ.get("ARGON2_PARALLELISM", "2")),
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)


class AuthError(RuntimeError):
    def __init__(self, code: str, message: str, status: int = 400, retry_after: int | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.retry_after = retry_after


@dataclass(frozen=True)
class AuthIdentity:
    account_id: int
    email: str
    role: str
    division: str
    session_id: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.account_id,
            "email": self.email,
            "userName": self.email.split("@", 1)[0].replace(".", " ").title(),
            "division": self.division or "General",
            "role": self.role,
        }


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _db_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _parse_db_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)


def normalize_email(email: str) -> str:
    normalized = (email or "").strip().lower()
    if not EMAIL_RE.fullmatch(normalized):
        raise AuthError("INVALID_EMAIL", "Format email tidak valid")
    return normalized


def validate_password(password: str) -> None:
    minimum = int(os.environ.get("PASSWORD_MIN_LENGTH", "12"))
    if len(password or "") < minimum:
        raise AuthError("WEAK_PASSWORD", f"Password minimal {minimum} karakter")
    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password) or not re.search(r"\d", password):
        raise AuthError(
            "WEAK_PASSWORD",
            "Password harus memuat huruf besar, huruf kecil, dan angka",
        )


def hash_password(password: str) -> str:
    validate_password(password)
    return PASSWORD_HASHER.hash(password)


def _verify_password(stored_hash: str, password: str) -> bool:
    try:
        return PASSWORD_HASHER.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _secret(name: str) -> bytes:
    value = os.environ.get(name) or os.environ.get("SECRET_KEY", "")
    if not value:
        raise RuntimeError(f"{name} or SECRET_KEY is required")
    return value.encode("utf-8")


def _stable_hash(value: str) -> str:
    return hmac.new(_secret("AUTH_AUDIT_PEPPER"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def client_ip_hash(ip_address: str) -> str:
    return _stable_hash(ip_address or "unknown")


def user_agent_hash(user_agent: str) -> str:
    return _stable_hash(user_agent or "unknown")


def _otp_hash(challenge_id: str, otp_code: str) -> str:
    payload = f"{challenge_id}:{otp_code}".encode("utf-8")
    return hmac.new(_secret("OTP_PEPPER"), payload, hashlib.sha256).hexdigest()


def _session_hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _audit(
    conn: sqlite3.Connection,
    *,
    email: str,
    event_type: str,
    success: bool,
    request_id: str,
    ip_hash: str,
    reason: str = "",
    account_id: int | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO login_audit
            (account_id, email, event_type, success, reason, request_id, ip_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (account_id, email, event_type, int(success), reason[:240], request_id, ip_hash),
    )


def ensure_bootstrap_admin() -> None:
    email = normalize_email(os.environ.get("BOOTSTRAP_ADMIN_EMAIL", "admin@humanfirewall.local"))
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not password:
        raise RuntimeError("ADMIN_PASSWORD is required for the bootstrap account")

    conn = database.get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM employee_accounts WHERE email = ? COLLATE NOCASE", (email,)
        ).fetchone()
        if existing:
            return

        # The Phase 0 bootstrap secret is a generated 48-character value. It
        # may not contain every human-password character class, but its entropy
        # exceeds the interactive password policy and it is still Argon2id-hashed.
        password_hash = PASSWORD_HASHER.hash(password)
        conn.execute(
            """
            INSERT OR IGNORE INTO user_history (email, divisi, click_count, is_active, points, badge)
            VALUES (?, 'IT', 0, 1, 100, 'Guardian')
            """,
            (email,),
        )
        conn.execute(
            """
            INSERT INTO employee_accounts (email, password_hash, role, is_active)
            VALUES (?, ?, 'phishing_admin', 1)
            """,
            (email, password_hash),
        )
        conn.commit()
    finally:
        conn.close()


def create_account(*, email: str, password: str, role: str, division: str, is_active: int = 1) -> dict[str, Any]:
    normalized = normalize_email(email)
    normalized_role = (role or "employee").strip().lower()
    if normalized_role not in VALID_ROLES:
        raise AuthError("INVALID_ROLE", "Role akun tidak valid")
    password_hash = hash_password(password)
    active = 1 if is_active else 0
    division = (division or "General").strip() or "General"

    conn = database.get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        existing = conn.execute(
            "SELECT id FROM employee_accounts WHERE email = ? COLLATE NOCASE", (normalized,)
        ).fetchone()
        if existing:
            raise AuthError("ACCOUNT_EXISTS", "Akun untuk email tersebut sudah tersedia", 409)

        conn.execute("INSERT OR IGNORE INTO divisions (name) VALUES (?)", (division,))
        conn.execute(
            """
            INSERT INTO user_history (email, divisi, click_count, is_active, points, badge)
            VALUES (?, ?, 0, ?, 100, 'Guardian')
            ON CONFLICT(email) DO UPDATE SET
                divisi = excluded.divisi,
                is_active = excluded.is_active,
                updated_at = CURRENT_TIMESTAMP
            """,
            (normalized, division, active),
        )
        cursor = conn.execute(
            """
            INSERT INTO employee_accounts (email, password_hash, role, is_active)
            VALUES (?, ?, ?, ?)
            """,
            (normalized, password_hash, normalized_role, active),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "email": normalized, "role": normalized_role}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def update_account(
    *,
    old_email: str,
    email: str,
    division: str,
    role: str,
    is_active: int,
    new_password: str | None = None,
) -> None:
    old_normalized = normalize_email(old_email)
    normalized = normalize_email(email)
    normalized_role = (role or "employee").strip().lower()
    if normalized_role not in VALID_ROLES:
        raise AuthError("INVALID_ROLE", "Role akun tidak valid")
    active = 1 if is_active else 0
    division = (division or "General").strip() or "General"
    password_hash = hash_password(new_password) if new_password else None

    conn = database.get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        account = conn.execute(
            "SELECT id FROM employee_accounts WHERE email = ? COLLATE NOCASE", (old_normalized,)
        ).fetchone()
        if not account:
            raise AuthError("ACCOUNT_NOT_FOUND", "Akun employee belum tersedia", 404)

        conn.execute("INSERT OR IGNORE INTO divisions (name) VALUES (?)", (division,))
        conn.execute(
            """UPDATE user_history SET email = ?, divisi = ?, is_active = ?,
               updated_at = CURRENT_TIMESTAMP WHERE email = ? COLLATE NOCASE""",
            (normalized, division, active, old_normalized),
        )
        for table in ("events", "registration_otp", "link_tokens", "dashboard_tokens", "threat_reports", "daily_events"):
            conn.execute(f"UPDATE {table} SET email = ? WHERE email = ? COLLATE NOCASE", (normalized, old_normalized))

        if password_hash:
            conn.execute(
                """
                UPDATE employee_accounts SET email = ?, role = ?, is_active = ?,
                    password_hash = ?, password_changed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP WHERE id = ?
                """,
                (normalized, normalized_role, active, password_hash, account["id"]),
            )
            conn.execute(
                "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE account_id = ? AND revoked_at IS NULL",
                (account["id"],),
            )
        else:
            conn.execute(
                """
                UPDATE employee_accounts SET email = ?, role = ?, is_active = ?,
                    updated_at = CURRENT_TIMESTAMP WHERE id = ?
                """,
                (normalized, normalized_role, active, account["id"]),
            )
            if not active:
                conn.execute(
                    "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE account_id = ? AND revoked_at IS NULL",
                    (account["id"],),
                )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_accounts() -> list[dict[str, Any]]:
    conn = database.get_connection()
    try:
        rows = conn.execute(
            """
            SELECT u.email, u.divisi, u.click_count, u.viewed_training_count,
                   u.skipped_training_count, u.points, u.badge,
                   u.reports_count_malicious, u.reports_count_total,
                   u.daily_streak, u.is_active,
                   a.id AS account_id, a.role, a.last_login_at,
                   CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS has_account
            FROM user_history u
            LEFT JOIN employee_accounts a ON lower(a.email) = lower(u.email)
            ORDER BY u.email ASC
            """
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def list_login_audit(limit: int = 100) -> list[dict[str, Any]]:
    conn = database.get_connection()
    try:
        rows = conn.execute(
            """
            SELECT l.id, l.email, l.event_type, l.success, l.reason,
                   l.request_id, l.created_at, a.role
            FROM login_audit l
            LEFT JOIN employee_accounts a ON a.id = l.account_id
            ORDER BY l.id DESC LIMIT ?
            """,
            (max(1, min(limit, 500)),),
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def _rate_limit(conn: sqlite3.Connection, *, email: str, ip_hash: str) -> None:
    window_seconds = int(os.environ.get("OTP_RATE_LIMIT_WINDOW_SECONDS", "900"))
    max_requests = int(os.environ.get("OTP_MAX_REQUESTS_PER_WINDOW", "5"))
    cutoff = _db_timestamp(_utcnow() - timedelta(seconds=window_seconds))
    count = conn.execute(
        """
        SELECT COUNT(*) AS total FROM login_audit
        WHERE email = ? COLLATE NOCASE AND ip_hash = ?
          AND event_type IN ('otp_requested', 'otp_resent')
          AND created_at >= ?
        """,
        (email, ip_hash, cutoff),
    ).fetchone()["total"]
    if count >= max_requests:
        raise AuthError(
            "RATE_LIMITED",
            "Terlalu banyak permintaan OTP. Silakan coba kembali nanti.",
            429,
            retry_after=window_seconds,
        )


def request_login(*, email: str, password: str, ip_address: str, request_id: str) -> dict[str, Any]:
    try:
        normalized = normalize_email(email)
    except AuthError:
        normalized = (email or "").strip().lower()[:254]
    ip_digest = client_ip_hash(ip_address)
    conn = database.get_connection()
    try:
        _rate_limit(conn, email=normalized, ip_hash=ip_digest)
        account = conn.execute(
            """
            SELECT a.*, COALESCE(u.divisi, 'General') AS divisi
            FROM employee_accounts a
            LEFT JOIN user_history u ON lower(u.email) = lower(a.email)
            WHERE a.email = ? COLLATE NOCASE
            """,
            (normalized,),
        ).fetchone()
        if not account or not account["is_active"] or not _verify_password(account["password_hash"], password or ""):
            _audit(
                conn,
                email=normalized or "invalid",
                account_id=account["id"] if account else None,
                event_type="password_failed",
                success=False,
                reason="invalid_credentials",
                request_id=request_id,
                ip_hash=ip_digest,
            )
            conn.commit()
            raise AuthError("INVALID_CREDENTIALS", "Email atau password tidak valid", 401)

        # A fresh password submission must not bypass the resend cooldown.
        # Reuse the current challenge so a browser refresh remains recoverable
        # without generating another email.
        current = conn.execute(
            """
            SELECT id, expires_at, last_sent_at FROM otp_challenges
            WHERE account_id = ? AND used_at IS NULL
            ORDER BY created_at DESC LIMIT 1
            """,
            (account["id"],),
        ).fetchone()
        cooldown = int(os.environ.get("OTP_RESEND_COOLDOWN_SECONDS", "60"))
        if current and _parse_db_timestamp(current["expires_at"]) > _utcnow():
            elapsed = int((_utcnow() - _parse_db_timestamp(current["last_sent_at"])).total_seconds())
            if elapsed < cooldown:
                return {
                    "challengeId": current["id"],
                    "expiresIn": max(1, int((_parse_db_timestamp(current["expires_at"]) - _utcnow()).total_seconds())),
                    "resendCooldown": cooldown - max(0, elapsed),
                    "email": account["email"],
                }

        challenge_id = str(uuid.uuid4())
        otp_code = f"{secrets.randbelow(1_000_000):06d}"
        expiry_seconds = int(os.environ.get("OTP_EXPIRY_SECONDS", "300"))
        max_attempts = int(os.environ.get("OTP_MAX_ATTEMPTS", "5"))
        expires_at = _utcnow() + timedelta(seconds=expiry_seconds)
        conn.execute(
            "UPDATE otp_challenges SET used_at = CURRENT_TIMESTAMP WHERE account_id = ? AND used_at IS NULL",
            (account["id"],),
        )
        conn.execute(
            """
            INSERT INTO otp_challenges
                (id, account_id, otp_hash, expires_at, max_attempts, request_ip_hash)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                challenge_id,
                account["id"],
                _otp_hash(challenge_id, otp_code),
                _db_timestamp(expires_at),
                max_attempts,
                ip_digest,
            ),
        )
        _audit(
            conn,
            email=account["email"],
            account_id=account["id"],
            event_type="otp_requested",
            success=True,
            request_id=request_id,
            ip_hash=ip_digest,
        )
        conn.commit()

        EmailService().send_login_otp(
            to_address=account["email"],
            otp_code=otp_code,
            expires_minutes=max(1, expiry_seconds // 60),
        )
        return {
            "challengeId": challenge_id,
            "expiresIn": expiry_seconds,
            "resendCooldown": int(os.environ.get("OTP_RESEND_COOLDOWN_SECONDS", "60")),
            "email": account["email"],
        }
    except EmailDeliveryError:
        if 'challenge_id' in locals():
            conn.execute("UPDATE otp_challenges SET used_at = CURRENT_TIMESTAMP WHERE id = ?", (challenge_id,))
            _audit(
                conn,
                email=normalized or "invalid",
                account_id=account["id"] if 'account' in locals() and account else None,
                event_type="otp_delivery_failed",
                success=False,
                reason="smtp_error",
                request_id=request_id,
                ip_hash=ip_digest,
            )
            conn.commit()
        raise AuthError("EMAIL_DELIVERY_FAILED", "OTP tidak dapat dikirim. Hubungi administrator.", 503)
    finally:
        conn.close()


def resend_otp(*, challenge_id: str, ip_address: str, request_id: str) -> dict[str, Any]:
    ip_digest = client_ip_hash(ip_address)
    conn = database.get_connection()
    try:
        row = conn.execute(
            """
            SELECT c.*, a.email, a.is_active FROM otp_challenges c
            JOIN employee_accounts a ON a.id = c.account_id WHERE c.id = ?
            """,
            (challenge_id,),
        ).fetchone()
        if not row or row["used_at"] or not row["is_active"]:
            raise AuthError("INVALID_CHALLENGE", "Sesi OTP tidak valid. Silakan masuk kembali.", 400)
        _rate_limit(conn, email=row["email"], ip_hash=ip_digest)
        cooldown = int(os.environ.get("OTP_RESEND_COOLDOWN_SECONDS", "60"))
        elapsed = int((_utcnow() - _parse_db_timestamp(row["last_sent_at"])).total_seconds())
        if elapsed < cooldown:
            remaining = cooldown - max(0, elapsed)
            raise AuthError("RESEND_COOLDOWN", "Tunggu sebelum meminta OTP baru.", 429, remaining)

        otp_code = f"{secrets.randbelow(1_000_000):06d}"
        expiry_seconds = int(os.environ.get("OTP_EXPIRY_SECONDS", "300"))
        conn.execute(
            """
            UPDATE otp_challenges SET otp_hash = ?, expires_at = ?, attempts = 0,
                resend_count = resend_count + 1, last_sent_at = CURRENT_TIMESTAMP,
                request_ip_hash = ? WHERE id = ?
            """,
            (
                _otp_hash(challenge_id, otp_code),
                _db_timestamp(_utcnow() + timedelta(seconds=expiry_seconds)),
                ip_digest,
                challenge_id,
            ),
        )
        _audit(
            conn,
            email=row["email"], account_id=row["account_id"], event_type="otp_resent",
            success=True, request_id=request_id, ip_hash=ip_digest,
        )
        conn.commit()
        EmailService().send_login_otp(
            to_address=row["email"], otp_code=otp_code,
            expires_minutes=max(1, expiry_seconds // 60),
        )
        return {"expiresIn": expiry_seconds, "resendCooldown": cooldown}
    except EmailDeliveryError:
        # The database update happens before SMTP so concurrent verification
        # cannot race with a resend. If delivery fails, retire that challenge:
        # no valid-but-undelivered OTP may remain active.
        if 'row' in locals() and row:
            conn.execute(
                "UPDATE otp_challenges SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
                (challenge_id,),
            )
            _audit(
                conn,
                email=row["email"],
                account_id=row["account_id"],
                event_type="otp_delivery_failed",
                success=False,
                reason="smtp_error_after_resend",
                request_id=request_id,
                ip_hash=ip_digest,
            )
            conn.commit()
        raise AuthError("EMAIL_DELIVERY_FAILED", "OTP tidak dapat dikirim. Hubungi administrator.", 503)
    finally:
        conn.close()


def verify_login_otp(
    *, challenge_id: str, otp_code: str, ip_address: str, user_agent: str, request_id: str
) -> tuple[str, dict[str, Any], int]:
    ip_digest = client_ip_hash(ip_address)
    conn = database.get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            """
            SELECT c.*, a.email, a.role, a.is_active, COALESCE(u.divisi, 'General') AS divisi
            FROM otp_challenges c
            JOIN employee_accounts a ON a.id = c.account_id
            LEFT JOIN user_history u ON lower(u.email) = lower(a.email)
            WHERE c.id = ?
            """,
            (challenge_id,),
        ).fetchone()
        if not row or row["used_at"] or not row["is_active"]:
            raise AuthError("INVALID_CHALLENGE", "Sesi OTP tidak valid. Silakan masuk kembali.", 400)
        if _parse_db_timestamp(row["expires_at"]) <= _utcnow():
            conn.execute("UPDATE otp_challenges SET used_at = CURRENT_TIMESTAMP WHERE id = ?", (challenge_id,))
            conn.commit()
            raise AuthError("OTP_EXPIRED", "Kode OTP sudah kedaluwarsa", 400)
        if row["attempts"] >= row["max_attempts"]:
            raise AuthError("OTP_LOCKED", "Batas percobaan OTP telah tercapai", 429)

        supplied = _otp_hash(challenge_id, (otp_code or "").strip())
        if not hmac.compare_digest(supplied, row["otp_hash"]):
            attempts = row["attempts"] + 1
            conn.execute(
                "UPDATE otp_challenges SET attempts = ?, used_at = CASE WHEN ? >= max_attempts THEN CURRENT_TIMESTAMP ELSE used_at END WHERE id = ?",
                (attempts, attempts, challenge_id),
            )
            _audit(
                conn, email=row["email"], account_id=row["account_id"], event_type="otp_failed",
                success=False, reason="invalid_otp", request_id=request_id, ip_hash=ip_digest,
            )
            conn.commit()
            remaining = max(0, row["max_attempts"] - attempts)
            raise AuthError("INVALID_OTP", f"Kode OTP tidak valid. Sisa percobaan: {remaining}", 401)

        raw_token = secrets.token_urlsafe(48)
        session_id = str(uuid.uuid4())
        ttl_seconds = int(os.environ.get("AUTH_SESSION_TTL_SECONDS", "28800"))
        expires_at = _utcnow() + timedelta(seconds=ttl_seconds)
        conn.execute("UPDATE otp_challenges SET used_at = CURRENT_TIMESTAMP WHERE id = ?", (challenge_id,))
        conn.execute(
            """
            INSERT INTO auth_sessions
                (id, account_id, token_hash, expires_at, ip_hash, user_agent_hash)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session_id, row["account_id"], _session_hash(raw_token),
                _db_timestamp(expires_at), ip_digest, user_agent_hash(user_agent),
            ),
        )
        conn.execute(
            "UPDATE employee_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
            (row["account_id"],),
        )
        _audit(
            conn, email=row["email"], account_id=row["account_id"], event_type="login_succeeded",
            success=True, request_id=request_id, ip_hash=ip_digest,
        )
        conn.commit()
        identity = AuthIdentity(
            account_id=row["account_id"], email=row["email"], role=row["role"],
            division=row["divisi"], session_id=session_id,
        )
        return raw_token, identity.as_dict(), ttl_seconds
    except Exception:
        if conn.in_transaction:
            conn.rollback()
        raise
    finally:
        conn.close()


def get_identity(raw_token: str) -> AuthIdentity | None:
    if not raw_token:
        return None
    conn = database.get_connection()
    try:
        row = conn.execute(
            """
            SELECT s.id AS session_id, s.expires_at, s.revoked_at,
                   a.id AS account_id, a.email, a.role, a.is_active,
                   COALESCE(u.divisi, 'General') AS divisi
            FROM auth_sessions s
            JOIN employee_accounts a ON a.id = s.account_id
            LEFT JOIN user_history u ON lower(u.email) = lower(a.email)
            WHERE s.token_hash = ?
            """,
            (_session_hash(raw_token),),
        ).fetchone()
        if not row or row["revoked_at"] or not row["is_active"]:
            return None
        if _parse_db_timestamp(row["expires_at"]) <= _utcnow():
            return None
        conn.execute(
            "UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?",
            (row["session_id"],),
        )
        conn.commit()
        return AuthIdentity(
            account_id=row["account_id"], email=row["email"], role=row["role"],
            division=row["divisi"], session_id=row["session_id"],
        )
    finally:
        conn.close()


def revoke_session(raw_token: str) -> None:
    if not raw_token:
        return
    conn = database.get_connection()
    try:
        conn.execute(
            "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL",
            (_session_hash(raw_token),),
        )
        conn.commit()
    finally:
        conn.close()
