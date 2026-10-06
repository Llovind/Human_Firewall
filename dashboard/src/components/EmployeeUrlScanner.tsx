'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, Flag, FileText, RefreshCw, ShieldCheck, ShieldAlert, Send, Loader2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import ThreatEvidence, { EmployeeReport, FileScan, ThreatAnalysis } from './ThreatEvidence';

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

function fileScanLabel(scan: FileScan, t: T) {
  if (scan.status === 'pending') return t('scan2.file.pending');
  const key = ({ malicious: 'scan2.file.malicious', suspicious: 'scan2.file.suspicious', clean: 'scan2.file.clean' } as Record<string, MessageKey>)[scan.verdict];
  return t(key ?? 'scan2.file.unknown');
}

/** Failures throw a short code ("results"); the component turns it into a sentence in the current language. */
async function loadResults(path: string, signal?: AbortSignal) {
  const res = await fetch(path, { cache: 'no-store', signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('results');
  return data;
}

export default function EmployeeUrlScanner({ onReportComplete }: { onReportComplete?: () => void }) {
  const { t } = useI18n();
  const describe = (err: unknown, fallback: MessageKey) => t(err instanceof Error && err.message === 'results' ? 'scan2.err.results' : fallback);
  // Effects below run once; they read the latest translator through this ref instead of restarting on a language change.
  const translate = useRef(t);
  useEffect(() => { translate.current = t; });
  const [mode, setMode] = useState<'scan' | 'report' | 'file'>('scan');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [fileMaxBytes, setFileMaxBytes] = useState(10 * 1024 * 1024);
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scan, setScan] = useState<ThreatAnalysis | null>(null);
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [fileScans, setFileScans] = useState<FileScan[]>([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [history, setHistory] = useState<'reports' | 'files'>('reports');
  const pendingFiles = fileScans.some(item => item.status === 'pending');
  const fileResult = fileScans.find(item => item.id === selectedFileId);
  const fileThreat = fileResult?.verdict === 'malicious' || fileResult?.verdict === 'suspicious';
  async function refresh(signal?: AbortSignal) {
    try {
      const [reportData, fileData] = await Promise.all([
        loadResults('/api/reports', signal), loadResults('/api/threat/file-scan', signal),
      ]);
      if (signal?.aborted) return;
      setReports(reportData.reports || []);
      setFileScans(fileData.scans || []);
      setFileMaxBytes(fileData.maxBytes || 10 * 1024 * 1024);
    } catch (err) {
      if (!signal?.aborted) setError(describe(err, 'scan2.err.load'));
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadResults('/api/reports', controller.signal), loadResults('/api/threat/file-scan', controller.signal)])
      .then(([reportData, fileData]) => {
        if (controller.signal.aborted) return;
        setReports(reportData.reports || []);
        setFileScans(fileData.scans || []);
        setFileMaxBytes(fileData.maxBytes || 10 * 1024 * 1024);
      })
      .catch(err => { if (!controller.signal.aborted) setError(translate.current(err instanceof Error && err.message === 'results' ? 'scan2.err.results' : 'scan2.err.load')); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!pendingFiles) return;
    const controller = new AbortController();
    let inFlight = false;
    const timer = window.setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await loadResults('/api/threat/file-scan', controller.signal);
        if (!controller.signal.aborted) setFileScans(data.scans || []);
      } catch {
        if (!controller.signal.aborted) setError(translate.current('scan2.err.refreshFiles'));
      } finally { inFlight = false; }
    }, 3000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [pendingFiles]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice(''); setScan(null);
    try {
      let body: BodyInit;
      let headers: HeadersInit | undefined;
      if (mode === 'file') {
        if (!file || !file.size || file.size > fileMaxBytes) throw new Error(t('scan2.err.fileSize'));
        if (!consent) throw new Error(t('scan2.err.consent'));
        const form = new FormData();
        form.set('file', file); form.set('consent', 'true');
        body = form;
      } else {
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({ url, ...(mode === 'report' ? { description } : {}) });
      }
      const res = await fetch(mode === 'scan' ? '/api/threat/scan' : mode === 'file' ? '/api/threat/file-scan' : '/api/reports', {
        method: 'POST', headers, body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(t('scan2.err.request'));
      if (mode === 'scan') setScan(data.data);
      else if (mode === 'file') {
        setFileScans(previous => [data.scan, ...previous.filter(item => item.id !== data.scan.id)].slice(0, 100));
        setSelectedFileId(data.scan.id);
        setHistory('files');
        setNotice(data.duplicate ? t('scan2.notice.fileExisting') : t('scan2.notice.fileQueued'));
        setFile(null); setConsent(false);
        if (fileInput.current) fileInput.current.value = '';
      }
      else {
        setHistory('reports');
        setNotice(data.duplicate ? t('scan2.notice.reportDup') : t('scan2.notice.reportOk'));
        onReportComplete?.();
        if (data.reward?.awarded) {
          setNotice(t('scan2.notice.reward', { points: data.reward.points_awarded, count: data.reward.daily_count, cap: data.reward.daily_cap }));
        }
        await refresh();
      }
    } catch (err) { setError(err instanceof TypeError ? t('scan2.err.network') : err instanceof Error ? describe(err, 'scan2.err.network') : t('scan2.err.network')); }
    finally { setBusy(false); }
  }
  return <section className="panel glass-card employee-threat-tools">
    <div className="panel-header"><div className="security-center-heading"><ShieldCheck size={22} aria-hidden="true" /><div><h2 className="panel-title">{t('scan.title')}</h2><p>{t('scan.desc')}</p></div></div></div>
    <div className="url-tools-grid"><div>
    <div className="debt-tabs" aria-label={t('scan.tabs')}>
      <button type="button" disabled={busy} aria-pressed={mode === 'scan'} className={'btn ' + (mode === 'scan' ? 'btn-primary' : '')} onClick={() => { setMode('scan'); setError(''); setNotice(''); setScan(null); }}><Search size={16} />{t('scan.tab.check')}</button>
      <button type="button" disabled={busy} aria-pressed={mode === 'report'} className={'btn ' + (mode === 'report' ? 'btn-primary' : '')} onClick={() => { setMode('report'); setError(''); setNotice(''); setScan(null); }}><Flag size={16} />{t('scan.tab.report')}</button>
      <button type="button" disabled={busy} aria-pressed={mode === 'file'} className={'btn ' + (mode === 'file' ? 'btn-primary' : '')} onClick={() => { setMode('file'); setHistory('files'); setError(''); setNotice(''); setScan(null); }}><FileText size={16} />{t('scan.tab.file')}</button>
    </div>
    <p className="debt-help">{mode === 'scan' ? t('scan.help.check') : mode === 'file' ? t('scan.help.file') : t('scan.help.report')}</p>
    <form className="debt-form" onSubmit={submit}>
      {mode === 'file' ? <label key="file" className="file-upload">{t('scan2.file.choose')}<input ref={fileInput} type="file" required onChange={event => { setFile(event.target.files?.[0] || null); setSelectedFileId(''); setNotice(''); }} /><small>{file ? file.name + ' · ' + (file.size / 1024).toFixed(0) + ' KB' : t('scan2.file.hint', { mb: Math.floor(fileMaxBytes / 1024 / 1024) })}</small></label>
        : <label key="url">{t('scan.url')}<input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/path" required maxLength={4096} autoComplete="off" /></label>}
      {mode === 'report' && <label>{t('scan2.description')} ({t('scan2.optional')})<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={3} /></label>}
      {mode === 'file' ? <label key="consent" className="upload-consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{t('scan2.consent')}</span></label>
        : <small>{t('scan.privacy')}</small>}
      <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : mode === 'report' ? <Send size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}{busy ? t('scan.processing') : mode === 'scan' ? t('scan.submit.check') : mode === 'file' ? t('scan.submit.file') : t('scan.submit.report')}</button>
    </form>
    {error && <p role="alert" className="debt-error">{error}</p>}
    {notice && <p role="status" className="debt-notice">{notice}</p>}
    {fileResult && (mode === 'file' || fileThreat) && <div className="file-scan-result" data-verdict={fileResult.status === 'pending' ? 'pending' : fileResult.verdict} role={fileThreat ? 'alert' : 'status'}>
      {fileThreat ? <ShieldAlert size={24} aria-hidden="true" /> : fileResult.status === 'pending' ? <Loader2 size={24} className="spin" aria-hidden="true" /> : fileResult.verdict === 'clean' ? <ShieldCheck size={24} aria-hidden="true" /> : <FileText size={24} aria-hidden="true" />}
      <div><strong>{fileScanLabel(fileResult, t)}</strong><p>{fileResult.file_name}</p>
      <p>{fileThreat ? t('scan2.file.flagged') : fileResult.status === 'pending' ? t('scan2.file.waiting') : fileResult.verdict === 'clean' ? t('scan2.file.cleanNote') : t('scan2.file.noVerdict')}</p>
      <ThreatEvidence analysis={fileResult.analysis} /></div>
    </div>}
    {scan && <div className="debt-result" role="status">
      <strong>{scan.verdict === 'unknown' ? t('scan2.url.unknown') : (['malicious', 'suspicious', 'clean'].includes(scan.verdict) ? t(`scan2.url.verdict.${scan.verdict}` as MessageKey) : scan.verdict)}</strong>
      <ThreatEvidence analysis={scan} />
      <p>{t('scan2.url.notDecision')}</p>
    </div>}
    </div><aside className="url-report-history">
    <div className="panel-header"><h3>{t('scan.history')}</h3><button type="button" className="btn" onClick={() => void refresh()}><RefreshCw size={14} />{t('common.refresh')}</button></div>
    <div className="debt-tabs" aria-label={t('scan.history')}><button type="button" className={'btn ' + (history === 'reports' ? 'btn-primary' : '')} aria-pressed={history === 'reports'} onClick={() => setHistory('reports')}>{t('scan.reports')}</button><button type="button" className={'btn ' + (history === 'files' ? 'btn-primary' : '')} aria-pressed={history === 'files'} onClick={() => setHistory('files')}>{t('scan.files')}</button></div>
    {history === 'reports' ? <>
      {!reports.length && <p className="debt-help">{t('scan.none.reports')}</p>}
      <ul className="employee-report-list">{reports.map(report => <li key={report.id}><div><strong>{report.url}</strong><small>{t('scan2.evidence', { verdict: report.verdict, time: report.created_at })}</small><ThreatEvidence analysis={report.analysis} /></div><span className="badge" data-status={report.status}>{['pending_review', 'open', 'resolved'].includes(report.status) ? t(`scan2.report.status.${report.status}` as MessageKey) : report.status.replaceAll('_', ' ')}</span></li>)}</ul>
    </> : <>
      <p className="debt-help">{t('scan.files.hint')}</p>
      {!fileScans.length && <p className="debt-help">{t('scan.none.files')}</p>}
      <ul className="employee-report-list">{fileScans.map(item => <li key={item.id}><div><strong>{item.file_name}</strong><small>{Math.ceil(item.file_size / 1024)} KB · {item.created_at} UTC</small><span className="file-scan-label" data-verdict={item.verdict}>{fileScanLabel(item, t)}</span><ThreatEvidence analysis={item.analysis} /><button type="button" className="btn" onClick={() => { setSelectedFileId(item.id); setMode('file'); setError(''); setNotice(''); }}>{t('scan2.view')}</button></div><span className="badge">{item.status === 'pending' ? t('scan2.state.pending') : item.status === 'unknown' ? t('scan2.state.unknown') : t('scan2.state.done')}</span></li>)}</ul>
    </>}
    </aside></div>
  </section>;
}
