'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import GophishCampaignSection from '@/components/admin/GophishCampaignSection';
import EmployeeRosterSection from '@/components/admin/EmployeeRosterSection';
import MockWebmailSection from '@/components/admin/MockWebmailSection';
import LeaderboardSection from '@/components/admin/LeaderboardSection';
import AIIntelligenceSection from '@/components/admin/AIIntelligenceSection';
import { usePolling } from '@/hooks/usePolling';
import type { GoPhishCampaign, GoPhishResource, MockEmail, LeaderboardResponse } from '@/components/admin/types';
import { X, Plus, Play, Mail, Globe, Users, Building, ShieldCheck, Download, Trash2, Edit3, Send, Target } from 'lucide-react';

export default function PhishingAdminDashboard() {
  const [activeTab, setActiveTab] = useState('gophish');
  const [campaigns, setCampaigns] = useState<GoPhishCampaign[]>([]);
  const [resources, setResources] = useState<GoPhishResource | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);

  // Leaderboard filters
  const [divisiFilter, setDivisiFilter] = useState('ALL');
  const [badgeFilter, setBadgeFilter] = useState('ALL');

  // Polling
  const { data: emailsData } = usePolling<any>('/api/admin/emails', 2500);
  const emails: MockEmail[] = Array.isArray(emailsData) 
    ? emailsData 
    : (Array.isArray(emailsData?.emails) ? emailsData.emails : []);
  const { data: leaderboardData } = usePolling<LeaderboardResponse>('/api/admin/leaderboard', 3000);

  // ─── Modal States ──────────────────────────────────────────────────────────
  // 1. Launch Simulation Modal
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [launchName, setLaunchName] = useState('');
  const [launchTemplate, setLaunchTemplate] = useState('');
  const [launchProfile, setLaunchProfile] = useState('');
  const [launchPage, setLaunchPage] = useState('');
  const [launchUrl, setLaunchUrl] = useState('http://localhost:5000/redirect-handler');
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
  const [landingCaptureCreds, setLandingCaptureCreds] = useState(true);
  const [landingCapturePasswords, setLandingCapturePasswords] = useState(false);
  const [landingRedirectUrl, setLandingRedirectUrl] = useState('');
  const [importSiteUrl, setImportSiteUrl] = useState('');
  const [isImportingSite, setIsImportingSite] = useState(false);
  const [isSavingLanding, setIsSavingLanding] = useState(false);

  // 4. Add/Edit Employee Modal
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [empEmail, setEmpEmail] = useState('');
  const [empOldEmail, setEmpOldEmail] = useState('');
  const [empDivisi, setEmpDivisi] = useState('');
  const [empActive, setEmpActive] = useState(1);
  const [isSavingEmp, setIsSavingEmp] = useState(false);

  // 5. Add Division Modal
  const [isAddDivisionModalOpen, setIsAddDivisionModalOpen] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [isSavingDivision, setIsSavingDivision] = useState(false);

  // ─── Data Loaders ──────────────────────────────────────────────────────────
  const loadCampaigns = async () => {
    try {
      const res = await fetch('/api/admin/gophish/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(Array.isArray(data) ? data : data?.campaigns || []);
      }
    } catch (err) {
      console.error('Error loading campaigns:', err);
    }
  };

  const loadResources = async () => {
    try {
      const res = await fetch('/api/admin/gophish/resources');
      if (res.ok) {
        const data = await res.json();
        setResources(data);
        if (data.templates?.length && !launchTemplate) setLaunchTemplate(data.templates[0].id.toString());
        if (data.profiles?.length && !launchProfile) setLaunchProfile(data.profiles[0].id.toString());
        if (data.pages?.length && !launchPage) setLaunchPage(data.pages[0].id.toString());
      }
    } catch (err) {
      console.error('Error loading resources:', err);
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
    loadCampaigns();
    loadResources();
    loadEmployees();
    loadDivisions();
  }, []);

  // ─── Actions & Handlers ───────────────────────────────────────────────────
  const handleSyncUsers = async () => {
    try {
      const res = await fetch('/api/admin/gophish/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) alert(data.message || 'Roster karyawan berhasil disinkronkan ke GoPhish!');
      else alert(`Gagal menyinkronkan: ${data.error || 'Terjadi kesalahan'}`);
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('Yakin ingin menghapus kampanye ini?')) return;
    try {
      const res = await fetch(`/api/admin/gophish/campaigns/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCampaigns(c => c.filter(item => item.id !== id));
      } else {
        alert('Gagal menghapus kampanye.');
      }
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  const handleCompleteCampaign = async (id: number) => {
    await loadCampaigns();
  };

  // Launch Modal Submit
  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!launchName.trim()) {
      alert('Nama kampanye wajib diisi');
      return;
    }

    const templateVal = launchTemplate || (resources?.templates?.[0]?.id ? String(resources.templates[0].id) : '1');
    const profileVal = launchProfile || (resources?.profiles?.[0]?.id ? String(resources.profiles[0].id) : '1');
    const pageVal = launchPage || (resources?.pages?.[0]?.id ? String(resources.pages[0].id) : '1');

    setIsLaunching(true);
    try {
      const res = await fetch('/api/admin/gophish/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: launchName.trim(),
          template_id: !isNaN(Number(templateVal)) ? Number(templateVal) : templateVal,
          smtp_id: !isNaN(Number(profileVal)) ? Number(profileVal) : profileVal,
          page_id: !isNaN(Number(pageVal)) ? Number(pageVal) : pageVal,
          url: launchUrl || 'http://localhost:5000/redirect-handler',
          group_name: 'HFL_Target_Group',
          target_emails: selectedEmails.length > 0 ? selectedEmails : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Simulasi Phishing berhasil diluncurkan! Email telah dikirim ke Mock Webmail Inbox.');
        setIsLaunchModalOpen(false);
        setLaunchName('');
        await loadCampaigns();
      } else {
        alert(`Gagal meluncurkan: ${data.error || data.detail || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      alert(`Koneksi backend gagal: ${err.message}`);
    } finally {
      setIsLaunching(false);
    }
  };

  // Template Modal Handlers
  const handleOpenTemplateBuilder = (mode: 'new' | 'edit', type: 'template' | 'page', item?: any) => {
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
        setTemplateHtml('<p>Halo {{.FirstName}},</p><p>Mohon verifikasi kredensial Anda segera: <a href="{{.URL}}">Klik di sini</a></p>');
        setTemplateText('Halo {{.FirstName}},\nMohon verifikasi kredensial Anda: {{.URL}}');
      }
      setIsTemplateModalOpen(true);
    } else {
      setLandingModalMode(mode);
      if (mode === 'edit' && item) {
        setLandingId(item.id);
        setLandingName(item.name || '');
        setLandingHtml(item.html || '');
        setLandingCaptureCreds(Boolean(item.capture_credentials));
        setLandingCapturePasswords(Boolean(item.capture_passwords));
        setLandingRedirectUrl(item.redirect_url || '');
      } else {
        setLandingId(null);
        setLandingName('');
        setLandingHtml('<!DOCTYPE html><html><head><title>Login</title></head><body><h2>Sign In</h2><form method="POST"><input name="username" placeholder="Username"/><input type="password" name="password"/><button type="submit">Login</button></form></body></html>');
        setLandingCaptureCreds(true);
        setLandingCapturePasswords(false);
        setLandingRedirectUrl('');
      }
      setIsLandingModalOpen(true);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim() || !templateSubject.trim()) {
      alert('Nama template dan subject wajib diisi');
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
        alert(`Template email berhasil ${templateModalMode === 'edit' ? 'diperbarui' : 'dibuat'}!`);
        setIsTemplateModalOpen(false);
        await loadResources();
      } else {
        const data = await res.json();
        alert(`Gagal menyimpan template: ${data.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      alert(`Koneksi backend gagal: ${err.message}`);
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
        alert('Gagal menghapus template.');
      }
    } catch {
      alert('Gagal menghubungi backend.');
    }
  };

  // Landing Page Modal Handlers
  const handleImportSite = async () => {
    if (!importSiteUrl.trim()) {
      alert('Masukkan URL website yang ingin di-clone');
      return;
    }
    setIsImportingSite(true);
    try {
      const res = await fetch('/api/admin/gophish/import-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importSiteUrl }),
      });
      const data = await res.json();
      if (res.ok && data.html) {
        setLandingHtml(data.html);
        alert('Website berhasil di-clone ke editor!');
      } else {
        alert(`Gagal mengimpor website: ${data.error || 'Pastikan URL valid dan dapat diakses'}`);
      }
    } catch (err: any) {
      alert(`Koneksi gagal: ${err.message}`);
    } finally {
      setIsImportingSite(false);
    }
  };

  const handleSaveLandingPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landingName.trim() || !landingHtml.trim()) {
      alert('Nama landing page dan HTML content wajib diisi');
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
          capture_credentials: landingCaptureCreds,
          capture_passwords: landingCapturePasswords,
          redirect_url: landingRedirectUrl,
        }),
      });

      if (res.ok) {
        alert(`Landing page berhasil ${landingModalMode === 'edit' ? 'diperbarui' : 'dibuat'}!`);
        setIsLandingModalOpen(false);
        await loadResources();
      } else {
        const data = await res.json();
        alert(`Gagal menyimpan landing page: ${data.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      alert(`Koneksi backend gagal: ${err.message}`);
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
        alert('Gagal menghapus landing page.');
      }
    } catch {
      alert('Gagal menghubungi backend.');
    }
  };

  // Employee CRUD Handlers
  const handleOpenAddEmployee = () => {
    setEmpEmail('');
    setEmpDivisi(divisions[0]?.name || 'IT');
    setEmpActive(1);
    setIsAddEmployeeModalOpen(true);
  };

  const handleOpenEditEmployee = (emp: any) => {
    setEmpOldEmail(emp.email);
    setEmpEmail(emp.email);
    setEmpDivisi(emp.divisi || 'IT');
    setEmpActive(emp.is_active ?? 1);
    setIsEditEmployeeModalOpen(true);
  };

  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empEmail.trim()) {
      alert('Email wajib diisi');
      return;
    }

    setIsSavingEmp(true);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: empEmail.trim(),
          divisi: empDivisi.trim(),
          is_active: empActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Karyawan berhasil ditambahkan!');
        setIsAddEmployeeModalOpen(false);
        await loadEmployees();
      } else {
        alert(`Gagal menambah karyawan: ${data.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      alert(`Koneksi gagal: ${err.message}`);
    } finally {
      setIsSavingEmp(false);
    }
  };

  const handleEditEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empEmail.trim()) {
      alert('Email wajib diisi');
      return;
    }

    setIsSavingEmp(true);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_email: empOldEmail,
          email: empEmail.trim(),
          divisi: empDivisi.trim(),
          is_active: empActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Data karyawan berhasil diperbarui!');
        setIsEditEmployeeModalOpen(false);
        await loadEmployees();
      } else {
        alert(`Gagal memperbarui karyawan: ${data.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      alert(`Koneksi gagal: ${err.message}`);
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
      alert('Nama divisi wajib diisi');
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
        alert('Divisi baru berhasil ditambahkan!');
        setIsAddDivisionModalOpen(false);
        await loadDivisions();
      } else {
        alert(`Gagal menambah divisi: ${data.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      alert(`Koneksi gagal: ${err.message}`);
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
            setIsLaunchModalOpen(true);
            loadResources();
          }}
          onDeleteCampaign={handleDeleteCampaign}
          onCompleteCampaign={handleCompleteCampaign}
          onOpenTemplateBuilder={handleOpenTemplateBuilder}
          onDeleteTemplate={handleDeleteTemplate}
          onDeletePage={handleDeletePage}
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

      {activeTab === 'webmail' && (
        <MockWebmailSection
          readOnly={false}
          emails={Array.isArray(emails) ? emails : []}
          selectedEmail={selectedEmail}
          onSelectEmail={setSelectedEmail}
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
        <div className="dialog-overlay">
          <div className="dialog-box fade-up font-body" style={{ maxWidth: '520px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Play size={18} style={{ color: 'var(--accent)' }} /> Launch Phishing Simulation
              </h3>
              <button onClick={() => setIsLaunchModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLaunchCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Campaign Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Urgent Security Verification"
                  value={launchName}
                  onChange={(e) => setLaunchName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Email Pretext Template *
                </label>
                <select
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
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Sending Profile (SMTP) *
                </label>
                <select
                  value={launchProfile}
                  onChange={(e) => setLaunchProfile(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                >
                  {(resources?.profiles || []).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Landing Page Portal *
                </label>
                <select
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
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Simulation Target URL (Payload Endpoint) *
                </label>
                <input
                  type="text"
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
                  {isLaunching ? 'Launching...' : <><Send size={14} /> Launch Now</>}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                Clone External Site (Auto-Import HTML)
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="https://login.microsoftonline.com"
                  value={importSiteUrl}
                  onChange={(e) => setImportSiteUrl(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={handleImportSite}
                  disabled={isImportingSite}
                  style={{ padding: '8px 14px', background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={13} /> {isImportingSite ? 'Cloning...' : 'Clone Site'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveLandingPage} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Page Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Microsoft 365 Login Portal"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={landingCaptureCreds}
                    onChange={(e) => setLandingCaptureCreds(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  Capture Submitted Data / Form Post
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={landingCapturePasswords}
                    onChange={(e) => setLandingCapturePasswords(e.target.checked)}
                    style={{ accentColor: 'var(--danger)' }}
                  />
                  Capture Passwords (Hash)
                </label>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Redirect URL (After Submission)
                </label>
                <input
                  type="text"
                  placeholder="https://company.portal/login-success"
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
                <Users size={18} style={{ color: 'var(--accent)' }} /> Add Employee
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
                  {isSavingEmp ? 'Saving...' : 'Add Employee'}
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
