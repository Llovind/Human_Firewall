'use client';

import { useAuth } from '@/context/AuthContext';
import { usePolling } from '@/hooks/usePolling';
import Logo from '@/components/Logo';
import SidebarNav from '@/components/SidebarNav';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Shield, AlertTriangle, Activity, CheckCircle2, TrendingUp, Trophy, FileWarning, Search, Bot, Server, Play, StopCircle, RefreshCw, Plus, Trash2, Mail, Users, Settings, Fish, Scale, Inbox, Sliders, Pencil, Globe, X, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import '../dashboard.css';

/* ── Types matching API responses ─────────────────────────── */
interface Incident {
  id: string; timestamp: string; type: string; severity: string;
  source: string; target: string; description: string; status: string;
}
interface ThreatCacheEntry {
  id: string; url: string; threatType: string; score: number;
  source: string; action: string; detectedAt: string;
}
interface AISummary {
  id: string; timestamp: string; title: string; summary: string;
  threatLevel: string; recommendations: string[];
}
interface BehaviorScore {
  userId: string; userName: string; email: string; division: string;
  score: number; risk: string; reason: string; streak: number;
  rank: number; totalPoints: number; trainingCompleted: number; badges: string[];
}
interface PolicyDecision {
  id: string; timestamp: string; threatScore: number; behaviorScore: number;
  finalAction: string; reason: string; url?: string;
}
interface Stats {
  totalIncidents: number; openIncidents: number; criticalIncidents: number;
  blockedUrls: number; totalEmployees: number; avgBehaviorScore: number;
}
interface GoPhishCampaign {
  id: number;
  name: string;
  status: string;
  created_date: string;
  stats: {
    sent: number;
    opened: number;
    clicked: number;
    submitted_data: number;
  };
}
interface MockEmail {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  created_at: string;
}
interface GoPhishResource {
  templates: { id: number; name: string; subject?: string; html?: string; text?: string }[];
  profiles: { id: number; name: string }[];
  pages: { id: number; name: string; html?: string; capture_credentials?: boolean; capture_passwords?: boolean; redirect_url?: string }[];
}
interface ComplianceSummary {
  compliance_pct: number;
  estimated_savings_idr: number;
  divisi_risk_map: { divisi: string; risk_level: string; avg_points: number }[];
}
interface AdminLoginEvent {
  id: number;
  email: string;
  division: string;
  login_time: string;
  device: string;
  location: string;
  network: string;
  vpn: boolean;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
}
interface DivisionLeaderboard {
  divisi: string;
  avg_points: number;
  member_count: number;
}
interface IndividualLeaderboard {
  rank: number;
  email: string;
  divisi: string;
  points: number;
  badge: string;
  click_count: number;
}
interface LeaderboardResponse {
  individual: IndividualLeaderboard[];
  by_divisi: DivisionLeaderboard[];
}


/* ── Helper: Time ago ─────────────────────────────────────── */
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

/* ── Severity / Action Icons ──────────────────────────────── */
const severityIcon: Record<string, React.ReactNode> = {
  critical: <AlertTriangle size={16} style={{ color: 'var(--danger)', marginRight: '4px' }} />,
  high: <AlertTriangle size={16} style={{ color: 'var(--warning)', marginRight: '4px' }} />,
  medium: <AlertTriangle size={16} style={{ color: 'var(--info)', marginRight: '4px' }} />,
  low: <CheckCircle2 size={16} style={{ color: 'var(--success)', marginRight: '4px' }} />,
};
const actionIcon: Record<string, React.ReactNode> = {
  block: <StopCircle size={16} style={{ color: 'var(--danger)', marginRight: '4px' }} />,
  warning: <FileWarning size={16} style={{ color: 'var(--warning)', marginRight: '4px' }} />,
  allow: <CheckCircle2 size={16} style={{ color: 'var(--success)', marginRight: '4px' }} />,
  notify_soc: <Activity size={16} style={{ color: 'var(--info)', marginRight: '4px' }} />,
};
const typeIcon: Record<string, React.ReactNode> = {
  phishing_click: <Fish size={16} style={{ marginRight: '4px' }} />,
  phishing_report: <Shield size={16} style={{ marginRight: '4px' }} />,
  malware_detected: <Bot size={16} style={{ marginRight: '4px' }} />,
  suspicious_url: <Search size={16} style={{ marginRight: '4px' }} />,
  dlp_violation: <FileWarning size={16} style={{ marginRight: '4px' }} />,
};

