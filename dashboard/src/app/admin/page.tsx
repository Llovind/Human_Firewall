'use client';

import { useAuth } from '@/context/AuthContext';
import { usePolling } from '@/hooks/usePolling';
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
  templates: { id: number; name: string }[];
  profiles: { id: number; name: string }[];
  pages: { id: number; name: string }[];
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
const severityIcon: Record<string, string> = {
  critical: '🔴', high: '🟠', medium: '🟡', low: '🟢',
};
const actionIcon: Record<string, string> = {
  block: '🛑', warning: '⚠️', allow: '✅', notify_soc: '📡',
};
const typeIcon: Record<string, string> = {
  phishing_click: '🎣', phishing_report: '🛡️', malware_detected: '🦠',
  suspicious_url: '🔗', dlp_violation: '📎',
};

export default function SOCAdminDashboard() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [clock, setClock] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'threats' | 'behavior' | 'policy' | 'gophish' | 'webmail'>('overview');

  // ── Polling basic data sources ───
  const { data: incidentData, hasUpdated: incidentUpdated } = usePolling<{ incidents: Incident[]; stats: Stats }>('/api/incident', 3000);
  const { data: cacheData, hasUpdated: cacheUpdated } = usePolling<{ cache: ThreatCacheEntry[] }>('/api/cache', 3000);
  const { data: summaryData, hasUpdated: summaryUpdated } = usePolling<{ summaries: AISummary[] }>('/api/summary', 3000);
  const { data: behaviorData, hasUpdated: behaviorUpdated } = usePolling<{ scores: BehaviorScore[] }>('/api/behavior', 3000);
  const { data: policyData, hasUpdated: policyUpdated } = usePolling<{ decisions: PolicyDecision[] }>('/api/policy', 3000);

  // ── GoPhish Data & Webmail Data ───
  const [campaigns, setCampaigns] = useState<GoPhishCampaign[]>([]);
  const [emails, setEmails] = useState<MockEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [resources, setResources] = useState<GoPhishResource | null>(null);

  // GoPhish Launch Form fields
  const [launchName, setLaunchName] = useState('');
  const [launchTemplate, setLaunchTemplate] = useState('');
  const [launchProfile, setLaunchProfile] = useState('');
  const [launchPage, setLaunchPage] = useState('');
  const [launchUrl, setLaunchUrl] = useState('http://localhost:8080');
  const [isLaunching, setIsLaunching] = useState(false);

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

  // Sync campaigns when focused on GoPhish or Webmail
  useEffect(() => {
    if (activeTab === 'gophish') {
      loadGoPhishCampaigns();
    } else if (activeTab === 'webmail') {
      loadEmails();
    }
  }, [activeTab]);

  // Periodic polling for GoPhish and Webmail when active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'gophish') {
      interval = setInterval(loadGoPhishCampaigns, 10000);
    } else if (activeTab === 'webmail') {
      interval = setInterval(loadEmails, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab]);

  const handleSyncUsers = async () => {
    if (!confirm("Sinkronisasi semua user ke GoPhish group 'HFL_Target_Group'?")) return;
    try {
      const res = await fetch('/api/admin/gophish/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Sukses! ${data.message || 'Data disinkronisasi.'}`);
      } else {
        alert(`Gagal: ${data.error}`);
      }
    } catch {
      alert("Koneksi gagal.");
    }
  };

  const handleOpenLaunchModal = () => {
    setIsLaunchModalOpen(true);
    loadGoPhishResources();
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!launchName || !launchTemplate || !launchProfile || !launchPage || !launchUrl) {
      alert('Semua field wajib diisi');
      return;
    }

    setIsLaunching(true);
    try {
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
        alert('Kampanye berhasil diluncurkan!');
        setIsLaunchModalOpen(false);
        setLaunchName('');
        loadGoPhishCampaigns();
      } else {
        alert(`Gagal meluncurkan: ${data.error}`);
      }
    } catch {
      alert('Gagal menghubungi backend.');
    } finally {
      setIsLaunching(false);
    }
  };

  // ── Redirect if not authenticated or not admin ───
  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
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
  const incidents = incidentData?.incidents || [];
  const cache = cacheData?.cache || [];
  const summaries = summaryData?.summaries || [];
  const scores = behaviorData?.scores || [];
  const decisions = policyData?.decisions || [];

  return (
    <div className="app">
      {/* ── Topbar ─────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-brand">
            <div className="topbar-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="topbar-title">Human Firewall <strong>SOC Admin</strong></span>
          </div>
          <nav className="topbar-nav">
            {(['overview', 'threats', 'behavior', 'policy', 'gophish', 'webmail'] as const).map(tab => (
              <button
                key={tab}
                className={`nav-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' ? '📊 Overview' 
                  : tab === 'threats' ? '🔍 Threats' 
                  : tab === 'behavior' ? '👤 Behavior' 
                  : tab === 'policy' ? '⚖️ Policy'
                  : tab === 'gophish' ? '🎣 GoPhish'
                  : '📬 Webmail'}
              </button>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          <div className="live-indicator">
            <span className="live-dot" />
            <span>Live</span>
          </div>
          <span className="clock mono">{clock}</span>
          <div className="user-badge" onClick={logout} title="Klik untuk logout" style={{ border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
            <span className="user-avatar" style={{ background: 'var(--danger)' }}>A</span>
            <span className="user-name" style={{ color: 'var(--danger)' }}>Logout</span>
          </div>
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────── */}
      <main className="main">
        {/* ── OVERVIEW TAB ───────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Row */}
            <div className="stats-grid fade-up">
              <div className={`stat-card glass-card ${incidentUpdated ? 'value-flash' : ''}`}>
                <div className="stat-icon stat-icon-danger">🚨</div>
                <div className="stat-value">{stats?.totalIncidents ?? '—'}</div>
                <div className="stat-label">Total Insiden</div>
              </div>
              <div className={`stat-card glass-card ${incidentUpdated ? 'value-flash' : ''}`}>
                <div className="stat-icon stat-icon-warning">⚡</div>
                <div className="stat-value">{stats?.openIncidents ?? '—'}</div>
                <div className="stat-label">Insiden Terbuka</div>
              </div>
              <div className={`stat-card glass-card ${cacheUpdated ? 'value-flash' : ''}`}>
                <div className="stat-icon stat-icon-accent">🛡️</div>
                <div className="stat-value">{stats?.blockedUrls ?? '—'}</div>
                <div className="stat-label">URL Diblokir</div>
              </div>
              <div className={`stat-card glass-card ${behaviorUpdated ? 'value-flash' : ''}`}>
                <div className="stat-icon stat-icon-success">📈</div>
                <div className="stat-value">{stats?.avgBehaviorScore ?? '—'}</div>
                <div className="stat-label">Avg. Behavior Score</div>
              </div>
            </div>

            {/* AI Summary Panel */}
            {summaries.length > 0 && (
              <div className={`panel glass-card fade-up-1 ${summaryUpdated ? 'value-flash' : ''}`}>
                <div className="panel-header">
                  <h2 className="panel-title">🤖 AI Threat Summary</h2>
                  <span className="panel-badge">Powered by LLM</span>
                </div>
                <div className="summary-list">
                  {summaries.slice(0, 3).map(s => (
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
                  ))}
                </div>
              </div>
            )}

            {/* Recent Incidents */}
            <div className={`panel glass-card fade-up-2 ${incidentUpdated ? 'value-flash' : ''}`}>
              <div className="panel-header">
                <h2 className="panel-title">🚨 Insiden Terbaru</h2>
                <span className="panel-count">{incidents.length} total</span>
              </div>
              <div className="incident-list">
                {incidents.slice(0, 5).map(inc => (
                  <div key={inc.id} className="incident-row">
                    <div className="incident-icon">{typeIcon[inc.type] || '📋'}</div>
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
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── THREATS TAB ────────────────────────────────── */}
        {activeTab === 'threats' && (
          <div className={`panel glass-card fade-up ${cacheUpdated ? 'value-flash' : ''}`}>
            <div className="panel-header">
              <h2 className="panel-title">🔍 Threat Intelligence Cache</h2>
              <span className="panel-count">{cache.length} entri</span>
            </div>
            <div className="threat-table-wrap">
              <table className="threat-table">
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
                  {cache.map(entry => (
                    <tr key={entry.id}>
                      <td className="mono url-cell" title={entry.url}>
                        {entry.url.length > 50 ? entry.url.substring(0, 50) + '...' : entry.url}
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
        )}

        {/* ── BEHAVIOR TAB ───────────────────────────────── */}
        {activeTab === 'behavior' && (
          <div className={`panel glass-card fade-up ${behaviorUpdated ? 'value-flash' : ''}`}>
            <div className="panel-header">
              <h2 className="panel-title">👤 Employee Behavior Scores</h2>
              <span className="panel-count">{scores.length} karyawan</span>
            </div>
            <div className="leaderboard">
              {scores
                .sort((a, b) => b.score - a.score)
                .map((s, idx) => (
                  <div key={s.userId} className="leaderboard-row">
                    <div className="leaderboard-rank">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </div>
                    <div className="leaderboard-avatar">{s.userName.charAt(0)}</div>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name">{s.userName}</div>
                      <div className="leaderboard-division">{s.division}</div>
                    </div>
                    <div className="leaderboard-stats">
                      <span className="lb-stat">🔥 {s.streak}</span>
                      <span className="lb-stat">⭐ {s.totalPoints}pts</span>
                    </div>
                    <div className="leaderboard-score-wrap">
                      <div className="leaderboard-score-bar">
                        <div
                          className="leaderboard-score-fill"
                          style={{
                            width: `${s.score}%`,
                            background: s.score >= 70 ? 'var(--success)' : s.score >= 40 ? 'var(--warning)' : 'var(--danger)',
                          }}
                        />
                      </div>
                      <span className="leaderboard-score-val">{s.score}</span>
                    </div>
                    <span className={`badge badge-${s.risk}`}>{s.risk.toUpperCase()}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── POLICY TAB ─────────────────────────────────── */}
        {activeTab === 'policy' && (
          <div className={`panel glass-card fade-up ${policyUpdated ? 'value-flash' : ''}`}>
            <div className="panel-header">
              <h2 className="panel-title">⚖️ Policy Decisions & Adaptive Enforcement</h2>
              <span className="panel-count">{decisions.length} keputusan</span>
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
          <div className="panel glass-card fade-up">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">🎣 GoPhish Command Center</h2>
                <p className="panel-desc" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                  Kontrol visual untuk sinkronisasi target dan meluncurkan simulasi phishing via GoPhish API.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-action" onClick={handleSyncUsers} style={{ background: 'rgba(129, 140, 248, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                  🔄 Sync Target Group
                </button>
                <button className="btn-action" onClick={handleOpenLaunchModal} style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                  🚀 Launch Simulation
                </button>
              </div>
            </div>

            <div className="threat-table-wrap" style={{ marginTop: '20px' }}>
              <table className="threat-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nama Kampanye</th>
                    <th>Status</th>
                    <th>Terkirim</th>
                    <th>Dibuka</th>
                    <th>Diklik</th>
                    <th>Leaks Kredensial</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        Belum ada kampanye aktif. Klik "Launch Simulation" untuk memulai.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map(c => (
                      <tr key={c.id}>
                        <td>#{c.id}</td>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td>
                          <span className={`badge ${c.status === 'In Progress' ? 'badge-warning' : 'badge-allow'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td>{c.stats.sent}</td>
                        <td style={{ color: 'var(--warning)' }}>{c.stats.opened}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{c.stats.clicked}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{c.stats.submitted_data}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── WEBMAIL TAB (Mock Inbox) ───────────────────── */}
        {activeTab === 'webmail' && (
          <div className="webmail-panel fade-up">
            <div className="webmail-sidebar">
              <div className="webmail-sidebar-header">
                📬 Mock Webmail Inbox ({emails.length})
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
                    {/* Render email safely via iframe with srcDoc to isolate custom phishing link styles */}
                    <iframe
                      srcDoc={selectedEmail.body}
                      title="Webmail Body"
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
      </main>

      {/* ── Dialog Launch campaign ── */}
      {isLaunchModalOpen && (
        <div className="dialog-overlay">
          <div className="dialog-box fade-up">
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>🚀 Launch Phishing Simulation</h3>
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
                  {isLaunching ? 'Launching...' : '🚀 Launch Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="dashboard-footer">
        Human Firewall · SOC Command Center · Live data updates automatically
      </footer>
    </div>
  );
}
