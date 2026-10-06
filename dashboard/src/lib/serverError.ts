import type { MessageKey } from '@/i18n/messages';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Codes the back end sends with its errors. Each has a sentence in both languages (`srv.<CODE>`). */
const KNOWN = new Set([
  'INVALID_PAYLOAD', 'FIELD_REQUIRED', 'TEXT_TOO_SHORT', 'TEXT_TOO_LONG', 'INVALID_DOMAIN', 'INVALID_FILTER', 'INVALID_DECISION',
  'INVALID_VALUE', 'INVALID_ACTION', 'ALREADY_DECIDED', 'NOT_FOUND', 'TEMPORARILY_UNAVAILABLE', 'SERVER_ERROR', 'FEATURE_DISABLED',
  'REASON_REQUIRED', 'NOT_ELIGIBLE', 'ON_COOLDOWN', 'NO_RECIPIENTS', 'NAME_REQUIRED', 'INVALID_URL', 'FORBIDDEN', 'UNAUTHORIZED',
  'ACCOUNT_EXISTS', 'INVALID_EMAIL', 'WEAK_PASSWORD', 'INVALID_ROLE', 'ACCOUNT_NOT_FOUND', 'INVALID_PASSWORD', 'PASSWORD_UNCHANGED',
  'INVALID_CREDENTIALS', 'RATE_LIMITED', 'INVALID_LANGUAGE',
]);

/**
 * The sentence to show for a failed request, in the person's language.
 * A known code gives its own sentence; anything else gives the screen's own fallback.
 * The server's raw text is never shown, because it can be in a different language than the page.
 */
export function serverMessage(body: unknown, t: Translate, fallback: MessageKey): string {
  const code = body && typeof body === 'object' && 'code' in body ? String((body as { code: unknown }).code) : '';
  return KNOWN.has(code) ? t(`srv.${code}` as MessageKey) : t(fallback);
}

/** Same as serverMessage, for callers that already hold the fallback sentence. Returns null when the code is unknown. */
export function knownServerMessage(body: unknown, t: Translate): string | null {
  const code = body && typeof body === 'object' && 'code' in body ? String((body as { code: unknown }).code) : '';
  return KNOWN.has(code) ? t(`srv.${code}` as MessageKey) : null;
}
