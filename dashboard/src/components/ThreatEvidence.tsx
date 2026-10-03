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

const labels: Record<string, string> = {
  ready: 'Results available', no_record: 'No existing scan', no_verdict: 'No verdict',
  result_unavailable: 'Full results unavailable', not_configured: 'API key not configured',
  rate_limited: 'Rate limited — try later', unavailable: 'Provider unavailable',
  queued: 'Queued for analysis', pending: 'Analysis in progress', expired: 'Analysis timed out',
};

export default function ThreatEvidence({ analysis }: { analysis?: ThreatAnalysis }) {
  return <details className="provider-details"><summary>Provider evidence</summary>
    {analysis?.providerStatus ? Object.entries(analysis.providerStatus).map(([provider, status]) =>
      <p key={provider}><strong>{provider === 'virustotal' ? 'VirusTotal' : 'urlscan'}</strong>: {labels[status.state] || status.state}
        {analysis.evidence?.[provider] && <> · {analysis.evidence[provider].verdict}
          {analysis.evidence[provider].vt_score != null && <> · {analysis.evidence[provider].vt_score} engine detections</>}</>}
      </p>) : <p>No provider details recorded.</p>}
    <small>No result or no detections is not a guarantee of safety.</small>
  </details>;
}
