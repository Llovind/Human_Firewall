import type { Language } from '@/i18n/messages';

/** Backend timestamps look like "2026-10-05 12:03:07" (UTC, no zone marker). */
export function parseBackendTime(value: string): number {
  let text = value;
  if (text && !text.endsWith('Z') && !text.includes('+')) text = text.replace(' ', 'T') + 'Z';
  return new Date(text).getTime();
}

/** "35 minutes ago" / "35 menit lalu", in the chosen language. `now` is passed in so render stays pure. */
export function formatAgo(value: string, lang: Language, now: number): string {
  const then = parseBackendTime(value);
  if (!Number.isFinite(then)) return '';
  const rtf = new Intl.RelativeTimeFormat(lang === 'id' ? 'id' : 'en', { numeric: 'auto' });
  const minutes = Math.round((then - now) / 60000);
  if (Math.abs(minutes) < 1) return rtf.format(0, 'minute');
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  return rtf.format(Math.round(hours / 24), 'day');
}
