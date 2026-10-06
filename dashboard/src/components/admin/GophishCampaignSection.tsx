'use client';

import { useState } from 'react';
import { Fish, Play, RefreshCw, Mail, Eye, Plus, Pencil, Trash2, StopCircle, Globe, ExternalLink } from 'lucide-react';
import type { Division, EmployeeAccount, GoPhishCampaign, GoPhishResource } from './types';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Dialog from '@/components/ui/Dialog';
import KpiCard from '@/components/ui/KpiCard';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip from '@/components/ui/StatusChip';
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
  const { readOnly, campaigns, resources } = props;
  const { t } = useI18n();
  const [detail, setDetail] = useState<GoPhishCampaign | null>(null);
  const [action, setAction] = useState<{ campaign: GoPhishCampaign; type: 'stop' | 'delete' } | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');

  const total = campaigns.reduce((acc, c) => {
    const s = getCampaignStats(c);
    return { sent: acc.sent + s.sent, opened: acc.opened + s.opened, clicked: acc.clicked + s.clicked };
  }, { sent: 0, opened: 0, clicked: 0 });
  const ready = !!(resources?.templates.length && resources.pages.length && resources.profiles.some(p => p.host === 'mailpit:1025'));

  async function view(c: GoPhishCampaign) {
    setActionError('');
    try {
      const response = await fetch('/api/admin/gophish/campaigns/' + c.id + '?source=' + (c.source || 'gophish'));
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error('detail');
      setDetail(result);
      props.onViewCampaignDetail?.(c.id);
    } catch { setActionError(t('cmpg.err.detail')); }
  }

  async function confirmAction() {
    if (!action) return;
    setWorking(true); setActionError('');
    try {
      if (action.type === 'delete') await props.onDeleteCampaign(action.campaign.id, action.campaign.source);
      else {
        const response = await fetch('/api/admin/gophish/campaigns/' + action.campaign.id + '/complete?source=' + (action.campaign.source || 'gophish'), { method: 'POST' });
        if (!response.ok) throw new Error('stop');
        await props.onCompleteCampaign?.(action.campaign.id);
      }
      setAction(null);
    } catch (err) { setActionError(err instanceof Error && err.message === 'stop' ? t('cmpg.err.stop') : t('cmpg.err.action')); }
    finally { setWorking(false); }
  }

  const statusLabel = (status: string) => (status === 'Completed' ? t('cmpg.status.Completed') : status);
  const columns: Column<GoPhishCampaign>[] = [
    { key: 'name', header: t('cmpg.col.campaign'), render: c => <span className="cell-clip"><strong>{c.name}</strong><span className="cell-sub">{c.source === 'local' ? t('cmpg.source.local') : t('cmpg.source.gophish')} · #{c.id}</span></span> },
    { key: 'status', header: t('cmpg.col.status'), render: c => { const s = getCampaignStats(c); return <><StatusChip tone={c.status === 'Completed' ? 'neutral' : 'open'}>{statusLabel(c.status)}</StatusChip>{s.error > 0 && <span className="cell-sub">{t('cmpg.failures', { n: s.error })}</span>}</>; } },
    { key: 'sent', header: t('cmpg.col.sent'), secondary: true, render: c => { const s = getCampaignStats(c); return `${s.sent} / ${s.total}`; } },
    { key: 'opened', header: t('cmpg.col.opened'), secondary: true, align: 'right', render: c => getCampaignStats(c).opened },
    { key: 'clicked', header: t('cmpg.col.clicked'), secondary: true, align: 'right', render: c => getCampaignStats(c).clicked },
    { key: 'submitted', header: t('cmpg.col.submitted'), secondary: true, align: 'right', render: c => getCampaignStats(c).submitted_data },
    { key: 'actions', header: t('cmpg.col.actions'), align: 'right', render: c => (
      <span className="ops-actions">
        <button type="button" className="btn iconbtn" onClick={() => void view(c)} aria-label={t('cmpg.btn.detail', { name: c.name })} title={t('cmpg.btn.detail', { name: c.name })}><Eye size={14} aria-hidden="true" /></button>
        {!readOnly && c.status !== 'Completed' && <button type="button" className="btn iconbtn" onClick={() => { setAction({ campaign: c, type: 'stop' }); setActionError(''); }} aria-label={t('cmpg.btn.stop', { name: c.name })} title={t('cmpg.btn.stop', { name: c.name })}><StopCircle size={14} aria-hidden="true" /></button>}
        {!readOnly && <button type="button" className="btn iconbtn" onClick={() => { setAction({ campaign: c, type: 'delete' }); setActionError(''); }} aria-label={t('cmpg.btn.delete', { name: c.name })} title={t('cmpg.btn.delete', { name: c.name })}><Trash2 size={14} aria-hidden="true" /></button>}
      </span>
    ) },
  ];

  return (
    <section className="ops-page" aria-labelledby="cmpg-title">
      <div className="ops-intro">
        <div><h3 id="cmpg-title" style={{ fontSize: 16, fontWeight: 600 }}><Fish size={16} aria-hidden="true" /> {t('cmpg.title')}</h3><p className="emp-muted">{t('cmpg.desc')}</p></div>
        <span className="ops-actions" style={{ flexWrap: 'wrap' }}>
          {props.onRefresh && <button type="button" className="btn" onClick={props.onRefresh} disabled={props.busy}><RefreshCw size={14} aria-hidden="true" /> {t('cmpg.refresh')}</button>}
          {resources?.adminUrl && <a className="btn" href={resources.adminUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" /> GoPhish</a>}
          {!readOnly && <button type="button" className="btn btn-primary" onClick={() => props.onOpenLaunchModal()} disabled={props.busy}><Play size={14} aria-hidden="true" /> {t('cmpg.create')}</button>}
        </span>
      </div>

      {(props.error || (actionError && !action)) && <p className="field-error" role="alert">{props.error || actionError}</p>}
      {props.notice && <p className="inline-note" role="status">{props.notice}</p>}

      {!readOnly && (
        <div className="inline-note"><Mail size={18} aria-hidden="true" />
          <div style={{ flex: 1 }}><strong>{ready ? t('cmpg.ready') : t('cmpg.notReady')}</strong><p>{t('cmpg.readyNote')}</p></div>
          <span className="ops-actions" style={{ flexWrap: 'wrap' }}>
            {props.onSetupResources && <button type="button" className="btn" onClick={() => props.onSetupResources?.()} disabled={props.busy}><Plus size={14} aria-hidden="true" /> {t('cmpg.setupDemo')}</button>}
            {resources?.mailpitUrl && <a className="btn" href={resources.mailpitUrl} target="_blank" rel="noopener noreferrer"><Mail size={14} aria-hidden="true" /> {t('cmpg.mailpit')}</a>}
          </span>
        </div>
      )}

      <div className="exec-kpis">
        <KpiCard label={t('cmpg.m.campaigns')} value={campaigns.length} />
        <KpiCard label={t('cmpg.m.sent')} value={total.sent} />
        <KpiCard label={t('cmpg.m.opened')} value={total.opened} />
        <KpiCard label={t('cmpg.m.clicked')} value={total.clicked} />
      </div>

      {!readOnly && (
        <details className="exec-more campaign-details">
          <summary><span>{t('cmpg.library.title')}</span><small>{t('cmpg.library.count', { templates: resources?.templates.length || 0, pages: resources?.pages.length || 0 })}</small></summary>
          <div className="library-grid">{(['template', 'page'] as const).map(type => {
            const items = type === 'template' ? resources?.templates || [] : resources?.pages || [];
            const Icon = type === 'template' ? Mail : Globe;
            return (
              <div key={type}>
                <div className="ops-head"><h4 style={{ fontSize: 14, fontWeight: 600 }}><Icon size={14} aria-hidden="true" /> {t(type === 'template' ? 'cmpg.library.template' : 'cmpg.library.page')}</h4><button type="button" className="btn" onClick={() => props.onOpenTemplateBuilder('new', type)}><Plus size={14} aria-hidden="true" /> {t('cmpg.library.add')}</button></div>
                {!items.length && <p className="emp-muted">{t('cmpg.library.empty')}</p>}
                {items.map(item => (
                  <div className="library-item" key={item.id}>
                    <span><strong>{item.name}</strong><small>{'subject' in item ? item.subject : t('cmpg.library.page.default')}</small></span>
                    <span className="ops-actions">
                      <button type="button" className="btn iconbtn" aria-label={t('cmpg.edit', { name: item.name })} title={t('cmpg.edit', { name: item.name })} onClick={() => props.onOpenTemplateBuilder('edit', type, item)}><Pencil size={14} aria-hidden="true" /></button>
                      <button type="button" className="btn iconbtn" aria-label={t('cmpg.delete', { name: item.name })} title={t('cmpg.delete', { name: item.name })} onClick={() => (type === 'template' ? props.onDeleteTemplate(item.id) : props.onDeletePage(item.id))}><Trash2 size={14} aria-hidden="true" /></button>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}</div>
        </details>
      )}

      <section className="ops-block" aria-labelledby="cmpg-s3">
        <div className="ops-intro"><div><h3 id="cmpg-s3" style={{ fontSize: 16, fontWeight: 600 }}>{t('cmpg.monitor')}</h3></div><span className="emp-muted">{t('cmpg.count', { n: campaigns.length })}</span></div>
        <DataTable caption={t('cmpg.monitor')} columns={columns} rows={campaigns} rowKey={c => `${c.source || 'gophish'}:${c.id}`} density="comfortable" empty={<StateMessage variant="empty" title={t('cmpg.empty.title')} why={t('cmpg.empty.why')} />} />
      </section>

      <Dialog open={detail !== null} onClose={() => setDetail(null)} size="lg" title={detail?.name ?? t('cmpg.detail.title')} description={detail ? `${statusLabel(detail.status)} · ${formatWIB(detail.created_date)}` : undefined}>
        {detail && <>
          <DataTable caption={t('cmpg.detail.title')} rows={detail.results || []} rowKey={r => r.email} columns={[
            { key: 'email', header: t('cmpg.detail.recipient'), render: r => r.email },
            { key: 'status', header: t('cmpg.detail.response'), render: r => r.status },
          ]} />
          <details className="campaign-details">
            <summary>{t('cmpg.detail.timeline', { n: detail.timeline?.length || 0 })}</summary>
            {detail.timeline?.map((event, i) => <p key={i}><strong>{event.message}</strong> · {event.email || t('cmpg.detail.campaign')} <small className="emp-muted">{formatWIB(event.time)}</small></p>)}
          </details>
        </>}
      </Dialog>

      <Dialog open={action !== null} onClose={() => setAction(null)} busy={working} tone={action?.type === 'delete' ? 'danger' : 'default'} size="sm"
        title={action ? t(action.type === 'stop' ? 'cmpg.stop.title' : 'cmpg.delete.title') : ''}
        description={action ? t(action.type === 'stop' ? 'cmpg.stop.body' : 'cmpg.delete.body', { name: action.campaign.name }) : undefined}
        footer={<>
          <button type="button" className="btn" disabled={working} onClick={() => setAction(null)}>{t('common.cancel')}</button>
          <button type="button" className={`btn ${action?.type === 'delete' ? 'btn-danger' : 'btn-primary'}`} disabled={working} onClick={() => void confirmAction()}>{working ? t('cmpg.processing') : t('cmpg.confirm')}</button>
        </>}>
        {actionError && <p className="field-error" role="alert">{actionError}</p>}
      </Dialog>
    </section>
  );
}
