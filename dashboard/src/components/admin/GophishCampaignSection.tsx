'use client';

import { useEffect, useRef, useState } from 'react';
import { Fish, Play, RefreshCw, Mail, Eye, MousePointer, Plus, Pencil, Trash2, StopCircle, X, Globe, ExternalLink } from 'lucide-react';
import type { Division, EmployeeAccount, GoPhishCampaign, GoPhishResource } from './types';
import { useI18n } from '@/i18n/I18nProvider';
import { formatWIB } from './types';

type Source = 'local' | 'gophish';
type Resource = GoPhishResource['templates'][number] | GoPhishResource['pages'][number];
interface Props {
  readOnly: boolean;
  campaigns: GoPhishCampaign[];
  employees: EmployeeAccount[];
  divisions: Division[];
  resources: GoPhishResource | null;
  selectedEmails: string[];
  onSelectedEmailsChange: (emails: string[]) => void;
  onSyncUsers: () => void;
  onOpenLaunchModal: () => void;
  onDeleteCampaign: (id: number, source?: Source) => Promise<void> | void;
  onCompleteCampaign?: (id: number) => Promise<boolean | void> | void;
  onViewCampaignDetail?: (id: number) => void;
  onOpenTemplateBuilder: (mode: 'new' | 'edit', type: 'template' | 'page', item?: Resource) => void;
  onDeleteTemplate: (id: number) => void;
  onDeletePage: (id: number) => void;
  onSetupResources?: (preset?: 'password-reset') => void;
  onRefresh?: () => void;
  busy?: boolean;
  error?: string;
  notice?: string;
}

export function getCampaignStats(c: GoPhishCampaign) {
  if (c.stats) return { total: c.stats.total ?? c.results?.length ?? 0, sent: c.stats.sent,
    opened: c.stats.opened, clicked: c.stats.clicked, submitted_data: c.stats.submitted_data, error: c.stats.error ?? 0 };
  const count = (pattern: RegExp) => new Set((c.results || []).filter(r => pattern.test(r.status)).map(r => r.email)).size;
  return { total: c.results?.length ?? 0, sent: count(/sent|open|click|submit/i), opened: count(/open|click|submit/i),
    clicked: count(/click|submit/i), submitted_data: count(/submit/i), error: count(/error/i) };
}

