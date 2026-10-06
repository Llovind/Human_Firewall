'use client';

import { useState, type FormEvent } from 'react';
import { Mail, Send } from 'lucide-react';
import type { Division, EmployeeAccount, GoPhishResource } from './types';
import Dialog from '@/components/ui/Dialog';
import Field from '@/components/ui/Field';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip from '@/components/ui/StatusChip';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';

export interface WizardForm {
  name: string; template: string; profile: string; page: string; url: string;
}

interface CampaignWizardProps {
  open: boolean;
  onClose: () => void;
  employees: EmployeeAccount[];
  divisions: Division[];
  resources: GoPhishResource | null;
  selectedEmails: string[];
  onSelectedEmailsChange: (emails: string[]) => void;
  form: WizardForm;
  onFormChange: (patch: Partial<WizardForm>) => void;
  launching: boolean;
  error: string;
  onSubmit: (event: FormEvent) => void;
  onSetupResources?: (preset?: 'password-reset') => void;
  /** Closes the wizard and opens the editor; the choices made so far are kept by the page. */
  onAddContent: (type: 'template' | 'page') => void;
}

const STEP_KEYS: MessageKey[] = ['wiz.s1', 'wiz.s2', 'wiz.s3'];

/** One question per step: who, what, then review. Nothing is silently disabled: Next explains what is missing. */
export default function CampaignWizard(props: CampaignWizardProps) {
  const { open, onClose, employees, divisions, resources, selectedEmails, onSelectedEmailsChange, form, onFormChange, launching, error, onSubmit } = props;
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [division, setDivision] = useState('ALL');
  const [search, setSearch] = useState('');
  const [problem, setProblem] = useState('');

  const eligible = employees.filter(e => e.is_active && (!e.role || e.role === 'employee'));
  const shown = eligible.filter(e => (division === 'ALL' || e.divisi === division) && e.email.toLowerCase().includes(search.toLowerCase()));
  const templates = resources?.templates ?? [];
  const pages = resources?.pages ?? [];
  const profiles = (resources?.profiles ?? []).filter(p => p.host === 'mailpit:1025');
  const hasContent = templates.length > 0 && pages.length > 0 && profiles.length > 0;
  const name = (list: { id: number; name: string }[], id: string) => list.find(item => String(item.id) === id)?.name ?? '—';

  const close = () => { if (launching) return; onClose(); setStep(1); setProblem(''); };
  const next = () => {
    if (step === 1 && selectedEmails.length === 0) { setProblem(t('wiz.s1.error')); return; }
    if (step === 2 && !(form.template && form.page && form.profile)) { setProblem(t('wiz.s2.error')); return; }
    setProblem(''); setStep(step + 1);
  };
  const back = () => { setProblem(''); setStep(step - 1); };

  return (
    <Dialog open={open} onClose={close} busy={launching} size="lg" title={t('wiz.title')} description={t('wiz.step', { n: step, name: t(STEP_KEYS[step - 1]) })}
      footer={<>
        <button type="button" className="btn" disabled={launching} onClick={close}>{t('common.cancel')}</button>
        {step > 1 && <button type="button" className="btn" disabled={launching} onClick={back}>{t('wiz.back')}</button>}
        {step < 3
          ? <button type="button" className="btn btn-primary" onClick={next}>{t('wiz.next')}</button>
          : <button type="submit" form="wizard-form" className="btn btn-primary" disabled={launching}>{launching ? t('wiz.sending') : <><Send size={14} aria-hidden="true" /> {t('wiz.send')}</>}</button>}
      </>}>
      <ol className="wiz-steps" aria-label={t('wiz.title')}>
        {STEP_KEYS.map((key, i) => <li key={key} aria-current={step === i + 1 ? 'step' : undefined} data-done={step > i + 1}>{t(key)}</li>)}
      </ol>

      {step === 1 && (
        <div className="ui-form">
          <p className="emp-muted">{t('wiz.s1.help')}</p>
          <div className="filter-bar">
            <label className="filter-search"><span className="visually-hidden">{t('cmpg.search')}</span><input type="search" placeholder={t('cmpg.search')} value={search} onChange={e => setSearch(e.target.value)} /></label>
            <label className="filter-select"><span className="visually-hidden">{t('cmpg.division')}</span>
              <select value={division} onChange={e => setDivision(e.target.value)}><option value="ALL">{t('cmpg.division.all')}</option>{divisions.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}</select></label>
          </div>
          <div className="ops-actions" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusChip tone="open">{t('cmpg.selected', { n: selectedEmails.length })}</StatusChip>
            <button type="button" className="btn" onClick={() => onSelectedEmailsChange(Array.from(new Set([...selectedEmails, ...shown.map(e => e.email)])))}>{t('cmpg.selectFiltered')}</button>
            <button type="button" className="btn" onClick={() => onSelectedEmailsChange([])}>{t('cmpg.clear')}</button>
          </div>
          {shown.length > 0 ? (
            <div className="recipient-list">{shown.map(e => (
              <label key={e.email}><input type="checkbox" checked={selectedEmails.includes(e.email)} onChange={event => onSelectedEmailsChange(event.target.checked ? [...selectedEmails, e.email] : selectedEmails.filter(email => email !== e.email))} /><span>{e.email}<small>{e.divisi}</small></span></label>
            ))}</div>
          ) : <StateMessage variant="empty" compact title={t('cmpg.noMatch')} why=" " />}
          <p className="emp-muted">{t('cmpg.synced')}</p>
        </div>
      )}

      {step === 2 && (
        <div className="ui-form">
          <p className="emp-muted">{t('wiz.s2.help')}</p>
          {!hasContent && (
            <div className="inline-note"><Mail size={18} aria-hidden="true" />
              <div style={{ flex: 1 }}><strong>{t('wiz.s2.none')}</strong><p>{t('wiz.s2.none.why')}</p></div>
              {props.onSetupResources && <button type="button" className="btn btn-primary" onClick={() => props.onSetupResources?.()}>{t('cmpg.setupDemo')}</button>}
            </div>
          )}
          <Field label={t('wiz.s2.template')}>{c => (
            <select {...c} value={form.template} onChange={e => onFormChange({ template: e.target.value })}>
              <option value="">—</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}</Field>
          <Field label={t('wiz.s2.page')}>{c => (
            <select {...c} value={form.page} onChange={e => onFormChange({ page: e.target.value })}>
              <option value="">—</option>{pages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}</Field>
          <Field label={t('wiz.s2.profile')}>{c => (
            <select {...c} value={form.profile} onChange={e => onFormChange({ profile: e.target.value })}>
              <option value="">—</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}</Field>
          <div className="ops-actions" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => { close(); props.onAddContent('template'); }}>{t('wiz.s2.addTemplate')}</button>
            <button type="button" className="btn" onClick={() => { close(); props.onAddContent('page'); }}>{t('wiz.s2.addPage')}</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form id="wizard-form" className="ui-form" onSubmit={onSubmit}>
          <p className="emp-muted">{t('wiz.s3.help')}</p>
          <dl className="acc-facts">
            <div><dt>{t('wiz.s3.recipients')}</dt><dd>{t('wiz.s3.recipients.value', { n: selectedEmails.length })}</dd></div>
            <div><dt>{t('wiz.s2.template')}</dt><dd>{name(templates, form.template)}</dd></div>
            <div><dt>{t('wiz.s2.page')}</dt><dd>{name(pages, form.page)}</dd></div>
            <div><dt>{t('wiz.s2.profile')}</dt><dd>{name(profiles, form.profile)}</dd></div>
          </dl>
          <Field label={t('adm2.launch.name')}>{c => <input {...c} type="text" required maxLength={150} placeholder={t('adm2.launch.name.ph')} value={form.name} onChange={e => onFormChange({ name: e.target.value })} />}</Field>
          <Field label={t('adm2.launch.url')} hint={t('adm2.launch.help')}>{c => <input {...c} type="url" required placeholder={t('adm2.launch.url.ph')} value={form.url} onChange={e => onFormChange({ url: e.target.value })} />}</Field>
          <p className="emp-muted">{t('wiz.s3.points')}</p>
          {error && <p className="field-error" role="alert">{error}</p>}
        </form>
      )}

      {problem && step < 3 && <p className="field-error" role="alert">{problem}</p>}
    </Dialog>
  );
}