export default function SOCAdminDashboard() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [clock, setClock] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'threats' | 'leaderboard' | 'policy' | 'gophish' | 'webmail' | 'employees'>('overview');

  // ── Polling basic data sources ───
  const { data: incidentData, hasUpdated: incidentUpdated } = usePolling<{ incidents: Incident[]; stats: Stats }>('/api/incident', 3000);
  const { data: cacheData, hasUpdated: cacheUpdated } = usePolling<{ cache: ThreatCacheEntry[] }>('/api/cache', 3000);
  const { data: summaryData, hasUpdated: summaryUpdated } = usePolling<{ summaries: AISummary[] }>('/api/summary', 3000);
  const { data: behaviorData, hasUpdated: behaviorUpdated } = usePolling<{ scores: BehaviorScore[] }>('/api/behavior', 3000);
  const { data: policyData, hasUpdated: policyUpdated } = usePolling<{ decisions: PolicyDecision[] }>('/api/policy', 3000);
  const { data: complianceData, hasUpdated: complianceUpdated } = usePolling<ComplianceSummary>('/api/admin/compliance-summary', 3000);
  const { data: leaderboardData, hasUpdated: leaderboardUpdated } = usePolling<LeaderboardResponse>('/api/admin/leaderboard', 3000);

  // ── GoPhish Data & Webmail Data ───
  const [campaigns, setCampaigns] = useState<GoPhishCampaign[]>([]);
  const [loginHistory, setLoginHistory] = useState<AdminLoginEvent[]>([]);
  const [emails, setEmails] = useState<MockEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [selectedCampaignDetail, setSelectedCampaignDetail] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [resources, setResources] = useState<GoPhishResource | null>(null);
  const [incidentPage, setIncidentPage] = useState(1);

  // ── Employees & Divisions State ───
  const [employees, setEmployees] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [empModalMode, setEmpModalMode] = useState<'add' | 'edit'>('add');
  const [empModalEmail, setEmpModalEmail] = useState('');
  const [empModalOldEmail, setEmpModalOldEmail] = useState('');
  const [empModalDivision, setEmpModalDivision] = useState('');
  const [empModalNewDivision, setEmpModalNewDivision] = useState('');
  const [empModalIsActive, setEmpModalIsActive] = useState(true);
  const [isCreatingNewDiv, setIsCreatingNewDiv] = useState(false);

  // Division Tab quick create
  const [isDivModalOpen, setIsDivModalOpen] = useState(false);
  const [divModalName, setDivModalName] = useState('');

  // Selected Target Employees for Campaign Orchestration
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [gpEmployeeFilter, setGpEmployeeFilter] = useState('ALL');
  const [employeeSearchText, setEmployeeSearchText] = useState('');
  const [employeeDivisionFilter, setEmployeeDivisionFilter] = useState('ALL');

  // ── Client-side Filters State ───
  const [threatTypeFilter, setThreatTypeFilter] = useState<string>('ALL');
  const [threatActionFilter, setThreatActionFilter] = useState<string>('ALL');
  const [leaderboardDivisiFilter, setLeaderboardDivisiFilter] = useState<string>('ALL');
  const [leaderboardBadgeFilter, setLeaderboardBadgeFilter] = useState<string>('ALL');
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [divisionPage, setDivisionPage] = useState(1);

  // GoPhish Launch Form fields
  const [launchName, setLaunchName] = useState('');
  const [launchTemplate, setLaunchTemplate] = useState('');
  const [launchProfile, setLaunchProfile] = useState('');
  const [launchPage, setLaunchPage] = useState('');
  const [launchUrl, setLaunchUrl] = useState('http://localhost:8080');
  const [isLaunching, setIsLaunching] = useState(false);

  // ── Template & Landing Page Builder (bikin phishing pretext sendiri,
  //    tanpa perlu buka GoPhish UI langsung) ───
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<'template' | 'page'>('template');
  const [builderEditId, setBuilderEditId] = useState<number | null>(null); // null = bikin baru
  const [builderName, setBuilderName] = useState('');
  const [builderSubject, setBuilderSubject] = useState(''); // khusus template
  const [builderHtml, setBuilderHtml] = useState('');
  const [builderCaptureCredentials, setBuilderCaptureCredentials] = useState(true); // khusus page
  const [builderCapturePasswords, setBuilderCapturePasswords] = useState(true); // khusus page
  const [builderRedirectUrl, setBuilderRedirectUrl] = useState(''); // khusus page
  const [builderCloneUrl, setBuilderCloneUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [isSavingBuilder, setIsSavingBuilder] = useState(false);
  const [builderError, setBuilderError] = useState('');

  // ── Load Helpers for Employees & Divisions ───
  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/admin/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
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
        setDivisions(data.divisions || []);
      }
    } catch (err) {
      console.error('Error loading divisions:', err);
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empModalEmail) {
      alert('Email wajib diisi');
      return;
    }
    const divisionToSave = isCreatingNewDiv ? empModalNewDivision : empModalDivision;
    if (!divisionToSave) {
      alert('Divisi wajib ditentukan');
      return;
    }

    const payload = {
      email: empModalEmail,
      divisi: divisionToSave,
      is_active: empModalIsActive ? 1 : 0,
      old_email: empModalOldEmail
    };

    try {
      const url = '/api/admin/employees';
      const method = empModalMode === 'add' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsEmpModalOpen(false);
        setEmpModalEmail('');
        setEmpModalDivision('');
        setEmpModalNewDivision('');
        setIsCreatingNewDiv(false);
        loadEmployees();
        loadDivisions();
      } else {
        const data = await res.json();
        alert(`Gagal menyimpan: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Gagal menghubungi backend.');
    }
  };

  const handleCreateDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divModalName) {
      alert('Nama divisi wajib diisi');
      return;
    }
    try {
      const res = await fetch('/api/admin/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: divModalName })
      });
      if (res.ok) {
        setIsDivModalOpen(false);
        setDivModalName('');
        loadDivisions();
      } else {
        const data = await res.json();
        alert(`Gagal membuat divisi: ${data.error}`);
      }
    } catch {
      alert('Gagal menghubungi backend.');
    }
  };

  const handleOpenAddEmp = () => {
    setEmpModalMode('add');
    setEmpModalEmail('');
    setEmpModalOldEmail('');
    setEmpModalDivision(divisions.length > 0 ? divisions[0].name : '');
    setEmpModalNewDivision('');
    setEmpModalIsActive(true);
    setIsCreatingNewDiv(false);
    setIsEmpModalOpen(true);
  };

  const handleOpenEditEmp = (emp: any) => {
    setEmpModalMode('edit');
    setEmpModalEmail(emp.email);
    setEmpModalOldEmail(emp.email);
    setEmpModalDivision(emp.divisi);
    setEmpModalNewDivision('');
    setEmpModalIsActive(emp.is_active === 1);
    setIsCreatingNewDiv(false);
    setIsEmpModalOpen(true);
  };

  // ── Clock ───
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Fetch GoPhish & Webmail ───
  const loadGoPhishCampaigns = async () => {
    try {
      const res = await fetch('/api/admin/gophish/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error('Error loading campaigns:', err);
    }
  };

  const handleDeleteCampaign = async (campaignId: number, campaignName: string) => {
    if (!confirm(`Hapus kampanye "${campaignName}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/admin/gophish/campaigns/${campaignId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      } else {
        alert(`Gagal menghapus: ${data.error}`);
      }
    } catch {
      alert('Koneksi gagal.');
    }
  };

  const handleViewCampaignDetail = async (campaignId: number) => {
    try {
      const res = await fetch(`/api/admin/gophish/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCampaignDetail(data);
        setIsDetailModalOpen(true);
      } else {
        alert('Gagal memuat detail kampanye.');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memuat detail kampanye.');
    }
  };

  const loadEmails = async () => {
    try {
      const res = await fetch('/api/admin/emails');
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (err) {
      console.error('Error loading emails:', err);
    }
  };

  const loadLoginHistory = async () => {
    try {
      const res = await fetch('/api/admin/login-history');
      if (res.ok) {
        const data = await res.json();
        setLoginHistory(data.history || []);
      }
    } catch (err) {
      console.error('Error loading login history:', err);
    }
  };

  const loadGoPhishResources = async () => {
    try {
      const res = await fetch('/api/admin/gophish/resources');
      if (res.ok) {
        const data = await res.json();
        setResources(data);
        if (data.templates?.length) setLaunchTemplate(data.templates[0].id.toString());
        if (data.profiles?.length) setLaunchProfile(data.profiles[0].id.toString());
        if (data.pages?.length) setLaunchPage(data.pages[0].id.toString());
      }
    } catch (err) {
      console.error('Error loading resources:', err);
    }
  };

  // Sync campaigns when focused on GoPhish, Webmail, Threats, or Employees
  useEffect(() => {
    if (activeTab === 'employees') {
      loadEmployees();
      loadDivisions();
    } else if (activeTab === 'gophish') {
      loadEmployees();
      loadDivisions();
      loadGoPhishCampaigns();
      loadGoPhishResources();
    } else if (activeTab === 'webmail') {
      loadEmails();
    } else if (activeTab === 'threats') {
      loadLoginHistory();
    }
  }, [activeTab]);

  // Periodic polling for GoPhish, Webmail, Threats, and Employees when active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'gophish') {
      interval = setInterval(() => {
        loadGoPhishCampaigns();
        loadGoPhishResources();
      }, 10000);
    } else if (activeTab === 'webmail') {
      interval = setInterval(loadEmails, 10000);
    } else if (activeTab === 'threats') {
      interval = setInterval(loadLoginHistory, 10000);
    } else if (activeTab === 'employees') {
      interval = setInterval(() => {
        loadEmployees();
        loadDivisions();
      }, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab]);

  const handleSyncUsers = async () => {
    if (selectedEmails.length === 0) {
      if (!confirm("Tidak ada karyawan terpilih. Sinkronisasi SEMUA karyawan aktif ke GoPhish group 'HFL_Target_Group'?")) return;
      try {
        // Auto-collect all active employee emails when none are manually selected
        const allActiveEmails = employees.filter((e: any) => e.is_active === 1 || e.is_active === true).map((e: any) => e.email);
        if (allActiveEmails.length === 0) {
          alert('Tidak ada karyawan aktif ditemukan.');
          return;
        }
        const res = await fetch('/api/admin/gophish/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails: allActiveEmails })
        });
        const data = await res.json();
        if (res.ok) {
          alert(`Sukses! ${allActiveEmails.length} karyawan aktif disinkronisasi.`);
        } else {
          alert(`Gagal: ${data.error}`);
        }
      } catch {
        alert("Koneksi gagal.");
      }
      return;
    }

    if (!confirm(`Sinkronisasi ${selectedEmails.length} karyawan terpilih ke GoPhish group 'HFL_Target_Group'?`)) return;
    try {
      const res = await fetch('/api/admin/gophish/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: selectedEmails })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Sukses! ${data.message || 'Target terpilih disinkronisasi.'}`);
      } else {
        alert(`Gagal: ${data.error}`);
      }
    } catch {
      alert("Koneksi gagal.");
    }
  };

  const handleOpenLaunchModal = () => {
    if (selectedEmails.length === 0) {
      alert('Silakan pilih minimal 1 target karyawan di daftar target sebelum meluncurkan simulasi.');
      return;
    }
    setIsLaunchModalOpen(true);
    loadGoPhishResources();
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!launchName || !launchTemplate || !launchProfile || !launchPage || !launchUrl) {
      alert('Semua field wajib diisi');
      return;
    }

    if (selectedEmails.length === 0) {
      alert('Silakan pilih minimal 1 target karyawan.');
      return;
    }

    setIsLaunching(true);
    try {
      // 1. Sync selected targets first
      const syncRes = await fetch('/api/admin/gophish/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: selectedEmails })
      });
      if (!syncRes.ok) {
        const syncData = await syncRes.json();
        throw new Error(syncData.error || 'Gagal sinkronisasi target ke GoPhish.');
      }

      // 2. Launch campaign
      const res = await fetch('/api/admin/gophish/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: launchName,
          template_id: parseInt(launchTemplate),
          smtp_id: parseInt(launchProfile),
          page_id: parseInt(launchPage),
          url: launchUrl,
          group_name: 'HFL_Target_Group',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Kampanye "${launchName}" berhasil diluncurkan ke ${selectedEmails.length} target!`);
        setIsLaunchModalOpen(false);
        setLaunchName('');
        loadGoPhishCampaigns();
      } else {
        alert(`Gagal meluncurkan: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message || 'Gagal menghubungi backend.'}`);
    } finally {
      setIsLaunching(false);
    }
  };

  // ── Template & Landing Page Builder handlers ───

  const resetBuilderForm = () => {
    setBuilderEditId(null);
    setBuilderName('');
    setBuilderSubject('');
    setBuilderHtml('');
    setBuilderCaptureCredentials(true);
    setBuilderCapturePasswords(true);
    setBuilderRedirectUrl('');
    setBuilderCloneUrl('');
    setBuilderError('');
  };

  const openTemplateBuilder = (existing?: { id: number; name: string; subject?: string; html?: string }) => {
    resetBuilderForm();
    setBuilderMode('template');
    if (existing) {
      setBuilderEditId(existing.id);
      setBuilderName(existing.name);
      setBuilderSubject(existing.subject || '');
      setBuilderHtml(existing.html || '');
    }
    setIsBuilderOpen(true);
  };

  const openPageBuilder = (existing?: { id: number; name: string; html?: string; capture_credentials?: boolean; capture_passwords?: boolean; redirect_url?: string }) => {
    resetBuilderForm();
    setBuilderMode('page');
    if (existing) {
      setBuilderEditId(existing.id);
      setBuilderName(existing.name);
      setBuilderHtml(existing.html || '');
      setBuilderCaptureCredentials(existing.capture_credentials ?? true);
      setBuilderCapturePasswords(existing.capture_passwords ?? true);
      setBuilderRedirectUrl(existing.redirect_url || '');
    }
    setIsBuilderOpen(true);
  };

  const handleCloneSite = async () => {
    if (!builderCloneUrl.trim()) {
      setBuilderError('Isi URL situs yang mau di-clone dulu.');
      return;
    }
    setIsCloning(true);
    setBuilderError('');
    try {
      const res = await fetch('/api/admin/gophish/import-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: builderCloneUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal clone situs. Pastikan URL bisa diakses dari server.');
      }
      setBuilderHtml(data.html || '');
    } catch (err: any) {
      setBuilderError(err.message || 'Gagal clone situs.');
    } finally {
      setIsCloning(false);
    }
  };

  const handleSaveBuilder = async () => {
    if (!builderName.trim() || !builderHtml.trim()) {
      setBuilderError('Nama dan konten HTML wajib diisi.');
      return;
    }
    if (builderMode === 'template' && !builderSubject.trim()) {
      setBuilderError('Subject email wajib diisi.');
      return;
    }

    setIsSavingBuilder(true);
    setBuilderError('');
    try {
      const isEdit = builderEditId !== null;
      const basePath = builderMode === 'template' ? '/api/admin/gophish/templates' : '/api/admin/gophish/pages';
      const url = isEdit ? `${basePath}/${builderEditId}` : basePath;
      const method = isEdit ? 'PUT' : 'POST';

      const body = builderMode === 'template'
        ? { name: builderName, subject: builderSubject, html: builderHtml }
        : {
            name: builderName,
            html: builderHtml,
            capture_credentials: builderCaptureCredentials,
            capture_passwords: builderCapturePasswords,
            redirect_url: builderRedirectUrl,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan.');
      }

      setIsBuilderOpen(false);
      resetBuilderForm();
      loadGoPhishResources(); // refresh dropdown & daftar di Launch dialog
    } catch (err: any) {
      setBuilderError(err.message || 'Gagal menyimpan.');
    } finally {
      setIsSavingBuilder(false);
    }
  };

  const handleDeleteTemplate = async (id: number, name: string) => {
    if (!confirm(`Hapus template "${name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/admin/gophish/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus template.');
      loadGoPhishResources();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeletePage = async (id: number, name: string) => {
    if (!confirm(`Hapus landing page "${name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/admin/gophish/pages/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus landing page.');
      loadGoPhishResources();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleResolveIncident = async (id: string) => {
    try {
      const res = await fetch('/api/incident', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'closed' })
      });
      if (res.ok) {
        setSelectedIncident(null);
      } else {
        const errData = await res.json().catch(() => null);
        alert(`Gagal mengupdate status insiden: ${errData?.error || res.statusText}`);
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi');
    }
  };

  // ── Redirect if not authenticated or not admin ───
  if (authLoading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Logo size={52} variant="mark" logoAnimation="loading" />
        <p>Memuat Command Center...</p>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    return null;
  }

  const stats = incidentData?.stats;
  const allIncidents = incidentData?.incidents || [];
  // Filter out closed/resolved incidents so they disappear from the dashboard
  const incidents = allIncidents.filter((inc: Incident) => inc.status !== 'closed');
  
  // Pagination logic for incidents
  const INCIDENTS_PER_PAGE = 8;
  const incidentTotalPages = Math.max(1, Math.ceil(incidents.length / INCIDENTS_PER_PAGE));
  const paginatedIncidents = incidents.slice((incidentPage - 1) * INCIDENTS_PER_PAGE, incidentPage * INCIDENTS_PER_PAGE);

  const cache = cacheData?.cache || [];
  const summaries = summaryData?.summaries || [];
  const scores = behaviorData?.scores || [];
  const decisions = policyData?.decisions || [];

  const threatChartData = Object.values(
    cache.reduce((acc: any, item: ThreatCacheEntry) => {
      const date = new Date(item.detectedAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
      acc[date] = acc[date] || { date, deteksi: 0 };
      acc[date].deteksi += 1;
      return acc;
    }, {})
  ).reverse();

  const divScores = scores.reduce((acc: any, user: BehaviorScore) => {
    if (!acc[user.division]) acc[user.division] = { total: 0, count: 0 };
    acc[user.division].total += user.score;
    acc[user.division].count += 1;
    return acc;
  }, {});
  const topDivisions = Object.entries(divScores)
    .map(([div, data]: [string, any]) => ({ div, avg: Math.round(data.total / data.count) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);

  const divisionChartData = Object.entries(divScores).map(([name, data]: [string, any]) => ({
    name,
    score: Math.min(100, Math.round(data.total / data.count))
  })).sort((a, b) => b.score - a.score);

  const severityCounts = incidents.reduce((acc: any, inc: Incident) => {
    const sev = inc.severity.toLowerCase();
    if (sev === 'critical') acc['Critical'] = (acc['Critical'] || 0) + 1;
    else if (sev === 'high') acc['High'] = (acc['High'] || 0) + 1;
    else if (sev === 'medium') acc['Medium'] = (acc['Medium'] || 0) + 1;
    else if (sev === 'low') acc['Low'] = (acc['Low'] || 0) + 1;
    return acc;
  }, { 'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0 });

  const severityChartData = Object.entries(severityCounts)
    .map(([name, value]) => ({ name, value: value as number }));

  const totalSeverityCount = severityChartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="app-shell">
      <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="app-shell-main">
        {/* ── Topbar ─────────────────────────────────────────── */}
        <header className="topbar-slim" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 600 }}>Security Culture & Threat Triage Platform</h1>
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="live-indicator">
              <span className="live-dot" />
              <span>Live</span>
            </div>
            <span className="clock mono">{clock}</span>
            <div className="user-badge" onClick={logout} title="Klik untuk logout" style={{ border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)', cursor: 'pointer', padding: '4px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="user-name" style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: 600 }}>Logout</span>
            </div>
          </div>
        </header>

        {/* ── Main Content ──────────────────────────────────── */}
        <main className="main" style={{ padding: 0 }}>
        {/* ── OVERVIEW TAB ───────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Row */}
            <div className="stats-grid fade-up">
              <div className={`stat-card glass-card ${incidentUpdated ? 'value-flash' : ''}`}>
                <div className="stat-icon stat-icon-danger"><AlertTriangle size={26} /></div>
                <div className="stat-value">{stats?.totalIncidents ?? '—'}</div>
                <div className="stat-label">Total Insiden</div>
              </div>
              <div className={`stat-card glass-card ${incidentUpdated ? 'value-flash' : ''}`}>
                <div className="stat-icon stat-icon-warning"><Activity size={26} /></div>
                <div className="stat-value">{stats?.openIncidents ?? '—'}</div>
                <div className="stat-label">Insiden Terbuka</div>
              </div>
              <div className={`stat-card glass-card ${cacheUpdated ? 'value-flash' : ''}`}>
                <div className="stat-icon stat-icon-accent"><Shield size={26} /></div>
                <div className="stat-value">{stats?.blockedUrls ?? '—'}</div>
                <div className="stat-label">URL Diblokir</div>
              </div>
              <div className={`stat-card glass-card ${behaviorUpdated ? 'value-flash' : ''}`}>
                <div className="stat-icon stat-icon-success"><TrendingUp size={26} /></div>
                <div className="stat-value">{stats?.avgBehaviorScore ?? '—'}</div>
                <div className="stat-label">Avg. Behavior Score</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="charts-grid fade-up">
              {/* Human Risk Score per Divisi Bar Chart */}
              <div className="chart-card glass-card">
                <div className="chart-header">
                  <h3 className="chart-title">Human Risk Score per Divisi</h3>
                  <span className="chart-badge">Skor 0-100</span>
                </div>
                <div className="chart-container bar-chart">
                  {divisionChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={divisionChartData}
                        margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(111, 217, 168, 0.05)" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} stroke="var(--text-secondary)" fontSize={11} />
                        <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={12} width={120} />
                        <Tooltip
                          cursor={false}
                          contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                        />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={true} animationDuration={250} animationEasing="ease-out">
                          {divisionChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.score >= 80 ? 'var(--success)' : entry.score >= 50 ? 'var(--warning)' : 'var(--danger)'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-empty-state">Belum ada data aktivitas divisi</div>
                  )}
                </div>
              </div>

              {/* Distribusi Severity Insiden Doughnut Chart */}
              <div className="chart-card glass-card">
                <div className="chart-header">
                  <h3 className="chart-title">Distribusi Severity Insiden</h3>
                  <span className="chart-badge">{incidents.length} tiket</span>
                </div>
                <div className="chart-container doughnut-chart">
                  {totalSeverityCount > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius="65%"
                          outerRadius="85%"
                          paddingAngle={3}
                          dataKey="value"
                          isAnimationActive={true}
                          animationDuration={250}
                          animationEasing="ease-out"
                        >
                          {severityChartData.map((entry, index) => {
                            let color = 'var(--success)';
                            if (entry.name === 'Critical') color = 'var(--danger)';
                            else if (entry.name === 'High') color = 'var(--warning)';
                            else if (entry.name === 'Medium') color = 'var(--info)';
                            return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                          itemStyle={{ color: 'var(--text-primary)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="chart-empty-state">Belum ada insiden tercatat</div>
                  )}
                </div>
              </div>
            </div>

            {/* Bento Grid Row 2: AI Threat Summary & Recent Incidents */}
            <div className="admin-overview-grid">
              {/* AI Summary Panel */}
              <div className={`panel glass-card fade-up-1 ${summaryUpdated ? 'value-flash' : ''}`} style={{ marginBottom: 0 }}>
                <div className="panel-header">
                  <h2 className="panel-title"><Bot size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> AI Threat Summary</h2>
                  <span className="panel-badge">Powered by LLM</span>
                </div>
                <div className="summary-list">
                  {summaries.length > 0 ? (
                    summaries.slice(0, 3).map(s => (
                      <div key={s.id} className="summary-item">
                        <div className="summary-meta">
                          <span className={`badge badge-${s.threatLevel}`}>
                            {severityIcon[s.threatLevel]} {s.threatLevel.toUpperCase()}
                          </span>
                          <span className="summary-time">{timeAgo(s.timestamp)}</span>
                        </div>
                        <h3 className="summary-title">{s.title}</h3>
                        <p className="summary-text">{s.summary}</p>
                        {s.recommendations.length > 0 && (
                          <div className="summary-recs">
                            <span className="rec-label">Rekomendasi:</span>
                            <ul>
                              {s.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Menunggu telemetri ancaman untuk analisis LLM...
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Incidents */}
              <div className={`panel glass-card fade-up-2 ${incidentUpdated ? 'value-flash' : ''}`} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                <div className="panel-header">
                  <h2 className="panel-title"><AlertTriangle size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Insiden Terbaru</h2>
                  <span className="panel-count">{incidents.length} total</span>
                </div>
                <div className="incident-list" style={{ flex: 1 }}>
                  {incidents.length > 0 ? (
                    paginatedIncidents.map(inc => (
                      <div key={inc.id} className="incident-row" onClick={() => setSelectedIncident(inc)} style={{ cursor: 'pointer' }}>
                        <div className="incident-icon">{typeIcon[inc.type] || <FileWarning size={16} />}</div>
                        <div className="incident-info">
                          <div className="incident-title">{inc.description}</div>
                          <div className="incident-meta">
                            <span className="mono">{inc.id}</span>
                            <span>·</span>
                            <span>{inc.source}</span>
                            <span>·</span>
                            <span>{timeAgo(inc.timestamp)}</span>
                          </div>
                        </div>
                        <span className={`badge badge-${inc.severity}`}>
                          {severityIcon[inc.severity]} {inc.severity}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Belum ada insiden tercatat.
                    </div>
                  )}
                </div>
                {/* Pagination Controls */}
                {incidents.length > INCIDENTS_PER_PAGE && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    <button 
                      onClick={() => setIncidentPage(p => Math.max(1, p - 1))}
                      disabled={incidentPage === 1}
                      style={{ background: 'none', border: 'none', color: incidentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: incidentPage === 1 ? 'default' : 'pointer', fontWeight: 600, padding: '4px 8px' }}
                    >
                      &laquo; Prev
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Page {incidentPage} of {incidentTotalPages}
                    </span>
                    <button 
                      onClick={() => setIncidentPage(p => Math.min(incidentTotalPages, p + 1))}
                      disabled={incidentPage === incidentTotalPages}
                      style={{ background: 'none', border: 'none', color: incidentPage === incidentTotalPages ? 'var(--text-muted)' : 'var(--text-primary)', cursor: incidentPage === incidentTotalPages ? 'default' : 'pointer', fontWeight: 600, padding: '4px 8px' }}
                    >
                      Next &raquo;
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bento Grid Row 3: Divisional Risk Map & Compliance metrics */}
            <div className="admin-overview-grid" style={{ marginTop: '24px', marginBottom: '48px' }}>
              {/* Divisional Risk Map */}
              <div className="panel glass-card fade-up-3" style={{ padding: '20px', marginBottom: 0 }}>
                <div className="panel-header" style={{ marginBottom: '12px', paddingBottom: '8px' }}>
                  <h2 className="panel-title" style={{ fontSize: '14px' }}><Activity size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Divisional Risk Map</h2>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 0' }}>Divisi</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(complianceData?.divisi_risk_map || [
                      { divisi: 'Sales Support', risk_level: 'High', avg_points: 35 },
                      { divisi: 'Performance & Shared Service', risk_level: 'High', avg_points: 50 },
                      { divisi: 'Network Operations', risk_level: 'High', avg_points: 68 },
                      { divisi: 'Network Engineering', risk_level: 'Medium', avg_points: 80 },
                      { divisi: 'IT', risk_level: 'Medium', avg_points: 105 }
                    ]).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < 4 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '10px 0', fontWeight: 500 }}>{row.divisi}</td>
                        <td>
                          <span className={`badge badge-${row.risk_level === 'High' || row.risk_level === 'critical' ? 'critical' : row.risk_level === 'Medium' || row.risk_level === 'warning' ? 'warning' : 'low'}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                            ● {row.risk_level}
                          </span>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{row.avg_points} / 100</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Compliance Summary Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* ISO 27001 Readiness */}
                <div className="stat-card glass-card fade-up-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', height: '100%' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px' }}>ISO 27001 Readiness</h3>
                  <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                    <svg width="100" height="100" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(245, 158, 11, 0.05)" strokeWidth="8" />
                      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--accent)" strokeWidth="8" 
                              strokeDasharray={`${2 * Math.PI * 50}`}
                              strokeDashoffset={`${2 * Math.PI * 50 * (1 - (complianceData?.compliance_pct || 36) / 100)}`}
                              strokeLinecap="round"
                              transform="rotate(-90 60 60)" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="mono" style={{ fontSize: '20px', fontWeight: 800 }}>{complianceData?.compliance_pct || 36}%</span>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Compliant</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>Target: 85% untuk sertifikasi</p>
                </div>

                {/* Estimated Cost Savings */}
                <div className="stat-card glass-card fade-up-3" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px', height: '100%' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '16px' }}>Estimated Cost Savings</h3>
                  <div className="mono" style={{ fontSize: '28px', fontWeight: 800, color: 'var(--success)' }}>
                    Rp {(complianceData?.estimated_savings_idr || 55000000).toLocaleString('id-ID')}
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Estimasi penghematan ROI pencegahan insiden human error.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── THREATS TAB ────────────────────────────────── */}
        {activeTab === 'threats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', marginBottom: '48px' }}>
            {/* Top Horizontal Filter Bar */}
            <div className="glass-card fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px', width: '100%', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                <Sliders size={16} /> Telemetry Filters
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  className="filter-select" 
                  value={threatTypeFilter} 
                  onChange={(e) => setThreatTypeFilter(e.target.value)}
                  style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
                >
                  <option value="ALL">ALL TYPES</option>
                  <option value="PHISHING_CLICK">🎣 PHISHING CLICK</option>
                  <option value="PHISHING_REPORT">🛡️ PHISHING REPORT</option>
                  <option value="MALWARE_DETECTED">🦠 MALWARE DETECTED</option>
                  <option value="SUSPICIOUS_URL">🔗 SUSPICIOUS URL</option>
                  <option value="DLP_VIOLATION">📎 DLP VIOLATION</option>
                </select>
                <select 
                  className="filter-select" 
                  value={threatActionFilter} 
                  onChange={(e) => setThreatActionFilter(e.target.value)}
                  style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
                >
                  <option value="ALL">ALL ACTIONS</option>
                  <option value="BLOCK">BLOCK</option>
                  <option value="ALLOW">ALLOW</option>
                  <option value="NOTIFY_SOC">NOTIFY SOC</option>
                </select>
              </div>
            </div>

            {/* Main Panels (Full Width) */}
            <div className="panel glass-card fade-up" style={{ marginBottom: 0 }}>
              <div className="panel-header">
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={20} /> Deteksi per Hari</h2>
              </div>
              <div style={{ height: '200px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={threatChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={false}
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--accent-bright)' }}
                    />
                    <Bar dataKey="deteksi" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={32} isAnimationActive={true} animationDuration={250} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`panel glass-card fade-up ${cacheUpdated ? 'value-flash' : ''}`} style={{ marginBottom: 0 }}>
              <div className="panel-header">
                <h2 className="panel-title"><Search size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Threat Intelligence Cache</h2>
                <span className="panel-count">
                  {cache.filter(entry => {
                    const matchesType = threatTypeFilter === 'ALL' || entry.threatType.toUpperCase() === threatTypeFilter.toUpperCase();
                    const matchesAction = threatActionFilter === 'ALL' || entry.action.toUpperCase() === threatActionFilter.toUpperCase();
                    return matchesType && matchesAction;
                  }).length} dari {cache.length} entri
                </span>
              </div>
              <div className="threat-table-wrap">
                <table className="threat-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>URL / File</th>
                      <th>Type</th>
                      <th>Score</th>
                      <th>Source</th>
                      <th>Action</th>
                      <th>Detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cache
                      .filter(entry => {
                        const matchesType = threatTypeFilter === 'ALL' || entry.threatType.toUpperCase() === threatTypeFilter.toUpperCase();
                        const matchesAction = threatActionFilter === 'ALL' || entry.action.toUpperCase() === threatActionFilter.toUpperCase();
                        return matchesType && matchesAction;
                      })
                      .map(entry => (
                        <tr key={entry.id}>
                          <td className="mono url-cell" title={entry.url}>
                            {entry.url.length > 80 ? entry.url.substring(0, 80) + '...' : entry.url}
                          </td>
                          <td><span className={`badge badge-${entry.action}`}>{entry.threatType}</span></td>
                          <td>
                            <div className="score-bar-wrap">
                              <div
                                className="score-bar"
                                style={{
                                  width: `${entry.score}%`,
                                  background: entry.score >= 80 ? 'var(--danger)' : entry.score >= 50 ? 'var(--warning)' : 'var(--success)',
                                }}
                              />
                              <span className="score-bar-label">{entry.score}</span>
                            </div>
                          </td>
                          <td>{entry.source}</td>
                          <td><span className={`badge badge-${entry.action}`}>{actionIcon[entry.action]} {entry.action.toUpperCase()}</span></td>
                          <td className="text-muted">{timeAgo(entry.detectedAt)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Central Login & Device Anomaly Audit Log */}
            <div className="panel glass-card fade-up" style={{ marginTop: '24px' }}>
              <div className="panel-header">
                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={20} /> Audit Riwayat Login & Perangkat (Identity Security)
                </h2>
                <span className="panel-count">{loginHistory.length} log terdeteksi</span>
              </div>
              <div className="threat-table-wrap">
                <table className="threat-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '20%', textAlign: 'left' }}>Karyawan</th>
                      <th style={{ width: '15%', textAlign: 'left' }}>Divisi</th>
                      <th style={{ width: '15%', textAlign: 'left' }}>Waktu Akses</th>
                      <th style={{ width: '15%', textAlign: 'left' }}>Perangkat</th>
                      <th style={{ width: '15%', textAlign: 'left' }}>Lokasi</th>
                      <th style={{ width: '10%', textAlign: 'left' }}>Koneksi</th>
                      <th style={{ width: '10%', textAlign: 'left' }}>Risiko</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                          Belum ada log audit login terkumpul.
                        </td>
                      </tr>
                    ) : (
                      loginHistory.map((log) => (
                        <tr key={log.id} title={log.reason}>
                          <td style={{ fontWeight: 600 }}>{log.email}</td>
                          <td>{log.division}</td>
                          <td className="mono">{log.login_time}</td>
                          <td>{log.device}</td>
                          <td>{log.location}</td>
                          <td>
                            {log.network}
                            {log.vpn && (
                              <span style={{ fontSize: '9px', padding: '2px 4px', background: 'rgba(52, 211, 153, 0.15)', color: 'var(--success)', borderRadius: '4px', marginLeft: '6px' }}>VPN</span>
                            )}
                          </td>
                          <td>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: log.risk === 'LOW' ? 'rgba(52, 211, 153, 0.12)' : log.risk === 'MEDIUM' ? 'rgba(251, 191, 36, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                              color: log.risk === 'LOW' ? 'var(--success)' : log.risk === 'MEDIUM' ? 'var(--warning)' : 'var(--danger)'
                            }}>
                              {log.risk}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ── LEADERBOARD TAB ─────────────────────────────── */}
        {activeTab === 'leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', marginBottom: '48px' }}>
            {/* Top Horizontal Filter Bar */}
            <div className="glass-card fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px', width: '100%', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                <Sliders size={16} /> Gamification Filters
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  className="filter-select" 
                  value={leaderboardDivisiFilter} 
                  onChange={(e) => setLeaderboardDivisiFilter(e.target.value)}
                  style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
                >
                  <option value="ALL">ALL DIVISIONS</option>
                  <option value="IT">IT</option>
                  <option value="Network Engineering">Network Engineering</option>
                  <option value="Network Operations">Network Operations</option>
                  <option value="Performance & Shared Service">Performance & Shared Service</option>
                  <option value="Sales Support">Sales Support</option>
                  <option value="Unknown">Unknown</option>
                </select>
                <select 
                  className="filter-select" 
                  value={leaderboardBadgeFilter} 
                  onChange={(e) => setLeaderboardBadgeFilter(e.target.value)}
                  style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
                >
                  <option value="ALL">ALL BADGES</option>
                  <option value="Sentinel">Sentinel (Secure)</option>
                  <option value="Guardian">Guardian (Medium)</option>
                  <option value="Vulnerable">Vulnerable (High Risk)</option>
                </select>
              </div>
            </div>

            {/* Content Row: Side-by-side Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', width: '100%', alignItems: 'stretch' }}>
              {/* Division Leaderboard */}
              {(() => {
                const filteredDivisions = (leaderboardData?.by_divisi || [
                  { divisi: 'IT', avg_points: 105, member_count: 1 },
                  { divisi: 'Network Engineering', avg_points: 80, member_count: 1 },
                  { divisi: 'Network Operations', avg_points: 68, member_count: 1 },
                  { divisi: 'Performance & Shared Service', avg_points: 50, member_count: 1 },
                  { divisi: 'Sales Support', avg_points: 35, member_count: 1 }
                ]).filter(row => leaderboardDivisiFilter === 'ALL' || row.divisi === leaderboardDivisiFilter);

                const itemsPerPage = 5;
                const totalPages = Math.max(1, Math.ceil(filteredDivisions.length / itemsPerPage));
                const activePage = Math.min(divisionPage, totalPages);
                const paginatedDivisions = filteredDivisions.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

                return (
                  <div className={`panel glass-card fade-up ${leaderboardUpdated ? 'value-flash' : ''}`} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '520px' }}>
                    <div>
                      <div className="panel-header">
                        <h2 className="panel-title"><Trophy size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Division Leaderboard</h2>
                        <span className="panel-count">{filteredDivisions.length} divisi</span>
                      </div>
                      <div className="threat-table-wrap" style={{ height: '420px', overflowY: 'auto', overflowX: 'auto' }}>
                        <table className="threat-table" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '15%', textAlign: 'left', padding: '14px 10px' }}>Rank</th>
                              <th style={{ width: '45%', textAlign: 'left', padding: '14px 10px' }}>Divisi</th>
                              <th style={{ width: '20%', textAlign: 'left', padding: '14px 10px' }}>Anggota</th>
                              <th style={{ width: '20%', textAlign: 'left', padding: '14px 10px' }}>Poin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDivisions.map((row, idx) => {
                              const actualRank = idx + 1;
                              return (
                                <tr key={idx}>
                                  <td className="mono" style={{ width: '15%', fontWeight: 600, textAlign: 'left', padding: '14px 10px' }}>#{actualRank}</td>
                                  <td style={{ width: '45%', fontWeight: 600, textAlign: 'left', padding: '14px 10px' }}>{row.divisi}</td>
                                  <td style={{ width: '20%', textAlign: 'left', padding: '14px 10px' }}>{row.member_count}</td>
                                  <td className="mono" style={{ width: '20%', textAlign: 'left', fontWeight: 600, color: 'var(--accent)', padding: '14px 10px' }}>{row.avg_points} pts</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Individual Leaderboard */}
              {(() => {
                const filteredIndividual = (leaderboardData?.individual || [
                  { rank: 1, email: 'sari@netops-dummy.local', divisi: 'Network Operations', points: 230, badge: 'Sentinel', click_count: 0 },
                  { rank: 2, email: 'lovind@netengineering-dummy.local', divisi: 'IT', points: 105, badge: 'Guardian', click_count: 0 },
                  { rank: 3, email: 'rina@perfshared-dummy.local', divisi: 'Performance & Shared Service', points: 75, badge: 'Guardian', click_count: 1 },
                  { rank: 4, email: 'budi@netengineering-dummy.local', divisi: 'Network Engineering', points: 20, badge: 'Vulnerable', click_count: 3 },
                  { rank: 5, email: 'daffa@netops-dummy.local', divisi: 'Unknown', points: 65, badge: 'Guardian', click_count: 0 },
                  { rank: 6, email: 'kiko@salessupport-dummy.local', divisi: 'Unknown', points: 62, badge: 'Guardian', click_count: 0 },
                  { rank: 7, email: 'lovin@perfshared-dummy.local', divisi: 'Unknown', points: 61, badge: 'Guardian', click_count: 0 }
                ]).filter(row => {
                  const matchesDivisi = leaderboardDivisiFilter === 'ALL' || row.divisi === leaderboardDivisiFilter;
                  const matchesBadge = leaderboardBadgeFilter === 'ALL' || row.badge === leaderboardBadgeFilter;
                  return matchesDivisi && matchesBadge;
                });

                const itemsPerPage = 6;
                const totalPages = Math.max(1, Math.ceil(filteredIndividual.length / itemsPerPage));
                const activePage = Math.min(leaderboardPage, totalPages);
                const paginatedIndividual = filteredIndividual.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

                return (
                  <div className={`panel glass-card fade-up-1 ${leaderboardUpdated ? 'value-flash' : ''}`} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '520px' }}>
                    <div>
                      <div className="panel-header">
                        <h2 className="panel-title"><Users size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Individual Security Leaderboard</h2>
                        <span className="panel-count">{filteredIndividual.length} total</span>
                      </div>
                      <div className="threat-table-wrap" style={{ height: '420px', overflowY: 'auto', overflowX: 'auto' }}>
                        <table className="threat-table" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '10%', padding: '14px 10px' }}>Rank</th>
                              <th style={{ width: '38%', padding: '14px 10px' }}>Email</th>
                              <th style={{ width: '22%', padding: '14px 10px' }}>Divisi</th>
                              <th style={{ width: '15%', padding: '14px 10px' }}>Badge</th>
                              <th style={{ width: '10%', padding: '14px 10px' }}>Poin</th>
                              <th style={{ width: '5%', textAlign: 'right', padding: '14px 10px' }}>Klik</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredIndividual.map((row, idx) => (
                              <tr key={idx}>
                                <td className="mono" style={{ fontWeight: 600, padding: '14px 10px' }}>#{row.rank}</td>
                                <td className="mono" style={{ fontSize: '12px', padding: '14px 10px' }}>{row.email}</td>
                                <td style={{ fontSize: '13px', padding: '14px 10px' }}>{row.divisi}</td>
                                <td style={{ padding: '14px 10px' }}>
                                  <span className={`badge badge-${row.badge === 'Sentinel' ? 'low' : row.badge === 'Guardian' ? 'notify_soc' : 'critical'}`}>
                                    {row.badge}
                                  </span>
                                </td>
                                <td className="mono" style={{ fontWeight: 600, color: 'var(--success)', padding: '14px 10px' }}>{row.points}</td>
                                <td className="mono" style={{ textAlign: 'right', color: row.click_count > 0 ? 'var(--danger)' : 'var(--text-muted)', padding: '14px 10px' }}>{row.click_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── POLICY TAB ─────────────────────────────────── */}
        {activeTab === 'policy' && (
          <div className={`panel glass-card fade-up ${policyUpdated ? 'value-flash' : ''}`} style={{ marginBottom: '48px' }}>
            <div className="panel-header">
              <h2 className="panel-title"><Scale size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Policy Decisions & Adaptive Enforcement</h2>
              <span className="panel-count">{decisions.length} keputusan</span>
            </div>

            {/* Ringkasan horizontal — sebelumnya cuma list vertikal doang */}
            <div className="policy-summary-strip">
              {(['block', 'warning', 'allow', 'notify_soc'] as const).map(action => (
                <div key={action} className="policy-summary-item">
                  <div className="policy-summary-value">
                    {decisions.filter(d => d.finalAction === action).length}
                  </div>
                  <div className="policy-summary-label">{action.replace('_', ' ')}</div>
                </div>
              ))}
            </div>

            <div className="policy-list">
              {decisions.map(d => (
                <div key={d.id} className="policy-card">
                  <div className="policy-header-row">
                    <span className="mono policy-id">{d.id}</span>
                    <span className={`badge badge-${d.finalAction}`}>
                      {actionIcon[d.finalAction]} {d.finalAction.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="policy-scores">
                    <div className="policy-score-item">
                      <span className="policy-score-label">Threat Score</span>
                      <div className="policy-score-bar">
                        <div className="policy-score-fill threat-fill" style={{ width: `${d.threatScore}%` }} />
                      </div>
                      <span className="policy-score-val">{d.threatScore}</span>
                    </div>
                    <div className="policy-score-combine">+</div>
                    <div className="policy-score-item">
                      <span className="policy-score-label">Behavior Score</span>
                      <div className="policy-score-bar">
                        <div className="policy-score-fill behavior-fill" style={{ width: `${d.behaviorScore}%` }} />
                      </div>
                      <span className="policy-score-val">{d.behaviorScore}</span>
                    </div>
                    <div className="policy-score-combine">→</div>
                    <div className="policy-final-action">
                      {actionIcon[d.finalAction]}
                    </div>
                  </div>
                  <p className="policy-reason">{d.reason}</p>
                  {d.url && <p className="policy-url mono">{d.url}</p>}
                  <span className="policy-time">{timeAgo(d.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GOPHISH TAB (Command Center) ───────────────── */}
        {activeTab === 'gophish' && (
          <>
            <div className="panel glass-card fade-up" style={{ marginBottom: '0' }}>
            <div className="panel-header">
              <div>
                <h2 className="panel-title"><Fish size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> GoPhish Command Center</h2>
                <p className="panel-desc" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                  Kontrol visual untuk sinkronisasi target dan meluncurkan simulasi phishing via GoPhish API.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-action" onClick={handleSyncUsers} style={{ background: 'rgba(129, 140, 248, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={16} /> Sync Target Group
                </button>
                <button className="btn-action" onClick={handleOpenLaunchModal} style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Play size={16} /> Launch Simulation
                </button>
              </div>
            </div>

            {/* Target Selection panel for orchestration */}
            <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', marginBottom: '24px', marginLeft: '24px', marginRight: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> Target Selection ({selectedEmails.length} terpilih)</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Pilih target karyawan untuk kampanye simulasi berikutnya.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {/* Division Filter */}
                  <select
                    value={gpEmployeeFilter}
                    onChange={(e) => setGpEmployeeFilter(e.target.value)}
                    style={{ padding: '6px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white', fontSize: '12px', outline: 'none' }}
                  >
                    <option value="ALL">Semua Divisi</option>
                    {divisions.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      const activeEmps = employees.filter(e => e.is_active === 1 && (gpEmployeeFilter === 'ALL' || e.divisi === gpEmployeeFilter));
                      setSelectedEmails(activeEmps.map(e => e.email));
                    }}
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    Pilih Semua
                  </button>
                  <button
                    onClick={() => setSelectedEmails([])}
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    Bersihkan
                  </button>
                </div>
              </div>

              {/* Target checklist grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', maxHeight: '160px', overflowY: 'auto', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                {employees.filter(emp => emp.is_active === 1).filter(emp => gpEmployeeFilter === 'ALL' || emp.divisi === gpEmployeeFilter).map(emp => {
                  const isChecked = selectedEmails.includes(emp.email);
                  return (
                    <label
                      key={emp.email}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 10px',
                        background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.01)',
                        border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmails([...selectedEmails, emp.email]);
                          } else {
                            setSelectedEmails(selectedEmails.filter(email => email !== emp.email));
                          }
                        }}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <span title={emp.email} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.email}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Ringkasan horizontal — sebelumnya cuma judul + tabel doang */}
            <div className="gophish-summary-strip">
              <div className="policy-summary-item">
                <div className="policy-summary-value">{campaigns.length}</div>
                <div className="policy-summary-label">Kampanye</div>
              </div>
              <div className="policy-summary-item">
                <div className="policy-summary-value">{campaigns.reduce((sum, c) => sum + (c.stats?.sent ?? 0), 0)}</div>
                <div className="policy-summary-label">Terkirim</div>
              </div>
              <div className="policy-summary-item">
                <div className="policy-summary-value">{campaigns.reduce((sum, c) => sum + (c.stats?.clicked ?? 0), 0)}</div>
                <div className="policy-summary-label">Diklik</div>
              </div>
              <div className="policy-summary-item">
                <div className="policy-summary-value">{campaigns.reduce((sum, c) => sum + (c.stats?.submitted_data ?? 0), 0)}</div>
                <div className="policy-summary-label">Leaks Kredensial</div>
              </div>
            </div>

            <div className="threat-table-wrap">
              <table className="threat-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nama Kampanye</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Terkirim</th>
                    <th style={{ textAlign: 'center' }}>Dibuka</th>
                    <th style={{ textAlign: 'center' }}>Diklik</th>
                    <th style={{ textAlign: 'center' }}>Leaks Kredensial</th>
                    <th style={{ textAlign: 'center' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        Belum ada kampanye aktif. Klik "Launch Simulation" untuk memulai.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map(c => (
                      <tr key={c.id}>
                        <td>#{c.id}</td>
                        <td style={{ fontWeight: 600 }}>
                          <span 
                            onClick={() => handleViewCampaignDetail(c.id)} 
                            style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent)' }}
                            title="Klik untuk lihat detail"
                          >
                            {c.name}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${c.status === 'In Progress' ? 'badge-warning' : 'badge-allow'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>{c.stats?.sent ?? 0}</td>
                        <td style={{ color: 'var(--warning)', textAlign: 'center' }}>{c.stats?.opened ?? 0}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 'bold', textAlign: 'center' }}>{c.stats?.clicked ?? 0}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 'bold', textAlign: 'center' }}>{c.stats?.submitted_data ?? 0}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleViewCampaignDetail(c.id)}
                            title="Detail kampanye"
                            style={{ padding: '6px', background: 'transparent', border: '1px solid var(--accent)', borderRadius: '6px', cursor: 'pointer', color: 'var(--accent)', marginRight: '6px' }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteCampaign(c.id, c.name)}
                            title="Hapus kampanye"
                            style={{ padding: '6px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Koleksi Phishing Sendiri (Template & Landing Page) ── */}
          <div className="panel glass-card fade-up" style={{ marginTop: '24px', marginBottom: '48px' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 className="panel-title"><Pencil size={20} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Koleksi Phishing Saya</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Bikin email template & landing page sendiri langsung dari sini — gak perlu buka GoPhish.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px' }}>
                {/* Email Templates */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={16} /> Email Templates ({resources?.templates?.length ?? 0})
                    </h3>
                    <button
                      onClick={() => openTemplateBuilder()}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                    >
                      <Plus size={14} /> Buat Baru
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    {(resources?.templates?.length ?? 0) === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                        Belum ada template. Klik "Buat Baru" buat mulai.
                      </div>
                    ) : (
                      resources!.templates.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject || '—'}</div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => openTemplateBuilder(t)} title="Edit" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'white' }}>
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeleteTemplate(t.id, t.name)} title="Hapus" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Landing Pages */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Globe size={16} /> Landing Pages ({resources?.pages?.length ?? 0})
                    </h3>
                    <button
                      onClick={() => openPageBuilder()}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                    >
                      <Plus size={14} /> Buat Baru
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    {(resources?.pages?.length ?? 0) === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                        Belum ada landing page. Klik "Buat Baru" buat mulai.
                      </div>
                    ) : (
                      resources!.pages.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {p.capture_credentials ? 'Capture kredensial: Ya' : 'Capture kredensial: Tidak'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => openPageBuilder(p)} title="Edit" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'white' }}>
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeletePage(p.id, p.name)} title="Hapus" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        {activeTab === 'webmail' && (
          <div className="webmail-panel fade-up" style={{ marginBottom: '48px' }}>
            <div className="webmail-sidebar">
              <div className="webmail-sidebar-header">
                <Inbox size={16} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} /> Mock Webmail Inbox ({emails.length})
              </div>
              <div className="email-list">
                {emails.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Inbox kosong.
                  </div>
                ) : (
                  emails.map((email) => (
                    <div
                      key={email.id}
                      className={`email-item ${selectedEmail?.id === email.id ? 'active' : ''}`}
                      onClick={() => setSelectedEmail(email)}
                    >
                      <div className="email-item-subject">{email.subject}</div>
                      <div className="email-item-to">Ke: {email.to_email}</div>
                      <div className="email-item-date">{timeAgo(email.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="webmail-content">
              {selectedEmail ? (
                <>
                  <div className="webmail-content-header">
                    <h2 className="webmail-subject">{selectedEmail.subject}</h2>
                    <div className="webmail-meta">
                      <span>Ke: <strong>{selectedEmail.to_email}</strong></span>
                      <span style={{ margin: '0 8px' }}>·</span>
                      <span>Diterima: {new Date(selectedEmail.created_at).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                  <div className="webmail-body">
                    {/* Render email safely via iframe with srcDoc to isolate custom phishing link styles.
                         onLoad intercepts all <a> clicks and routes them through Secure Gateway /go?url=... */}
                    <iframe
                      srcDoc={selectedEmail.body}
                      title="Webmail Body"
                      onLoad={(e) => {
                        const iframeDoc = (e.target as HTMLIFrameElement).contentDocument;
                        if (!iframeDoc) return;
                        iframeDoc.querySelectorAll('a').forEach((a) => {
                          a.addEventListener('click', (evt) => {
                            evt.preventDefault();
                            const href = a.getAttribute('href');
                            if (href && href !== '#') {
                              // Route through Secure Gateway proxy for threat check
                              const gatewayUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/go?url=${encodeURIComponent(href)}`;
                              window.open(gatewayUrl, '_blank', 'noopener,noreferrer');
                            }
                          });
                        });
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="webmail-empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <h3>Pilih email untuk dibaca</h3>
                  <p>Klik salah satu email di sidebar untuk melihat isi konten simulasi.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EMPLOYEES TAB ──────────────────────────────── */}
        {activeTab === 'employees' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', marginBottom: '48px' }}>
            {/* Top Horizontal Filter Bar */}
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px', width: '100%', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                <Sliders size={16} /> Directory Filters
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  className="filter-select" 
                  value={employeeDivisionFilter} 
                  onChange={(e) => setEmployeeDivisionFilter(e.target.value)}
                  style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
                >
                  <option value="ALL">SEMUA DIVISI</option>
                  {divisions.map((div) => (
                    <option key={div.name} value={div.name}>{div.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Left: Employees List (Full Width) */}
            <div className="panel glass-card" style={{ marginBottom: 0 }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 className="panel-title"><Users size={20} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Employee Directory</h2>
                  <p className="panel-desc" style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                    Tambah, edit, dan kelola status aktif karyawan.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn-action"
                    onClick={() => setIsDivModalOpen(true)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} /> Add Division
                  </button>
                  <button
                    className="btn-action"
                    onClick={handleOpenAddEmp}
                    style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} /> Add Employee
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Cari karyawan berdasarkan email..."
                  value={employeeSearchText}
                  onChange={(e) => setEmployeeSearchText(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div className="threat-table-wrap">
                <table className="threat-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Email</th>
                      <th style={{ width: '25%' }}>Divisi</th>
                      <th style={{ width: '12%', textAlign: 'center' }}>Poin</th>
                      <th style={{ width: '13%', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filtered = employees.filter(emp => {
                        const matchesSearch = emp.email.toLowerCase().includes(employeeSearchText.toLowerCase());
                        const matchesDivision = employeeDivisionFilter === 'ALL' || emp.divisi === employeeDivisionFilter;
                        return matchesSearch && matchesDivision;
                      });
                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                              Tidak ada karyawan ditemukan.
                            </td>
                          </tr>
                        );
                      }
                      return filtered.map((emp) => (
                        <tr key={emp.email}>
                          <td className="mono" style={{ fontWeight: 600 }}>{emp.email}</td>
                          <td>{emp.divisi}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: emp.points >= 130 ? 'var(--success)' : emp.points >= 60 ? 'var(--info)' : 'var(--danger)' }}>
                            {emp.points}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${emp.is_active === 1 ? 'badge-allow' : 'badge-danger'}`}>
                              {emp.is_active === 1 ? 'ACTIVE' : 'DISABLED'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleOpenEditEmp(emp)}
                              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Dialog Launch campaign ── */}
      {isLaunchModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up">
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Play size={20} /> Launch Phishing Simulation</h3>
            <form onSubmit={handleLaunchCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Nama Kampanye
                </label>
                <input
                  type="text"
                  placeholder="Misal: Q3 Password Reset Verification"
                  value={launchName}
                  onChange={(e) => setLaunchName(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Template Email
                </label>
                <select
                  value={launchTemplate}
                  onChange={(e) => setLaunchTemplate(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                >
                  {resources?.templates?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Sending Profile (SMTP)
                </label>
                <select
                  value={launchProfile}
                  onChange={(e) => setLaunchProfile(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                >
                  {resources?.profiles?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Landing Page
                </label>
                <select
                  value={launchPage}
                  onChange={(e) => setLaunchPage(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                >
                  {resources?.pages?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  URL (Phishing Redirect Target)
                </label>
                <input
                  type="text"
                  value={launchUrl}
                  onChange={(e) => setLaunchUrl(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsLaunchModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLaunching}
                  style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {isLaunching ? 'Launching...' : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Play size={16} /> Launch Now
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dialog Campaign Detail ── */}
      {isDetailModalOpen && selectedCampaignDetail && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up" style={{ maxWidth: '850px', width: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={20} /> Detail Kampanye: {selectedCampaignDetail.name}
              </h3>
              <button onClick={() => setIsDetailModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'white' }}>{selectedCampaignDetail.stats?.sent ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Terkirim</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--warning)' }}>{selectedCampaignDetail.stats?.opened ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dibuka</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--danger)' }}>{selectedCampaignDetail.stats?.clicked ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Diklik</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--danger)' }}>{selectedCampaignDetail.stats?.submitted_data ?? 0}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Leaks Kredensial</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }} className="threat-table-wrap">
              <table className="threat-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Email Target</th>
                    <th style={{ textAlign: 'left' }}>Divisi</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'right' }}>Waktu Aktivitas</th>
                  </tr>
                </thead>
                <tbody>
                  {(!selectedCampaignDetail.results || selectedCampaignDetail.results.length === 0) ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                        Belum ada data aktivitas target.
                      </td>
                    </tr>
                  ) : (
                    selectedCampaignDetail.results.map((r: any, idx: number) => {
                      let badgeClass = 'badge-allow';
                      if (r.status === 'Submitted Data') badgeClass = 'badge-danger';
                      else if (r.status === 'Clicked Link') badgeClass = 'badge-critical';
                      else if (r.status === 'Email Opened') badgeClass = 'badge-warning';
                      else if (r.status === 'Email Sent') badgeClass = 'badge-allow';
                      
                      return (
                        <tr key={idx}>
                          <td className="mono" style={{ fontSize: '12px' }}>{r.email}</td>
                          <td>{r.position || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${badgeClass}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="mono" style={{ textAlign: 'right', fontSize: '11px' }}>
                            {r.modified_date ? new Date(r.modified_date).toLocaleString('id-ID') : '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                style={{ padding: '8px 24px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog Template & Landing Page Builder ── */}
      {isBuilderOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up" style={{ maxWidth: '920px', width: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {builderMode === 'template' ? <Mail size={20} /> : <Globe size={20} />}
                {builderEditId !== null ? 'Edit' : 'Buat'} {builderMode === 'template' ? 'Email Template' : 'Landing Page'}
              </h3>
              <button onClick={() => setIsBuilderOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {builderError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                {builderError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Nama {builderMode === 'template' ? 'Template' : 'Landing Page'}
                  </label>
                  <input
                    type="text"
                    placeholder={builderMode === 'template' ? 'Misal: Notifikasi Reset Password' : 'Misal: Fake SSO Login'}
                    value={builderName}
                    onChange={(e) => setBuilderName(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                  />
                </div>

                {builderMode === 'template' && (
                  <div style={{ flex: '1 1 240px' }}>
                    <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Subject Email
                    </label>
                    <input
                      type="text"
                      placeholder="Misal: [Action Required] Verifikasi Akun Anda"
                      value={builderSubject}
                      onChange={(e) => setBuilderSubject(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                    />
                  </div>
                )}
              </div>

              {builderMode === 'template' && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Variabel GoPhish yang bisa dipakai di HTML: <code>{'{{.FirstName}}'}</code>, <code>{'{{.LastName}}'}</code>, <code>{'{{.Email}}'}</code>, <code>{'{{.URL}}'}</code>, <code>{'{{.TrackingURL}}'}</code> — otomatis diganti GoPhish pas dikirim.
                </div>
              )}

              {builderMode === 'page' && (
                <div>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Clone dari Situs Asli (opsional)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="https://portal-sso-internal.example.com/login"
                      value={builderCloneUrl}
                      onChange={(e) => setBuilderCloneUrl(e.target.value)}
                      style={{ flex: 1, padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={handleCloneSite}
                      disabled={isCloning}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <Globe size={14} /> {isCloning ? 'Cloning...' : 'Clone HTML'}
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Hasil clone masuk ke editor di bawah — review & sunting dulu sebelum disimpan (misal cek form action / field tersembunyi).
                  </div>
                </div>
              )}

              {/* Split editor: textarea kiri, live preview kanan (WYSIWYG-lite) */}
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Konten HTML
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', height: '320px' }}>
                  <textarea
                    value={builderHtml}
                    onChange={(e) => setBuilderHtml(e.target.value)}
                    placeholder="<html>...</html>"
                    style={{ width: '100%', height: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none', fontFamily: 'monospace', fontSize: '12px', resize: 'none' }}
                  />
                  <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', background: 'white', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', zIndex: 1 }}>
                      <Eye size={10} /> Live Preview
                    </div>
                    <iframe
                      title="preview"
                      srcDoc={builderHtml || '<div style="font-family:sans-serif;color:#888;padding:16px;font-size:13px;">Preview muncul di sini...</div>'}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      sandbox=""
                    />
                  </div>
                </div>
              </div>

              {builderMode === 'page' && (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={builderCaptureCredentials} onChange={(e) => setBuilderCaptureCredentials(e.target.checked)} />
                    Tangkap kredensial (username/email)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={builderCapturePasswords} onChange={(e) => setBuilderCapturePasswords(e.target.checked)} />
                    Tangkap password
                  </label>
                  <div style={{ flex: '1 1 220px' }}>
                    <input
                      type="text"
                      placeholder="Redirect URL setelah submit (opsional)"
                      value={builderRedirectUrl}
                      onChange={(e) => setBuilderRedirectUrl(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveBuilder}
                  disabled={isSavingBuilder}
                  style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {isSavingBuilder ? 'Menyimpan...' : (builderEditId !== null ? 'Simpan Perubahan' : 'Simpan')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEmpModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up">
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} /> {empModalMode === 'add' ? 'Add New Employee' : 'Edit Employee'}
            </h3>
            <form onSubmit={handleSaveEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Email Karyawan
                </label>
                <input
                  type="email"
                  placeholder="name@company.local"
                  required
                  value={empModalEmail}
                  onChange={(e) => setEmpModalEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Divisi
                  </label>
                  <label style={{ fontSize: '11px', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="checkbox"
                      checked={isCreatingNewDiv}
                      onChange={(e) => setIsCreatingNewDiv(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    Buat Divisi Baru
                  </label>
                </div>
                {isCreatingNewDiv ? (
                  <input
                    type="text"
                    placeholder="Masukkan nama divisi baru..."
                    required
                    value={empModalNewDivision}
                    onChange={(e) => setEmpModalNewDivision(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                  />
                ) : (
                  <select
                    value={empModalDivision}
                    onChange={(e) => setEmpModalDivision(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                  >
                    {divisions.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={empModalIsActive}
                    onChange={(e) => setEmpModalIsActive(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span>Status Karyawan Aktif</span>
                </label>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Karyawan non-aktif tidak akan menerima kiriman email simulasi phishing.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsEmpModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Simpan Karyawan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dialog Add Division ── */}
      {isDivModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up" style={{ maxWidth: '400px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={20} /> Create New Division
            </h3>
            <form onSubmit={handleCreateDivision} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Nama Divisi
                </label>
                <input
                  type="text"
                  placeholder="Misal: Cyber Security Operations"
                  required
                  value={divModalName}
                  onChange={(e) => setDivModalName(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsDivModalOpen(false)}
                  style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Buat Divisi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Dialog Detail Incident ── */}
      {selectedIncident && (
        <div className="dialog-overlay" onClick={() => setSelectedIncident(null)}>
          <div className="dialog-box fade-up glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <AlertTriangle size={20} style={{ color: selectedIncident.severity === 'critical' || selectedIncident.severity === 'high' ? 'var(--danger)' : 'var(--warning)' }} />
                Detail Insiden {selectedIncident.id}
              </h3>
              <button 
                onClick={() => setSelectedIncident(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '22px', fontWeight: 600, outline: 'none' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Deskripsi / Aktivitas</span>
                <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginTop: '4px', lineHeight: 1.4 }}>{selectedIncident.description}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Tingkat Kerawanan (Severity)</span>
                  <div style={{ marginTop: '6px' }}>
                    <span className={`badge badge-${selectedIncident.severity === 'critical' ? 'critical' : selectedIncident.severity === 'high' ? 'high' : selectedIncident.severity === 'medium' ? 'medium' : 'low'}`}>
                      {selectedIncident.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Status Penanganan</span>
                  <div style={{ marginTop: '6px' }}>
                    <span className={`badge badge-${selectedIncident.status === 'resolved' ? 'allow' : 'warning'}`}>
                      {selectedIncident.status ? selectedIncident.status.toUpperCase() : 'OPEN'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Sumber Deteksi Telemetri</span>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Server size={14} style={{ color: 'var(--accent)' }} /> {selectedIncident.source}
                  </p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Karyawan Terkait (Target)</span>
                  <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} style={{ color: 'var(--accent)' }} /> {selectedIncident.target || '-'}
                  </p>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Waktu Kejadian (Timestamp)</span>
                <p style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                  {new Date(selectedIncident.timestamp).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'medium' })}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setSelectedIncident(null)}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Batal
              </button>
              {selectedIncident.status !== 'resolved' && (
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleResolveIncident(selectedIncident.id)}
                  style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: '6px', color: 'var(--bg-deep)', fontWeight: 700, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={14} /> Tandai Selesai (Resolve)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="dashboard-footer">
        Human Firewall · Security Culture & Threat Triage Platform · Live data updates automatically
      </footer>
      </div>
    </div>
  );
}