export default function GophishCampaignSection(props: Props) {
  const { readOnly, campaigns, employees, divisions, resources, selectedEmails, onSelectedEmailsChange } = props;
  const { t } = useI18n();
  const [blockers, setBlockers] = useState<('resources' | 'recipients')[]>([]);
  const [division, setDivision] = useState('ALL');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<GoPhishCampaign | null>(null);
  const [action, setAction] = useState<{ campaign: GoPhishCampaign; type: 'stop' | 'delete' } | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');
  const detailDialog = useRef<HTMLDialogElement>(null);
  const actionDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (detail) detailDialog.current?.showModal(); }, [detail]);
  useEffect(() => { if (action) actionDialog.current?.showModal(); }, [action]);
  const eligible = employees.filter(e => e.is_active && (!e.role || e.role === 'employee'));
  const filtered = eligible.filter(e => (division === 'ALL' || e.divisi === division) && e.email.toLowerCase().includes(search.toLowerCase()));
  const total = campaigns.reduce((acc, c) => {
    const s = getCampaignStats(c);
    return { sent: acc.sent + s.sent, opened: acc.opened + s.opened, clicked: acc.clicked + s.clicked, submitted: acc.submitted + s.submitted_data };
  }, { sent: 0, opened: 0, clicked: 0, submitted: 0 });
  const ready = !!(resources?.templates.length && resources.pages.length && resources.profiles.some(p => p.host === 'mailpit:1025'));
  const metrics = [
    { label: 'Campaign', value: campaigns.length, Icon: Fish },
    { label: 'Emails sent', value: total.sent, Icon: Mail },
    { label: 'Emails opened', value: total.opened, Icon: Eye },
    { label: 'Links clicked', value: total.clicked, Icon: MousePointer },
  ];
  async function view(c: GoPhishCampaign) {
    setActionError('');
    try {
      const response = await fetch('/api/admin/gophish/campaigns/' + c.id + '?source=' + (c.source || 'gophish'));
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Campaign details unavailable.');
      setDetail(result);
      props.onViewCampaignDetail?.(c.id);
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Details unavailable.'); }
  }
  async function confirmAction() {
    if (!action) return;
    setWorking(true); setActionError('');
    try {
      if (action.type === 'delete') await props.onDeleteCampaign(action.campaign.id, action.campaign.source);
      else {
        const response = await fetch('/api/admin/gophish/campaigns/' + action.campaign.id + '/complete?source=' + (action.campaign.source || 'gophish'), { method: 'POST' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not stop the campaign.');
        await props.onCompleteCampaign?.(action.campaign.id);
      }
      setAction(null);
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Action failed.'); }
    finally { setWorking(false); }
  }
  function createCampaign() {
    const missing: ('resources' | 'recipients')[] = [];
    if (!ready) missing.push('resources');
    if (!selectedEmails.length) missing.push('recipients');
    setBlockers(missing);
    if (!missing.length) props.onOpenLaunchModal();
  }
  const goToRecipients = () => document.getElementById('campaign-recipients')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return <section className="campaign-workspace">
    <header className="campaign-hero glass-card">
      <div><span className="campaign-kicker">Email simulations</span><h2><Fish size={25} />Phishing simulations</h2><p>Build awareness with simulated phishing emails.</p></div>
      <div className="campaign-actions">
        {props.onRefresh && <button className="btn" onClick={props.onRefresh} disabled={props.busy}><RefreshCw size={15} />Refresh</button>}
        {resources?.adminUrl && <a className="btn" href={resources.adminUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />GoPhish</a>}
        {!readOnly && <button className="btn btn-primary" onClick={createCampaign} disabled={props.busy}><Play size={15} />Create campaign</button>}
      </div>
    </header>
    {(props.error || (actionError && !action)) && <p className="debt-error" role="alert">{props.error || actionError}</p>}
    {props.notice && <p className="debt-notice" role="status">{props.notice}</p>}
    {blockers.length > 0 && <div className="debt-error" role="alert"><strong>{t('adm.blocked.title')}</strong>
      <ul style={{ margin: '6px 0 0 18px' }}>{blockers.includes('resources') && <li>{t('adm.blocked.resources')}</li>}{blockers.includes('recipients') && <li>{t('adm.blocked.recipients')} <button type="button" className="emp-link" onClick={goToRecipients}>{t('adm.blocked.go')}</button></li>}</ul></div>}
    {!readOnly && <div className="campaign-readiness glass-card"><Mail size={20} /><div><strong>{ready ? 'GoPhish + Mailpit ready' : 'Set up campaign resources first'}</strong><p>Demo emails are captured by Mailpit only.</p></div>
      <div className="campaign-actions">{props.onSetupResources && <button className="btn" onClick={() => props.onSetupResources?.()} disabled={props.busy}><Plus size={15} />Set up lab demo</button>}{resources?.mailpitUrl && <a className="btn" href={resources.mailpitUrl} target="_blank" rel="noopener noreferrer"><Mail size={15} />Mailpit (host)</a>}</div>
    </div>}
    <div className="campaign-metrics">{metrics.map(({ label, value, Icon }) => <div className="glass-card" key={label}><Icon size={18} /><strong>{value}</strong><span>{label}</span></div>)}</div>
    {!readOnly && <section className="glass-card campaign-panel" id="campaign-recipients">
      <div className="campaign-section-heading"><div><span className="campaign-kicker">STEP 1 · RECIPIENTS</span><h3>Target employees <span className="badge badge-info">{selectedEmails.length} selected</span></h3></div><div className="campaign-actions"><button className="btn" onClick={() => onSelectedEmailsChange(Array.from(new Set([...selectedEmails, ...filtered.map(e => e.email)])))}>Select filtered</button><button className="btn" onClick={() => onSelectedEmailsChange([])}>Clear</button></div></div>
      <div className="campaign-filters"><label>Search email<input type="search" placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Division<select value={division} onChange={e => setDivision(e.target.value)}><option value="ALL">All divisions</option>{divisions.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}</select></label></div>
      <div className="campaign-recipient-list">{filtered.map(e => <label className="campaign-recipient" key={e.email}><input type="checkbox" checked={selectedEmails.includes(e.email)} onChange={event => onSelectedEmailsChange(event.target.checked ? [...selectedEmails, e.email] : selectedEmails.filter(email => email !== e.email))} /><span><strong>{e.email}</strong><small>{e.divisi}</small></span></label>)}</div>
      {!filtered.length && <p className="campaign-empty">No matching active employees.</p>}
      <p className="debt-help">Recipients are synced when the campaign starts.</p>
    </section>}
    {!readOnly && <section className="glass-card campaign-panel">
      <div className="campaign-section-heading"><div><span className="campaign-kicker">STEP 2 · CHOOSE CONTENT</span><h3>Simulation content</h3></div><span className="badge badge-info">No password storage</span></div>
      <div className="campaign-material-options">
        <article><Mail size={24} /><h4>Password reset request</h4><p>Ready-to-use demo email and form. No extra API needed.</p><button className="btn btn-primary" disabled={props.busy} onClick={() => props.onSetupResources?.('password-reset')}>Use this template</button></article>
        <article><Globe size={24} /><h4>Page clone · Firecrawl</h4><p>Clone an authorized public page. Demo submissions lead to education.</p><button className="btn" onClick={() => props.onOpenTemplateBuilder('new', 'page')}>Open clone editor</button></article>
      </div>
      <p className="debt-help">Click: −10 points · Submit: −20 more points. Each event is counted once.</p>
    </section>}
    {!readOnly && <details className="glass-card campaign-panel campaign-resources">
      <summary><span className="campaign-kicker">CONTENT LIBRARY</span><h3>Template & landing page</h3><span>{resources?.templates.length || 0} template · {resources?.pages.length || 0} landing page</span></summary>
      <div className="campaign-resource-grid">{(['template', 'page'] as const).map(type => {
        const items = type === 'template' ? resources?.templates || [] : resources?.pages || [];
        const Icon = type === 'template' ? Mail : Globe;
        return <div key={type}><div className="campaign-section-heading"><h4><Icon size={16} />{type === 'template' ? 'Email template' : 'Landing page'}</h4><button className="btn" onClick={() => props.onOpenTemplateBuilder('new', type)}><Plus size={14} />Add</button></div>
          {!items.length && <p className="campaign-empty">No saved content yet.</p>}
          {items.map(item => <article className="campaign-resource" key={item.id}><div><strong>{item.name}</strong><small>{'subject' in item ? item.subject : 'Simulation page'}</small></div><div className="campaign-actions"><button className="btn" aria-label={'Edit ' + item.name} onClick={() => props.onOpenTemplateBuilder('edit', type, item)}><Pencil size={14} /></button><button className="btn" aria-label={'Delete ' + item.name} onClick={() => type === 'template' ? props.onDeleteTemplate(item.id) : props.onDeletePage(item.id)}><Trash2 size={14} /></button></div></article>)}</div>;
      })}</div>
    </details>}
    <section className="glass-card campaign-panel"><div className="campaign-section-heading"><div><span className="campaign-kicker">STEP 3 · MONITORING</span><h3>Campaigns & responses</h3></div><span className="badge badge-neutral">{campaigns.length} campaign</span></div>
      <div className="campaign-table-scroll"><table className="campaign-table"><thead><tr><th>Campaign</th><th>Status</th><th>Sent / target</th><th>Opened</th><th>Clicked</th><th>Submit</th><th>Actions</th></tr></thead><tbody>
      {campaigns.map(c => { const s = getCampaignStats(c); return <tr key={(c.source || 'gophish') + ':' + c.id}><td><strong>{c.name}</strong><small>{c.source === 'local' ? 'Legacy simulation archive' : 'GoPhish → Mailpit'} · #{c.id}</small></td><td><span className={'badge ' + (c.status === 'Completed' ? 'badge-neutral' : 'badge-info')}>{c.status}</span>{s.error > 0 && <small className="campaign-failure">{s.error} delivery failures</small>}</td><td>{s.sent} / {s.total}</td><td>{s.opened}</td><td>{s.clicked}</td><td>{s.submitted_data}</td><td><div className="campaign-actions"><button className="btn" onClick={() => void view(c)} aria-label={'Detail ' + c.name}><Eye size={14} /></button>{!readOnly && c.status !== 'Completed' && <button className="btn" onClick={() => { setAction({ campaign: c, type: 'stop' }); setActionError(''); }} aria-label={'Stop ' + c.name}><StopCircle size={14} /></button>}{!readOnly && <button className="btn" onClick={() => { setAction({ campaign: c, type: 'delete' }); setActionError(''); }} aria-label={'Delete ' + c.name}><Trash2 size={14} /></button>}</div></td></tr>; })}
      {!campaigns.length && <tr><td colSpan={7} className="campaign-empty">No campaigns yet. Select recipients to create one.</td></tr>}
      </tbody></table></div>
    </section>
    {detail && <dialog ref={detailDialog} className="campaign-dialog" aria-labelledby="campaign-detail-title" onCancel={() => setDetail(null)}><button className="account-close" aria-label="Close details" onClick={() => setDetail(null)}><X size={20} /></button><span className="campaign-kicker">CAMPAIGN DETAIL</span><h2 id="campaign-detail-title">{detail.name}</h2><p className="debt-help">{detail.status} · {formatWIB(detail.created_date)}</p><div className="campaign-table-scroll"><table className="campaign-table"><thead><tr><th>Recipient</th><th>Response</th></tr></thead><tbody>{(detail.results || []).map(r => <tr key={r.email}><td>{r.email}</td><td>{r.status}</td></tr>)}</tbody></table></div><details className="campaign-timeline"><summary>Timeline ({detail.timeline?.length || 0})</summary>{detail.timeline?.map((event, i) => <p key={i}><strong>{event.message}</strong> · {event.email || 'Campaign'}<small>{formatWIB(event.time)}</small></p>)}</details></dialog>}
    {action && <dialog ref={actionDialog} className="campaign-dialog campaign-confirm" aria-labelledby="campaign-action-title" onCancel={e => { if (working) e.preventDefault(); else setAction(null); }}><button className="account-close" aria-label="Close" disabled={working} onClick={() => setAction(null)}><X size={20} /></button><h2 id="campaign-action-title">{action.type === 'stop' ? 'Stop this campaign?' : 'Delete this campaign?'}</h2><p className="debt-help"><strong>{action.campaign.name}</strong>{action.type === 'stop' ? ' will stop. Unsent emails are cancelled; existing telemetry is retained.' : ' will be deleted from this campaign source. Employee accounts are not deleted.'}</p>{actionError && <p className="debt-error" role="alert">{actionError}</p>}<div className="campaign-actions"><button className="btn" disabled={working} onClick={() => setAction(null)}>Cancel</button><button className="btn btn-primary" disabled={working} onClick={() => void confirmAction()}>{working ? 'Processing…' : 'Confirm'}</button></div></dialog>}
  </section>;
}
