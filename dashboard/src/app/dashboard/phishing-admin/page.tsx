'use client';

import React, { useState, useEffect } from 'react';
import Dialog from '@/components/ui/Dialog';
import Field from '@/components/ui/Field';
import type { MessageKey } from '@/i18n/messages';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n/I18nProvider';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/admin/DashboardLayout';
import GophishCampaignSection from '@/components/admin/GophishCampaignSection';
import EmployeeRosterSection from '@/components/admin/EmployeeRosterSection';
import LeaderboardSection from '@/components/admin/LeaderboardSection';
import AIIntelligenceSection from '@/components/admin/AIIntelligenceSection';
import { usePolling } from '@/hooks/usePolling';
import type { Division, EmployeeAccount, GoPhishCampaign, GoPhishResource, LeaderboardResponse } from '@/components/admin/types';
import { Download, Send, Target } from 'lucide-react';

type EditableGoPhishResource = {
  id: number;
  name: string;
  subject?: string;
  html?: string;
  text?: string;
  capture_credentials?: boolean;
  capture_passwords?: boolean;
  redirect_url?: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

export default function PhishingAdminDashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [templateError, setTemplateError] = useState('');
  const [landingError, setLandingError] = useState('');
  const [divisionError, setDivisionError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'template' | 'page'; id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('gophish');
  const [campaigns, setCampaigns] = useState<GoPhishCampaign[]>([]);
  const [resources, setResources] = useState<GoPhishResource | null>(null);
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [campaignError, setCampaignError] = useState('');
  const [resourceError, setResourceError] = useState('');
  const [campaignNotice, setCampaignNotice] = useState('');
  const [setupBusy, setSetupBusy] = useState(false);
  const [launchError, setLaunchError] = useState('');

  // Leaderboard filters
  const [divisiFilter, setDivisiFilter] = useState('ALL');
  const [badgeFilter, setBadgeFilter] = useState('ALL');

  // Polling
  const { data: leaderboardData } = usePolling<LeaderboardResponse>('/api/admin/leaderboard', 3000);

  // ─── Modal States ──────────────────────────────────────────────────────────
  // 1. Launch Simulation Modal
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [launchName, setLaunchName] = useState('');
  const [launchTemplate, setLaunchTemplate] = useState('');
  const [launchProfile, setLaunchProfile] = useState('');
  const [launchPage, setLaunchPage] = useState('');
  const [launchUrl, setLaunchUrl] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);

  // 2. Template Builder Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState<'new' | 'edit'>('new');
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateHtml, setTemplateHtml] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // 3. Landing Page Builder Modal
  const [isLandingModalOpen, setIsLandingModalOpen] = useState(false);
  const [landingModalMode, setLandingModalMode] = useState<'new' | 'edit'>('new');
  const [landingId, setLandingId] = useState<number | null>(null);
  const [landingName, setLandingName] = useState('');
  const [landingHtml, setLandingHtml] = useState('');
  const [landingRedirectUrl, setLandingRedirectUrl] = useState('');
  const [importSiteUrl, setImportSiteUrl] = useState('');
  const [cloneAuthorized, setCloneAuthorized] = useState(false);
  const [cloneNotice, setCloneNotice] = useState('');
  const [cloneError, setCloneError] = useState('');
  const [isImportingSite, setIsImportingSite] = useState(false);
  const [isSavingLanding, setIsSavingLanding] = useState(false);

  // 4. Add/Edit Employee Modal
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [empEmail, setEmpEmail] = useState('');
  const [empOldEmail, setEmpOldEmail] = useState('');
  const [empDivisi, setEmpDivisi] = useState('');
  const [empActive, setEmpActive] = useState(1);
  const [empRole, setEmpRole] = useState('employee');
  const [empPassword, setEmpPassword] = useState('');
  const [empFormError, setEmpFormError] = useState('');
  const [isSavingEmp, setIsSavingEmp] = useState(false);

  // 5. Add Division Modal
  const [isAddDivisionModalOpen, setIsAddDivisionModalOpen] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [isSavingDivision, setIsSavingDivision] = useState(false);

  // ─── Data Loaders ──────────────────────────────────────────────────────────
  const loadCampaigns = async () => {
    try {
      const res = await fetch('/api/admin/gophish/campaigns');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('adm3.err.campaigns'));
      setCampaigns(Array.isArray(data) ? data : data?.campaigns || []);
      setCampaignError('');
    } catch (err) {
      setCampaignError(errorMessage(err));
    }
  };

  const loadResources = async () => {
    try {
      const res = await fetch('/api/admin/gophish/resources');
      const data: GoPhishResource & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || t('adm3.err.resources'));
      setResources(data);
      setResourceError('');
      setLaunchTemplate(previous => data.templates.some(t => String(t.id) === previous) ? previous : String(data.templates[0]?.id ?? ''));
      const profiles = data.profiles.filter(p => p.host === 'mailpit:1025');
      setLaunchProfile(previous => profiles.some(p => String(p.id) === previous) ? previous : String(profiles[0]?.id ?? ''));
      setLaunchPage(previous => data.pages.some(p => String(p.id) === previous) ? previous : String(data.pages[0]?.id ?? ''));
      setLaunchUrl(previous => previous || data.phishUrl || '');
    } catch (err) {
      setResources(null);
      setResourceError(errorMessage(err));
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/admin/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(Array.isArray(data) ? data : data?.employees || []);
      }
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  };

  const loadDivisions = async () => {
    try {
      const res = await fetch('/api/admin/divisions');
      if (res.ok) {
        const data = await res.json();
        setDivisions(Array.isArray(data) ? data : data?.divisions || []);
      }
    } catch (err) {
      console.error('Error loading divisions:', err);
    }
  };

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadCampaigns();
      void loadResources();
      void loadEmployees();
      void loadDivisions();
    }, 0);
    const refresh = window.setInterval(() => void loadCampaigns(), 10000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(refresh); };
    // Loaders intentionally use the initial filter/resource selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Actions & Handlers ───────────────────────────────────────────────────
  const handleSyncUsers = async () => {
    try {
      const res = await fetch('/api/admin/gophish/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) toast.show({ message: t('adm.sync.ok'), tone: 'ok' });
      else toast.show({ message: `${t('adm.sync.fail')}: ${data.error || ''}`.replace(/: $/, ''), tone: 'bad' });
    } catch {
      toast.show({ message: t('adm.error.server'), tone: 'bad' });
    }
  };

  const handleDeleteCampaign = async (id: number, source: 'local' | 'gophish' = 'gophish') => {
    const res = await fetch(`/api/admin/gophish/campaigns/${id}?source=${source}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t('adm3.err.deleteCampaign'));
    setCampaigns(c => c.filter(item => !(item.id === id && (item.source || 'gophish') === source)));
  };

  const handleSetupResources = async (preset?: 'password-reset') => {
    setSetupBusy(true); setResourceError(''); setCampaignNotice('');
    try {
      const res = await fetch('/api/admin/gophish/resources/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preset }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('adm3.err.setup'));
      await loadResources();
      if (data.template_id) setLaunchTemplate(String(data.template_id));
      if (data.page_id) setLaunchPage(String(data.page_id));
      setCampaignNotice(data.message);
    } catch (err) { setResourceError(errorMessage(err)); }
    finally { setSetupBusy(false); }
  };

  const handleCompleteCampaign = async () => {
    await loadCampaigns();
  };

  // Launch Modal Submit
  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaunchError('');
    if (!launchName.trim() || !launchTemplate || !launchProfile || !launchPage || !launchUrl || !selectedEmails.length) {
      setLaunchError(t('adm.validation.launch'));
      return;
    }

    setIsLaunching(true);
    try {
      const res = await fetch('/api/admin/gophish/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: launchName.trim(),
          template_id: Number(launchTemplate),
          smtp_id: Number(launchProfile),
          page_id: Number(launchPage),
          url: launchUrl.trim(),
          target_emails: selectedEmails,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCampaignNotice(data.message || t('adm3.notice.launched'));
        setIsLaunchModalOpen(false);
        setLaunchName('');
        await loadCampaigns();
      } else {
        setLaunchError(data.error || t('adm3.err.launch'));
      }
    } catch (err: unknown) {
      setLaunchError(t('adm3.err.connection', { detail: errorMessage(err) }));
    } finally {
      setIsLaunching(false);
    }
  };

  // Template Modal Handlers
  const handleOpenTemplateBuilder = (mode: 'new' | 'edit', type: 'template' | 'page', item?: EditableGoPhishResource) => {
    if (type === 'template') {
      setTemplateModalMode(mode);
      if (mode === 'edit' && item) {
        setTemplateId(item.id);
        setTemplateName(item.name || '');
        setTemplateSubject(item.subject || '');
        setTemplateHtml(item.html || '');
        setTemplateText(item.text || '');
      } else {
        setTemplateId(null);
        setTemplateName('');
        setTemplateSubject('');
        setTemplateHtml('<p>Hello {{.FirstName}},</p><p>Please verify your account: <a href="{{.URL}}">Continue verification</a></p>');
        setTemplateText('Hello {{.FirstName}},\nPlease verify your account: {{.URL}}');
      }
      setTemplateError('');
      setIsTemplateModalOpen(true);
    } else {
      setLandingModalMode(mode);
      setLandingError('');
      setCloneAuthorized(false); setCloneError(''); setCloneNotice(''); setImportSiteUrl('');
      if (mode === 'edit' && item) {
        setLandingId(item.id);
        setLandingName(item.name || '');
        setLandingHtml(item.html || '');
        setLandingRedirectUrl(item.redirect_url || '');
      } else {
        setLandingId(null);
        setLandingName('');
        setLandingHtml('<!DOCTYPE html><html><head><title>Lab account verification</title></head><body><form method="POST"><input type="email" placeholder="Demo email" required/><input type="password" placeholder="Dummy password" required/><button type="submit">Verify</button></form></body></html>');
        setLandingRedirectUrl(resources?.educationUrl || '');
      }
      setIsLandingModalOpen(true);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateSubject.trim()) {
      setTemplateError(t('adm.validation.template'));
      return;
    }

    setTemplateError('');
    setIsSavingTemplate(true);
    try {
      const url = templateModalMode === 'edit' && templateId 
        ? `/api/admin/gophish/templates/${templateId}` 
        : '/api/admin/gophish/templates';
      const method = templateModalMode === 'edit' && templateId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          subject: templateSubject,
          html: templateHtml,
          text: templateText,
        }),
      });

      if (res.ok) {
        toast.show({ message: t('adm.template.saved'), tone: 'ok' });
        setIsTemplateModalOpen(false);
        await loadResources();
      } else {
        const data = await res.json();
        setTemplateError(data.error || t('adm.error.server'));
      }
    } catch {
      setTemplateError(t('adm.error.server'));
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = (id: number) => {
    const item = resources?.templates.find(x => x.id === id);
    setConfirmDelete({ kind: 'template', id, name: item?.name || `#${id}` });
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const path = confirmDelete.kind === 'template' ? 'templates' : 'pages';
      const res = await fetch(`/api/admin/gophish/${path}/${confirmDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.show({ message: t(confirmDelete.kind === 'template' ? 'adm.template.deleted' : 'adm.page.deleted'), tone: 'ok' });
        setConfirmDelete(null);
        await loadResources();
      } else toast.show({ message: t('adm.delete.failed'), tone: 'bad' });
    } catch {
      toast.show({ message: t('adm.error.server'), tone: 'bad' });
    } finally { setDeleting(false); }
  };

  // Landing Page Modal Handlers
  const handleImportSite = async () => {
    setCloneError(''); setCloneNotice('');
    if (!importSiteUrl.trim() || !cloneAuthorized) {
      setCloneError(t('adm3.err.cloneInput'));
      return;
    }
    setIsImportingSite(true);
    try {
      const res = await fetch('/api/admin/gophish/import-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importSiteUrl.trim(), authorized: cloneAuthorized }),
      });
      const data = await res.json();
      if (res.ok && data.html) {
        setLandingHtml(data.html);
        setLandingRedirectUrl(data.redirect_url);
        setCloneNotice(data.message);
      } else {
        setCloneError(data.error || t('adm3.err.cloneFetch'));
      }
    } catch (err: unknown) {
      setCloneError(`Connection failed: ${errorMessage(err)}`);
    } finally {
      setIsImportingSite(false);
    }
  };

  const handleSaveLandingPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingName.trim() || !landingHtml.trim()) {
      setLandingError(t('adm.validation.landing'));
      return;
    }

    setLandingError('');
    setIsSavingLanding(true);
    try {
      const url = landingModalMode === 'edit' && landingId 
        ? `/api/admin/gophish/pages/${landingId}` 
        : '/api/admin/gophish/pages';
      const method = landingModalMode === 'edit' && landingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: landingName,
          html: landingHtml,
          capture_credentials: false,
          capture_passwords: false,
          redirect_url: landingRedirectUrl,
        }),
      });

      if (res.ok) {
        toast.show({ message: t('adm.page.saved'), tone: 'ok' });
        setIsLandingModalOpen(false);
        await loadResources();
      } else {
        const data = await res.json();
        setLandingError(data.error || t('adm.error.server'));
      }
    } catch {
      setLandingError(t('adm.error.server'));
    } finally {
      setIsSavingLanding(false);
    }
  };

  const handleDeletePage = (id: number) => {
    const item = resources?.pages.find(x => x.id === id);
    setConfirmDelete({ kind: 'page', id, name: item?.name || `#${id}` });
  };

  // Employee CRUD Handlers
  const handleOpenAddEmployee = (existing?: EmployeeAccount) => {
    setEmpEmail(existing?.email || '');
    setEmpDivisi(existing?.divisi || divisions[0]?.name || 'IT');
    setEmpActive(1);
    setEmpRole('employee');
    setEmpPassword('');
    setEmpFormError('');
    setIsAddEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: EmployeeAccount) => {
    setEmpOldEmail(emp.email);
    setEmpEmail(emp.email);
    setEmpDivisi(emp.divisi || 'IT');
    setEmpActive(emp.is_active ?? 1);
    setEmpRole(emp.role || 'employee');
    setEmpPassword('');
    setEmpFormError('');
    setIsEditEmployeeModalOpen(true);
  };

  const requireFreshAdminLogin = async () => {
    setEmpFormError(t('adm3.err.session'));
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.setTimeout(() => router.push('/auth'), 900);
    }
  };

  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empEmail.trim() || !empPassword) {
      setEmpFormError(t('adm3.err.empRequired'));
      return;
    }

    setIsSavingEmp(true);
    setEmpFormError('');
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: empEmail.trim(),
          divisi: empDivisi.trim(),
          is_active: empActive,
          role: empRole,
          password: empPassword,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsAddEmployeeModalOpen(false);
        await loadEmployees();
      } else if (res.status === 401 || res.status === 403) {
        await requireFreshAdminLogin();
      } else {
        setEmpFormError(data.error || t('adm3.err.empCreate'));
      }
    } catch (err: unknown) {
      setEmpFormError(`Connection failed: ${errorMessage(err)}`);
    } finally {
      setIsSavingEmp(false);
    }
  };

  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empEmail.trim()) {
      setEmpFormError(t('adm.validation.email'));
      return;
    }

    setIsSavingEmp(true);
    setEmpFormError('');
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_email: empOldEmail,
          email: empEmail.trim(),
          divisi: empDivisi.trim(),
          is_active: empActive,
          role: empRole,
          password: empPassword || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsEditEmployeeModalOpen(false);
        await loadEmployees();
      } else if (res.status === 401 || res.status === 403) {
        await requireFreshAdminLogin();
      } else {
        setEmpFormError(data.error || t('adm3.err.empUpdate'));
      }
    } catch (err: unknown) {
      setEmpFormError(`Connection failed: ${errorMessage(err)}`);
    } finally {
      setIsSavingEmp(false);
    }
  };

  // Division CRUD Handlers
  const handleOpenAddDivision = () => {
    setNewDivisionName('');
    setDivisionError('');
    setIsAddDivisionModalOpen(true);
  };

  const handleAddDivisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivisionName.trim()) {
      setDivisionError(t('adm.validation.division'));
      return;
    }

    setDivisionError('');
    setIsSavingDivision(true);
    try {
      const res = await fetch('/api/admin/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDivisionName.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.show({ message: t('adm.division.added'), tone: 'ok' });
        setIsAddDivisionModalOpen(false);
        await loadDivisions();
      } else {
        setDivisionError(data.error || t('adm.error.server'));
      }
    } catch {
      setDivisionError(t('adm.error.server'));
    } finally {
      setIsSavingDivision(false);
    }
  };

  return (
    <DashboardLayout role="phishing_admin" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'gophish' && (
        <GophishCampaignSection
          readOnly={false}
          campaigns={Array.isArray(campaigns) ? campaigns : []}
          employees={Array.isArray(employees) ? employees : []}
          divisions={Array.isArray(divisions) ? divisions : []}
          resources={resources}
          selectedEmails={Array.isArray(selectedEmails) ? selectedEmails : []}
          onSelectedEmailsChange={setSelectedEmails}
          onSyncUsers={handleSyncUsers}
          onOpenLaunchModal={() => {
            setLaunchError('');
            setIsLaunchModalOpen(true);
            loadResources();
          }}
          onDeleteCampaign={handleDeleteCampaign}
          onCompleteCampaign={handleCompleteCampaign}
          onOpenTemplateBuilder={handleOpenTemplateBuilder}
          onDeleteTemplate={handleDeleteTemplate}
          onDeletePage={handleDeletePage}
          onSetupResources={preset => void handleSetupResources(preset)}
          onRefresh={() => { void loadCampaigns(); void loadResources(); }}
          busy={setupBusy || isLaunching}
          error={resourceError || campaignError}
          notice={campaignNotice}
        />
      )}

      {activeTab === 'employees' && (
        <EmployeeRosterSection
          readOnly={false}
          employees={Array.isArray(employees) ? employees : []}
          divisions={Array.isArray(divisions) ? divisions : []}
          onOpenAddEmployee={handleOpenAddEmployee}
          onOpenEditEmployee={handleOpenEditEmployee}
          onOpenAddDivision={handleOpenAddDivision}
        />
      )}

      {activeTab === 'leaderboard' && (
        <LeaderboardSection
          readOnly={false}
          leaderboardData={leaderboardData}
          divisiFilter={divisiFilter}
          badgeFilter={badgeFilter}
          onDivisiFilterChange={setDivisiFilter}
          onBadgeFilterChange={setBadgeFilter}
        />
      )}

      {activeTab === 'ai' && (
        <AIIntelligenceSection role="phishing_admin" readOnly={false} />
      )}

      {/* Launch a lab campaign */}
      <Dialog open={isLaunchModalOpen} onClose={() => setIsLaunchModalOpen(false)} busy={isLaunching} title={t('adm2.launch.title')} description={t('adm2.launch.help')} size="md"
        footer={<>
          <button type="button" className="btn" disabled={isLaunching} onClick={() => setIsLaunchModalOpen(false)}>{t('common.cancel')}</button>
          <button type="submit" form="launch-form" className="btn btn-primary" disabled={isLaunching}>{isLaunching ? t('adm2.launch.submitting') : <><Send size={14} aria-hidden="true" /> {t('adm2.launch.submit')}</>}</button>
        </>}>
        <form id="launch-form" onSubmit={handleLaunchCampaign} className="ui-form">
          {launchError && <p className="field-error" role="alert">{launchError}</p>}
          <Field label={t('adm2.launch.name')}>{c => <input {...c} type="text" required maxLength={150} placeholder={t('adm2.launch.name.ph')} value={launchName} onChange={e => setLaunchName(e.target.value)} />}</Field>
          <Field label={t('adm2.launch.template')}>{c => <select {...c} required value={launchTemplate} onChange={e => setLaunchTemplate(e.target.value)}>{(resources?.templates || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</Field>
          <Field label={t('adm2.launch.profile')}>{c => <select {...c} required value={launchProfile} onChange={e => setLaunchProfile(e.target.value)}>{(resources?.profiles || []).filter(p => p.host === 'mailpit:1025').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</Field>
          <Field label={t('adm2.launch.page')}>{c => <select {...c} required value={launchPage} onChange={e => setLaunchPage(e.target.value)}>{(resources?.pages || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</Field>
          <Field label={t('adm2.launch.url')}>{c => <input {...c} type="url" required placeholder={t('adm2.launch.url.ph')} value={launchUrl} onChange={e => setLaunchUrl(e.target.value)} />}</Field>
          {selectedEmails.length > 0 && <p className="inline-note"><Target size={14} aria-hidden="true" />{t('adm2.launch.targets', { n: selectedEmails.length })}</p>}
        </form>
      </Dialog>

      {/* Email template */}
      <Dialog open={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} busy={isSavingTemplate} size="lg" title={t(templateModalMode === 'edit' ? 'adm2.tpl.edit' : 'adm2.tpl.create')}
        footer={<>
          <button type="button" className="btn" disabled={isSavingTemplate} onClick={() => setIsTemplateModalOpen(false)}>{t('common.cancel')}</button>
          <button type="submit" form="template-form" className="btn btn-primary" disabled={isSavingTemplate}>{isSavingTemplate ? t('adm2.tpl.saving') : t('adm2.tpl.save')}</button>
        </>}>
        <form id="template-form" onSubmit={handleSaveTemplate} className="ui-form">
          {templateError && <p className="field-error" role="alert">{templateError}</p>}
          <Field label={t('adm2.tpl.name')}>{c => <input {...c} type="text" placeholder={t('adm2.tpl.name.ph')} value={templateName} onChange={e => setTemplateName(e.target.value)} />}</Field>
          <Field label={t('adm2.tpl.subject')}>{c => <input {...c} type="text" placeholder={t('adm2.tpl.subject.ph')} value={templateSubject} onChange={e => setTemplateSubject(e.target.value)} />}</Field>
          <Field label={t('adm2.tpl.html')}>{c => <textarea {...c} rows={8} style={{ fontFamily: 'var(--font-mono, monospace)' }} value={templateHtml} onChange={e => setTemplateHtml(e.target.value)} />}</Field>
        </form>
      </Dialog>

      {/* Landing page (create, edit, copy a site) */}
      <Dialog open={isLandingModalOpen} onClose={() => setIsLandingModalOpen(false)} busy={isSavingLanding || isImportingSite} size="lg" title={t(landingModalMode === 'edit' ? 'adm2.land.edit' : 'adm2.land.create')}
        footer={<>
          <button type="button" className="btn" disabled={isSavingLanding || isImportingSite} onClick={() => setIsLandingModalOpen(false)}>{t('common.cancel')}</button>
          <button type="submit" form="landing-form" className="btn btn-primary" disabled={isSavingLanding}>{isSavingLanding ? t('adm2.common.saving') : t('adm2.land.save')}</button>
        </>}>
        <div className="ai-callout">
          <strong>{t('adm2.land.clone.title')}</strong>
          <Field label={t('adm2.land.clone.url')}>{c => <input {...c} type="text" placeholder={t('adm2.land.clone.ph')} value={importSiteUrl} onChange={e => setImportSiteUrl(e.target.value)} />}</Field>
          <div><button type="button" className="btn" onClick={handleImportSite} disabled={isImportingSite || !cloneAuthorized || !importSiteUrl.trim()}><Download size={14} aria-hidden="true" /> {isImportingSite ? t('adm2.land.clone.busy') : t('adm2.land.clone.btn')}</button></div>
          <label className="campaign-clone-consent"><input type="checkbox" checked={cloneAuthorized} onChange={e => setCloneAuthorized(e.target.checked)} /> {t('adm2.land.clone.consent')}</label>
          <p className="emp-muted">{t('adm2.land.clone.note')}</p>
          {cloneError && <p className="field-error" role="alert">{cloneError}</p>}
          {cloneNotice && <p className="emp-muted" role="status">{cloneNotice}</p>}
        </div>
        <form id="landing-form" onSubmit={handleSaveLandingPage} className="ui-form">
          {landingError && <p className="field-error" role="alert">{landingError}</p>}
          <Field label={t('adm2.land.name')}>{c => <input {...c} type="text" placeholder={t('adm2.land.name.ph')} value={landingName} onChange={e => setLandingName(e.target.value)} />}</Field>
          <Field label={t('adm2.land.html')}>{c => <textarea {...c} rows={8} style={{ fontFamily: 'var(--font-mono, monospace)' }} value={landingHtml} onChange={e => setLandingHtml(e.target.value)} />}</Field>
          <p className="inline-note">{t('adm2.land.note')}</p>
          <Field label={t('adm2.land.redirect')}>{c => <input {...c} type="text" placeholder={resources?.educationUrl || t('adm2.land.redirect.ph')} value={landingRedirectUrl} onChange={e => setLandingRedirectUrl(e.target.value)} />}</Field>
        </form>
      </Dialog>

      {/* Employee account (create and edit share one form) */}
      {([
        { open: isAddEmployeeModalOpen, close: () => setIsAddEmployeeModalOpen(false), submit: handleAddEmployeeSubmit, mode: 'create' as const },
        { open: isEditEmployeeModalOpen, close: () => setIsEditEmployeeModalOpen(false), submit: handleEditEmployeeSubmit, mode: 'edit' as const },
      ]).map(({ open, close, submit, mode }) => (
        <Dialog key={mode} open={open} onClose={close} busy={isSavingEmp} size="md" title={t(mode === 'create' ? 'adm2.emp.create' : 'adm2.emp.edit')}
          footer={<>
            <button type="button" className="btn" disabled={isSavingEmp} onClick={close}>{t('common.cancel')}</button>
            <button type="submit" form={`employee-form-${mode}`} className="btn btn-primary" disabled={isSavingEmp}>{isSavingEmp ? t(mode === 'create' ? 'adm2.emp.create.submitting' : 'adm2.common.saving') : t(mode === 'create' ? 'adm2.emp.create.submit' : 'adm2.emp.edit.submit')}</button>
          </>}>
          <form id={`employee-form-${mode}`} onSubmit={submit} className="ui-form">
            <Field label={t('adm2.emp.email')}>{c => <input {...c} type="email" placeholder={mode === 'create' ? t('adm2.emp.email.ph') : undefined} value={empEmail} onChange={e => setEmpEmail(e.target.value)} />}</Field>
            <Field label={t('adm2.emp.role')}>{c => (
              <select {...c} value={empRole} onChange={e => setEmpRole(e.target.value)}>
                {(['employee', 'phishing_admin', 'soc', 'grc', 'ciso'] as const).map(role => <option key={role} value={role}>{t(`adm2.role.${role}` as MessageKey)}</option>)}
              </select>
            )}</Field>
            <Field label={t(mode === 'create' ? 'adm2.emp.password' : 'adm2.emp.reset')} hint={mode === 'create' ? t('adm2.emp.password.hint') : undefined}>{c => <input {...c} type="password" autoComplete="new-password" placeholder={t(mode === 'create' ? 'adm2.emp.password.ph' : 'adm2.emp.reset.ph')} value={empPassword} onChange={e => setEmpPassword(e.target.value)} />}</Field>
            <Field label={t('adm2.emp.division')}>{c => <select {...c} value={empDivisi} onChange={e => setEmpDivisi(e.target.value)}>{divisions.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}</select>}</Field>
            <label className="campaign-clone-consent"><input type="checkbox" checked={empActive === 1} onChange={e => setEmpActive(e.target.checked ? 1 : 0)} /> {t(mode === 'create' ? 'adm2.emp.active.create' : 'adm2.emp.active')}</label>
            {empFormError && <p className="field-error" role="alert">{empFormError}</p>}
          </form>
        </Dialog>
      ))}

      {/* Add division */}
      <Dialog open={isAddDivisionModalOpen} onClose={() => setIsAddDivisionModalOpen(false)} busy={isSavingDivision} size="sm" title={t('adm2.div.title')}
        footer={<>
          <button type="button" className="btn" disabled={isSavingDivision} onClick={() => setIsAddDivisionModalOpen(false)}>{t('common.cancel')}</button>
          <button type="submit" form="division-form" className="btn btn-primary" disabled={isSavingDivision}>{isSavingDivision ? t('adm2.common.saving') : t('adm2.div.submit')}</button>
        </>}>
        <form id="division-form" onSubmit={handleAddDivisionSubmit} className="ui-form">
          <Field label={t('adm2.div.name')} error={divisionError}>{c => <input {...c} type="text" placeholder={t('adm2.div.name.ph')} value={newDivisionName} onChange={e => setNewDivisionName(e.target.value)} />}</Field>
        </form>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => { if (!deleting) setConfirmDelete(null); }}
        busy={deleting}
        tone="danger"
        size="sm"
        title={t(confirmDelete?.kind === 'page' ? 'adm.delete.page.title' : 'adm.delete.template.title')}
        description={t('adm.delete.body', { name: confirmDelete?.name ?? '' })}
        footer={<>
          <button type="button" className="btn" disabled={deleting} onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
          <button type="button" className="btn btn-danger" disabled={deleting} onClick={() => void performDelete()}>{deleting ? t('adm.delete.working') : t('adm.delete.confirm')}</button>
        </>}
      />
    </DashboardLayout>
  );
}
