'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/admin/DashboardLayout';
import GophishCampaignSection from '@/components/admin/GophishCampaignSection';
import EmployeeRosterSection from '@/components/admin/EmployeeRosterSection';
import LeaderboardSection from '@/components/admin/LeaderboardSection';
import AIIntelligenceSection from '@/components/admin/AIIntelligenceSection';
import { usePolling } from '@/hooks/usePolling';
import type { Division, EmployeeAccount, GoPhishCampaign, GoPhishResource, LeaderboardResponse } from '@/components/admin/types';
import { X, Play, Mail, Globe, Users, Building, Download, Edit3, Send, Target } from 'lucide-react';

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
  return error instanceof Error ? error.message : 'An unexpected error occurred';
}

export default function PhishingAdminDashboard() {
  const router = useRouter();
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
  const launchDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (isLaunchModalOpen && !launchDialog.current?.open) launchDialog.current?.showModal();
  }, [isLaunchModalOpen]);

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
      if (!res.ok) throw new Error(data.error || 'Could not load campaigns.');
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
      if (!res.ok) throw new Error(data.error || 'Could not load GoPhish resources.');
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
  }, []);

  // ─── Actions & Handlers ───────────────────────────────────────────────────
  const handleSyncUsers = async () => {
    try {
      const res = await fetch('/api/admin/gophish/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) alert(data.message || 'Employee roster synced to GoPhish.');
      else alert(`Could not sync: ${data.error || 'Unexpected error'}`);
    } catch {
      alert('Could not reach the server.');
    }
  };

  const handleDeleteCampaign = async (id: number, source: 'local' | 'gophish' = 'gophish') => {
    const res = await fetch(`/api/admin/gophish/campaigns/${id}?source=${source}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not delete the campaign.');
    setCampaigns(c => c.filter(item => !(item.id === id && (item.source || 'gophish') === source)));
  };

  const handleSetupResources = async (preset?: 'password-reset') => {
    setSetupBusy(true); setResourceError(''); setCampaignNotice('');
    try {
      const res = await fetch('/api/admin/gophish/resources/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preset }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not set up campaign resources.');
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
      setLaunchError('Pilih penerima, template, landing page, Mailpit, dan isi URL server GoPhish.');
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
        setCampaignNotice(data.message || 'Campaign diterima GoPhish. Pantau status pengiriman dan Mailpit.');
        setIsLaunchModalOpen(false);
        setLaunchName('');
        await loadCampaigns();
      } else {
        setLaunchError(data.error || 'Could not create the campaign.');
      }
    } catch (err: unknown) {
      setLaunchError(`Connection failed: ${errorMessage(err)}. Check the campaign list before retrying.`);
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
      setIsTemplateModalOpen(true);
    } else {
      setLandingModalMode(mode);
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
      alert('Template name and subject are required');
      return;
    }

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
        alert(`Email template ${templateModalMode === 'edit' ? 'updated' : 'created'}.`);
        setIsTemplateModalOpen(false);
        await loadResources();
      } else {
        const data = await res.json();
        alert(`Could not save template: ${data.error || 'Unexpected error'}`);
      }
    } catch (err: unknown) {
      alert(`Backend connection failed: ${errorMessage(err)}`);
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Yakin ingin menghapus email template ini?')) return;
    try {
      const res = await fetch(`/api/admin/gophish/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadResources();
      } else {
        alert('Could not delete the template.');
      }
    } catch {
      alert('Could not reach the backend.');
    }
  };

  // Landing Page Modal Handlers
  const handleImportSite = async () => {
    setCloneError(''); setCloneNotice('');
    if (!importSiteUrl.trim() || !cloneAuthorized) {
      setCloneError('Enter a public URL and confirm permission to use the page.');
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
        setCloneError(data.error || 'Check that the URL is valid and reachable');
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
      alert('Landing page name and HTML are required');
      return;
    }

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
        alert(`Landing page ${landingModalMode === 'edit' ? 'updated' : 'created'}.`);
        setIsLandingModalOpen(false);
        await loadResources();
      } else {
        const data = await res.json();
        alert(`Could not save landing page: ${data.error || 'Unexpected error'}`);
      }
    } catch (err: unknown) {
      alert(`Backend connection failed: ${errorMessage(err)}`);
    } finally {
      setIsSavingLanding(false);
    }
  };

  const handleDeletePage = async (id: number) => {
    if (!confirm('Yakin ingin menghapus landing page ini?')) return;
    try {
      const res = await fetch(`/api/admin/gophish/pages/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadResources();
      } else {
        alert('Could not delete the landing page.');
      }
    } catch {
      alert('Could not reach the backend.');
    }
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
    setEmpFormError('Administrator session expired or changed. Redirecting to sign-in…');
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.setTimeout(() => router.push('/auth'), 900);
    }
  };

  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empEmail.trim() || !empPassword) {
      setEmpFormError('Email and initial password are required.');
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
        setEmpFormError(data.error || 'Could not create the employee account.');
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
      alert('Email is required');
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
        setEmpFormError(data.error || 'Could not update the employee account.');
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
    setIsAddDivisionModalOpen(true);
  };

  const handleAddDivisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivisionName.trim()) {
      alert('Division name is required');
      return;
    }

    setIsSavingDivision(true);
    try {
      const res = await fetch('/api/admin/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDivisionName.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Division added.');
        setIsAddDivisionModalOpen(false);
        await loadDivisions();
      } else {
        alert(`Could not add division: ${data.error || 'Unexpected error'}`);
      }
    } catch (err: unknown) {
      alert(`Connection failed: ${errorMessage(err)}`);
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

      {/* ── MODAL 1: Launch Phishing Simulation ── */}
      {isLaunchModalOpen && (
        <dialog ref={launchDialog} className="campaign-dialog campaign-launch" aria-labelledby="campaign-launch-title" onCancel={event => { if (isLaunching) event.preventDefault(); else setIsLaunchModalOpen(false); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 id="campaign-launch-title" style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Play size={18} style={{ color: 'var(--accent)' }} /> Create lab campaign
              </h3>
              <button disabled={isLaunching} aria-label="Close" onClick={() => setIsLaunchModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLaunchCampaign} className="debt-form">
              <p className="debt-help">Emails are captured in Mailpit only. Use a server URL that recipients can reach.</p>
              {launchError && <p className="debt-error" role="alert">{launchError}</p>}
              <div>
                <label htmlFor="launch-name" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Campaign Name *
                </label>
                <input
                  type="text"
                  id="launch-name"
                  required maxLength={150}
                  placeholder="e.g. Q3 Urgent Security Verification"
                  value={launchName}
                  onChange={(e) => setLaunchName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label htmlFor="launch-template" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Email Pretext Template *
                </label>
                <select
                  id="launch-template"
                  required
                  value={launchTemplate}
                  onChange={(e) => setLaunchTemplate(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                >
                  {(resources?.templates || []).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="launch-profile" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Sending Profile (SMTP) *
                </label>
                <select
                  id="launch-profile"
                  required
                  value={launchProfile}
                  onChange={(e) => setLaunchProfile(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                >
                  {(resources?.profiles || []).filter(p => p.host === 'mailpit:1025').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="launch-page" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Landing Page Portal *
                </label>
                <select
                  id="launch-page"
                  required
                  value={launchPage}
                  onChange={(e) => setLaunchPage(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                >
                  {(resources?.pages || []).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="launch-url" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  URL server GoPhish untuk penerima *
                </label>
                <input
                  type="url" required placeholder="http://IP-SERVER:8080"
                  id="launch-url"
                  value={launchUrl}
                  onChange={(e) => setLaunchUrl(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              {selectedEmails.length > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(33, 150, 243, 0.08)', border: '1px solid var(--accent)', fontSize: '12px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={14} /> Targeting {selectedEmails.length} specifically selected employee(s).
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  disabled={isLaunching}
                  onClick={() => setIsLaunchModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLaunching}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {isLaunching ? 'Creating campaign…' : <><Send size={14} /> Send to Mailpit</>}
                </button>
              </div>
            </form>
        </dialog>
      )}

      {/* ── MODAL 2: Template Builder (Create / Edit) ── */}
      {isTemplateModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up font-body" style={{ maxWidth: '640px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Mail size={18} style={{ color: 'var(--accent)' }} /> {templateModalMode === 'edit' ? 'Edit Email Template' : 'Create Email Template'}
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Template Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. IT Helpdesk Password Reset"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Email Subject *
                </label>
                <input
                  type="text"
                  placeholder="e.g. [URGENT] Action Required: Password Expiry Notice"
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  HTML Content (supports GoPhish tags e.g. {"{{.URL}}"}, {"{{.FirstName}}"})
                </label>
                <textarea
                  rows={8}
                  value={templateHtml}
                  onChange={(e) => setTemplateHtml(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTemplate}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                >
                  {isSavingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Landing Page Builder (Create / Edit / Clone) ── */}
      {isLandingModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up font-body" style={{ maxWidth: '680px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Globe size={18} style={{ color: 'var(--accent)' }} /> {landingModalMode === 'edit' ? 'Edit Landing Page' : 'Create Landing Page'}
              </h3>
              <button onClick={() => setIsLandingModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Import / Clone Site Helper */}
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Clone login page · Firecrawl
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="https://domain-milik-anda.com/login"
                  value={importSiteUrl}
                  onChange={(e) => setImportSiteUrl(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={handleImportSite}
                  disabled={isImportingSite || !cloneAuthorized || !importSiteUrl.trim()}
                  style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={13} /> {isImportingSite ? 'Fetching HTML…' : 'Clone Firecrawl'}
                </button>
              </div>
              <label className="campaign-clone-consent"><input type="checkbox" checked={cloneAuthorized} onChange={e => setCloneAuthorized(e.target.checked)} />I own this page or have permission to use it for simulation.</label>
              <p className="debt-help">Clones static visuals only. Source scripts and forms are removed; SPA/OAuth pages may not be supported.</p>
              {cloneError && <p className="debt-error" role="alert">{cloneError}</p>}
              {cloneNotice && <p className="debt-notice" role="status">{cloneNotice}</p>}
            </div>

            <form onSubmit={handleSaveLandingPage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Page Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Demo Password Verification"
                  value={landingName}
                  onChange={(e) => setLandingName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  HTML Content *
                </label>
                <textarea
                  rows={8}
                  value={landingHtml}
                  onChange={(e) => setLandingHtml(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
                />
              </div>

              <p className="debt-notice">Only submission events are recorded. Saved pages use a demo form that does not send credentials. Never use real passwords.</p>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Redirect URL (After Submission)
                </label>
                <input
                  type="text"
                  placeholder={resources?.educationUrl || 'AFFERENT education page URL'}
                  value={landingRedirectUrl}
                  onChange={(e) => setLandingRedirectUrl(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsLandingModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLanding}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                >
                  {isSavingLanding ? 'Saving...' : 'Save Landing Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4A: Add Employee ── */}
      {isAddEmployeeModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up font-body" style={{ maxWidth: '460px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Users size={18} style={{ color: 'var(--accent)' }} /> Create Employee Account
              </h3>
              <button onClick={() => setIsAddEmployeeModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="employee@corp.local"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Access Role *
                </label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                >
                  <option value="employee">Employee</option>
                  <option value="phishing_admin">Administrator</option>
                  <option value="soc">SOC Analyst</option>
                  <option value="grc">GRC Specialist</option>
                  <option value="ciso">CISO Executive</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Initial Password *
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 12 characters"
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '10px', margin: '6px 0 0' }}>Use uppercase, lowercase, and numbers. The password is stored using Argon2id.</p>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Division *
                </label>
                <select
                  value={empDivisi}
                  onChange={(e) => setEmpDivisi(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                >
                  {divisions.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={empActive === 1}
                  onChange={(e) => setEmpActive(e.target.checked ? 1 : 0)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Active Employee (Receives simulation campaigns)
              </label>

              {empFormError && <div className="auth-form-error" role="alert">{empFormError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmp}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                >
                  {isSavingEmp ? 'Creating account...' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4B: Edit Employee ── */}
      {isEditEmployeeModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up font-body" style={{ maxWidth: '460px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Edit3 size={18} style={{ color: 'var(--accent)' }} /> Edit Employee
              </h3>
              <button onClick={() => setIsEditEmployeeModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={empEmail}
                  onChange={(e) => setEmpEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Access Role *
                </label>
                <select
                  value={empRole}
                  onChange={(e) => setEmpRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                >
                  <option value="employee">Employee</option>
                  <option value="phishing_admin">Administrator</option>
                  <option value="soc">SOC Analyst</option>
                  <option value="grc">GRC Specialist</option>
                  <option value="ciso">CISO Executive</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Reset Password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Division *
                </label>
                <select
                  value={empDivisi}
                  onChange={(e) => setEmpDivisi(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                >
                  {divisions.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={empActive === 1}
                  onChange={(e) => setEmpActive(e.target.checked ? 1 : 0)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Active Employee
              </label>

              {empFormError && <div className="auth-form-error" role="alert">{empFormError}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditEmployeeModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEmp}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                >
                  {isSavingEmp ? 'Saving...' : 'Update Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 5: Add Division ── */}
      {isAddDivisionModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up font-body" style={{ maxWidth: '420px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Building size={18} style={{ color: 'var(--accent)' }} /> Add New Division
              </h3>
              <button onClick={() => setIsAddDivisionModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddDivisionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Division Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cyber Threat Intelligence"
                  value={newDivisionName}
                  onChange={(e) => setNewDivisionName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddDivisionModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDivision}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                >
                  {isSavingDivision ? 'Saving...' : 'Add Division'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
