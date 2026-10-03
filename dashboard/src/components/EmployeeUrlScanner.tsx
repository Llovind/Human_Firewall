'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, Flag, FileText, RefreshCw, ShieldCheck, ShieldAlert, Send, Loader2 } from 'lucide-react';
import ThreatEvidence, { EmployeeReport, FileScan, ThreatAnalysis } from './ThreatEvidence';

function fileScanLabel(scan: FileScan) {
  if (scan.status === 'pending') return 'Scanning in progress';
  return { malicious: 'Threat detected', suspicious: 'Suspicious file', clean: 'No known threats detected' }[scan.verdict] || 'Result unavailable';
}

async function loadResults(path: string, signal?: AbortSignal) {
  const res = await fetch(path, { cache: 'no-store', signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Results unavailable. Please refresh.');
  return data;
}

export default function EmployeeUrlScanner({ onReportComplete }: { onReportComplete?: () => void }) {
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
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Could not load results.');
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
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load results.'); });
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
        if (!controller.signal.aborted) setError('File results could not be refreshed. Please try Refresh.');
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
        if (!file || !file.size || file.size > fileMaxBytes) throw new Error('Choose a non-empty file within the size limit.');
        if (!consent) throw new Error('Confirm that this file may be shared with VirusTotal.');
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
      if (!res.ok) throw new Error(data.error || 'Request failed. Try again.');
      if (mode === 'scan') setScan(data.data);
      else if (mode === 'file') {
        setFileScans(previous => [data.scan, ...previous.filter(item => item.id !== data.scan.id)].slice(0, 100));
        setSelectedFileId(data.scan.id);
        setHistory('files');
        setNotice(data.duplicate ? 'Showing your existing file scan.' : 'File queued. Results update automatically.');
        setFile(null); setConsent(false);
        if (fileInput.current) fileInput.current.value = '';
      }
      else {
        setHistory('reports');
        setNotice(data.duplicate ? 'Already reported. See your report below.' : 'Report received. Awaiting SOC review.');
        onReportComplete?.();
        if (data.reward?.awarded) {
          setNotice('Report received. +' + data.reward.points_awarded + ' points · reports ' + data.reward.daily_count + '/' + data.reward.daily_cap + ' today.');
        }
        await refresh();
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not reach the server.'); }
    finally { setBusy(false); }
  }
  return <section className="panel glass-card employee-threat-tools">
    <div className="panel-header"><div className="security-center-heading"><ShieldCheck size={22} aria-hidden="true" /><div><h2 className="panel-title">URL & file security</h2><p>Check links and files. Report suspicious links to SOC.</p></div></div></div>
    <div className="url-tools-grid"><div>
    <div className="debt-tabs" aria-label="Security tools">
      <button type="button" disabled={busy} aria-pressed={mode === 'scan'} className={'btn ' + (mode === 'scan' ? 'btn-primary' : '')} onClick={() => { setMode('scan'); setError(''); setNotice(''); setScan(null); }}><Search size={16} />Scan URL</button>
      <button type="button" disabled={busy} aria-pressed={mode === 'report'} className={'btn ' + (mode === 'report' ? 'btn-primary' : '')} onClick={() => { setMode('report'); setError(''); setNotice(''); setScan(null); }}><Flag size={16} />Report a link</button>
      <button type="button" disabled={busy} aria-pressed={mode === 'file'} className={'btn ' + (mode === 'file' ? 'btn-primary' : '')} onClick={() => { setMode('file'); setHistory('files'); setError(''); setNotice(''); setScan(null); }}><FileText size={16} />Scan file</button>
    </div>
    <p className="debt-help">{mode === 'scan' ? 'VirusTotal + urlscan reputation. Scanning does not file a report or change proxy policies.' : mode === 'file' ? 'VirusTotal analysis, just for you. No SOC report is created.' : 'VirusTotal + urlscan evidence, sent to SOC for review.'}</p>
    <form className="debt-form" onSubmit={submit}>
      {mode === 'file' ? <label className="file-upload">Choose a file<input ref={fileInput} type="file" required onChange={event => { setFile(event.target.files?.[0] || null); setSelectedFileId(''); setNotice(''); }} /><small>{file ? file.name + ' · ' + (file.size / 1024).toFixed(0) + ' KB' : 'PDF, documents, images, archives and other files · up to ' + Math.floor(fileMaxBytes / 1024 / 1024) + ' MB'}</small></label>
        : <label>URL<input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/path" required maxLength={4096} autoComplete="off" /></label>}
      {mode === 'report' && <label>Description (optional)<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} rows={3} /></label>}
      {mode === 'file' ? <label className="upload-consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>This file is not confidential. I agree to share it with VirusTotal and its security partners.</span></label>
        : <small>Reputation queries share this URL with VirusTotal/urlscan. Do not include passwords, tokens or personal data.</small>}
      <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : mode === 'report' ? <Send size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}{busy ? 'Processing…' : mode === 'scan' ? 'Scan URL' : mode === 'file' ? 'Scan file' : 'Submit report'}</button>
    </form>
    {error && <p role="alert" className="debt-error">{error}</p>}
    {notice && <p role="status" className="debt-notice">{notice}</p>}
    {fileResult && (mode === 'file' || fileThreat) && <div className="file-scan-result" data-verdict={fileResult.status === 'pending' ? 'pending' : fileResult.verdict} role={fileThreat ? 'alert' : 'status'}>
      {fileThreat ? <ShieldAlert size={24} aria-hidden="true" /> : fileResult.status === 'pending' ? <Loader2 size={24} className="spin" aria-hidden="true" /> : fileResult.verdict === 'clean' ? <ShieldCheck size={24} aria-hidden="true" /> : <FileText size={24} aria-hidden="true" />}
      <div><strong>{fileScanLabel(fileResult)}</strong><p>{fileResult.file_name}</p>
      <p>{fileThreat ? 'VirusTotal flagged this file. Do not open or run it.' : fileResult.status === 'pending' ? 'Waiting for VirusTotal. You can leave this page and check your scans later.' : fileResult.verdict === 'clean' ? 'No engine detections were reported. This is not a guarantee of safety.' : 'No reliable verdict is available. Do not treat this file as safe.'}</p>
      <ThreatEvidence analysis={fileResult.analysis} /></div>
    </div>}
    {scan && <div className="debt-result" role="status">
      <strong>{scan.verdict === 'unknown' ? 'Unknown — review needed' : scan.verdict.toUpperCase()}</strong>
      <ThreatEvidence analysis={scan} />
      <p>This result is not a Block/Allow decision.</p>
    </div>}
    </div><aside className="url-report-history">
    <div className="panel-header"><h3>My activity</h3><button type="button" className="btn" onClick={() => void refresh()}><RefreshCw size={14} />Refresh</button></div>
    <div className="debt-tabs" aria-label="My activity"><button type="button" className={'btn ' + (history === 'reports' ? 'btn-primary' : '')} aria-pressed={history === 'reports'} onClick={() => setHistory('reports')}>Link reports</button><button type="button" className={'btn ' + (history === 'files' ? 'btn-primary' : '')} aria-pressed={history === 'files'} onClick={() => setHistory('files')}>File scans</button></div>
    {history === 'reports' ? <>
      {!reports.length && <p className="debt-help">No link reports yet.</p>}
      <ul className="employee-report-list">{reports.map(report => <li key={report.id}><div><strong>{report.url}</strong><small>Evidence: {report.verdict} · {report.created_at} UTC</small><ThreatEvidence analysis={report.analysis} /></div><span className="badge" data-status={report.status}>{report.status.replaceAll('_', ' ')}</span></li>)}</ul>
    </> : <>
      <p className="debt-help">Your results only. Not sent to the SOC inbox.</p>
      {!fileScans.length && <p className="debt-help">No file scans yet.</p>}
      <ul className="employee-report-list">{fileScans.map(item => <li key={item.id}><div><strong>{item.file_name}</strong><small>{Math.ceil(item.file_size / 1024)} KB · {item.created_at} UTC</small><span className="file-scan-label" data-verdict={item.verdict}>{fileScanLabel(item)}</span><ThreatEvidence analysis={item.analysis} /><button type="button" className="btn" onClick={() => { setSelectedFileId(item.id); setMode('file'); setError(''); setNotice(''); }}>View result</button></div><span className="badge">{item.status === 'pending' ? 'Scanning' : item.status === 'unknown' ? 'No verdict' : 'Scanned'}</span></li>)}</ul>
    </>}
    </aside></div>
  </section>;
}
