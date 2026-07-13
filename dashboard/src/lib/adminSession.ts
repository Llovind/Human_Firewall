import crypto from 'crypto';

/**
 * Minimal in-memory admin session store.
 *
 * Kenapa in-memory (bukan JWT/stateless): app ini jalan sebagai satu
 * long-running Node process di Docker Compose (bukan serverless/multi-instance),
 * jadi Map di memory cukup dan lebih simpel daripada nambah dependency JWT
 * atau nyimpen secret tambahan. Kalau nanti di-deploy multi-instance/serverless,
 * ganti ke signed cookie (JWT) atau session store eksternal (Redis, dll).
 *
 * Sessions expire otomatis setelah SESSION_TTL_MS. Token di-generate pakai
 * crypto.randomBytes (bukan predictable), jadi nggak bisa ditebak.
 */

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam

type SessionRecord = {
  createdAt: number;
  expiresAt: number;
};

declare global {
  var _admin_sessions: Map<string, SessionRecord> | undefined;
}

const sessions = globalThis._admin_sessions || new Map<string, SessionRecord>();
globalThis._admin_sessions = sessions;


function purgeExpired() {
  const now = Date.now();
  for (const [token, record] of sessions.entries()) {
    if (record.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

export function createAdminSession(): { token: string; expiresAt: number } {
  purgeExpired();
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  sessions.set(token, { createdAt: now, expiresAt });
  return { token, expiresAt };
}

export function isValidAdminSession(token: string | undefined | null): boolean {
  if (!token) return false;
  purgeExpired();
  const record = sessions.get(token);
  if (!record) return false;
  if (record.expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function revokeAdminSession(token: string | undefined | null): void {
  if (!token) return;
  sessions.delete(token);
}

export const ADMIN_SESSION_COOKIE = 'hf_admin_session';
