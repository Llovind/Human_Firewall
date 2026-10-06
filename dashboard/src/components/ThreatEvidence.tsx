'use client';

import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

export type ThreatAnalysis = {
  verdict: string;
  providerStatus?: Record<string, { state: string; statusCode: number }>;
  evidence?: Record<string, { verdict: string; vt_score?: number }>;
};

export type EmployeeReport = {
  id: string; email: string; url: string; description: string; verdict: string;
  status: string; created_at: string;
  analysis?: ThreatAnalysis;
};

export type FileScan = {
  id: string; file_name: string; file_sha256: string; file_size: number;
  verdict: string; status: 'pending' | 'completed' | 'unknown'; created_at: string;
  analysis: ThreatAnalysis;
};

const STATES = ['ready', 'no_record', 'no_verdict', 'result_unavailable', 'not_configured', 'rate_limited', 'unavailable', 'queued', 'pending', 'expired'];

export default function ThreatEvidence({ analysis }: { analysis?: ThreatAnalysis }) {
  const { t } = useI18n();
  return <details className="provider-details"><summary>{t('ev.title')}</summary>
    {analysis?.providerStatus ? Object.entries(analysis.providerStatus).map(([provider, status]) =>
      <p key={provider}><strong>{provider === 'virustotal' ? 'VirusTotal' : 'urlscan'}</strong>: {STATES.includes(status.state) ? t(`ev.state.${status.state}` as MessageKey) : status.state}
        {analysis.evidence?.[provider] && <> · {analysis.evidence[provider].verdict}
          {analysis.evidence[provider].vt_score != null && <> · {t('ev.detections', { n: analysis.evidence[provider].vt_score ?? 0 })}</>}</>}
      </p>) : <p>{t('ev.none')}</p>}
    <small>{t('ev.note')}</small>
  </details>;
}
