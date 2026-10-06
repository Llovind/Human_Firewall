'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

type Review = { status: string; model?: string; result?: {
  assessment: string; category?: string; reason: string; elapsedMs?: number;
} };

export default function DomainSecondOpinion({ domain }: { domain: string }) {
  const { t } = useI18n();
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = review?.status === 'queued' || review?.status === 'running';
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch('/api/proxy/second-opinion?domain=' + encodeURIComponent(domain), { cache: 'no-store', signal: controller.signal });
        const result = await res.json();
        if (!res.ok) throw new Error('refresh');
        if (!controller.signal.aborted) { setReview(result); setError(''); }
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error && err.message === 'refresh' ? t('so.err.refresh') : t('so.err.unavailable')); }
    }, 5000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [pending, domain, t]);

  async function requestReview() {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/proxy/second-opinion', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain }) });
      const result = await res.json();
      if (!res.ok) throw new Error('unavailable');
      setReview(result);
    } catch (err) { setError(err instanceof Error && err.message === 'refresh' ? t('so.err.refresh') : t('so.err.unavailable')); }
    finally { setBusy(false); }
  }

  return <div className="local-review">
    <button className="btn" disabled={busy || pending} onClick={() => void requestReview()}>
      {busy || pending ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
      {pending ? t('so.queued') : t('so.ask')}
    </button>
    {error && <p role="alert" className="debt-error">{error}</p>}
    {review?.result && <div className="local-review-result" role="status">
      <strong>{review.result.assessment.replaceAll('_', ' ')}</strong>
      <p>{review.result.reason}</p>
      <small>{t('so.note', { model: review.model ?? '', time: review.result.elapsedMs != null ? ' · ' + t('so.time', { s: (review.result.elapsedMs / 1000).toFixed(2) }) : '' })}</small>
    </div>}
  </div>;
}
