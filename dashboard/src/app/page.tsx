'use client';

import { useAuth } from '@/context/AuthContext';
import { usePolling } from '@/hooks/usePolling';
import { useEffect, useState } from 'react';
import './dashboard.css';

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

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [clock, setClock] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'threats' | 'behavior' | 'policy'>('overview');

  // ── Polling all data sources ───
  const { data: incidentData, hasUpdated: incidentUpdated } = usePolling<{ incidents: Incident[]; stats: Stats }>('/api/incident', 3000);
  const { data: cacheData, hasUpdated: cacheUpdated } = usePolling<{ cache: ThreatCacheEntry[] }>('/api/cache', 3000);
  const { data: summaryData, hasUpdated: summaryUpdated } = usePolling<{ summaries: AISummary[] }>('/api/summary', 3000);
  const { data: behaviorData, hasUpdated: behaviorUpdated } = usePolling<{ scores: BehaviorScore[] }>('/api/behavior', 3000);
  const { data: policyData, hasUpdated: policyUpdated } = usePolling<{ decisions: PolicyDecision[] }>('/api/policy', 3000);

  // ── Clock ───
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Redirect if not authenticated ───
  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Memuat...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }
    return null;
  }

  const stats = incidentData?.stats;
  const incidents = incidentData?.incidents || [];
  const cache = cacheData?.cache || [];
  const summaries = summaryData?.summaries || [];
  const scores = behaviorData?.scores || [];
  const decisions = policyData?.decisions || [];
  const myScore = scores.find(s => s.email === user.email);

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
            <span className="topbar-title">Human <strong>Firewall</strong></span>
          </div>
          <nav className="topbar-nav">
            {(['overview', 'threats', 'behavior', 'policy'] as const).map(tab => (
              <button
                key={tab}
                className={`nav-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' ? '📊 Overview' : tab === 'threats' ? '🔍 Threats' : tab === 'behavior' ? '👤 Behavior' : '⚖️ Policy'}
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
          <div className="user-badge" onClick={logout} title="Klik untuk logout">
            <span className="user-avatar">{user.userName.charAt(0).toUpperCase()}</span>
            <span className="user-name">{user.userName}</span>
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

            {/* My Score Card */}
            {myScore && (
              <div className="my-score-card glass-card fade-up-1">
                <div className="my-score-header">
                  <div className="my-score-avatar">{myScore.userName.charAt(0)}</div>
                  <div className="my-score-info">
                    <h3>{myScore.userName}</h3>
                    <span className="my-score-division">{myScore.division}</span>
                  </div>
                  <div className={`badge badge-${myScore.risk}`}>{myScore.risk.toUpperCase()}</div>
                </div>
                <div className="my-score-body">
                  <div className="score-ring-container">
                    <svg className="score-ring" viewBox="0 0 120 120">
                      <circle className="score-ring-bg" cx="60" cy="60" r="52" />
                      <circle
                        className="score-ring-fill"
                        cx="60" cy="60" r="52"
                        style={{
                          strokeDasharray: `${(myScore.score / 100) * 326.73} 326.73`,
                          stroke: myScore.score >= 70 ? 'var(--success)' : myScore.score >= 40 ? 'var(--warning)' : 'var(--danger)',
                        }}
                      />
                    </svg>
                    <div className="score-ring-value">
                      <span className="score-number">{myScore.score}</span>
                      <span className="score-label">Score</span>
                    </div>
                  </div>
                  <div className="my-score-stats">
                    <div className="mini-stat">
                      <span className="mini-stat-icon">🏆</span>
                      <span className="mini-stat-value">#{myScore.rank}</span>
                      <span className="mini-stat-label">Rank</span>
                    </div>
                    <div className="mini-stat">
                      <span className="mini-stat-icon">🔥</span>
                      <span className="mini-stat-value">{myScore.streak}</span>
                      <span className="mini-stat-label">Streak</span>
                    </div>
                    <div className="mini-stat">
                      <span className="mini-stat-icon">⭐</span>
                      <span className="mini-stat-value">{myScore.totalPoints}</span>
                      <span className="mini-stat-label">Points</span>
                    </div>
                    <div className="mini-stat">
                      <span className="mini-stat-icon">📚</span>
                      <span className="mini-stat-value">{myScore.trainingCompleted}</span>
                      <span className="mini-stat-label">Training</span>
                    </div>
                  </div>
                </div>
                {myScore.badges.length > 0 && (
                  <div className="my-score-badges">
                    {myScore.badges.map(b => (
                      <span key={b} className="badge-chip">{b}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Summary Panel */}
            {summaries.length > 0 && (
              <div className={`panel glass-card fade-up-2 ${summaryUpdated ? 'value-flash' : ''}`}>
                <div className="panel-header">
                  <h2 className="panel-title">🤖 AI Threat Summary</h2>
                  <span className="panel-badge">Powered by AI</span>
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
            <div className={`panel glass-card fade-up-3 ${incidentUpdated ? 'value-flash' : ''}`}>
              <div className="panel-header">
                <h2 className="panel-title">🚨 Insiden Terbaru</h2>
                <span className="panel-count">{incidents.length} total</span>
              </div>
              <div className="incident-list">
                {incidents.slice(0, 5).map(inc => (
                  <div key={inc.id} className="incident-row">
                    <div className="incident-icon">{typeIcon[inc.type] || '📋'}</div>
                    <div className="incident-info">
                      <div className="incident-title">{inc.description.substring(0, 80)}...</div>
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
          <>
            <div className={`panel glass-card fade-up ${cacheUpdated ? 'value-flash' : ''}`}>
              <div className="panel-header">
                <h2 className="panel-title">🔍 Threat Intelligence Cache</h2>
                <span className="panel-count">{cache.length} entries</span>
              </div>
              <div className="threat-table-wrap">
                <table className="threat-table">
                  <thead>
                    <tr>
                      <th>URL</th>
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
                          {entry.url.length > 40 ? entry.url.substring(0, 40) + '...' : entry.url}
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
          </>
        )}

        {/* ── BEHAVIOR TAB ───────────────────────────────── */}
        {activeTab === 'behavior' && (
          <>
            <div className={`panel glass-card fade-up ${behaviorUpdated ? 'value-flash' : ''}`}>
              <div className="panel-header">
                <h2 className="panel-title">👤 Employee Behavior Scores</h2>
                <span className="panel-count">{scores.length} employees</span>
              </div>
              <div className="leaderboard">
                {scores
                  .sort((a, b) => b.score - a.score)
                  .map((s, idx) => (
                    <div key={s.userId} className={`leaderboard-row ${s.email === user.email ? 'leaderboard-me' : ''}`}>
                      <div className="leaderboard-rank">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </div>
                      <div className="leaderboard-avatar">{s.userName.charAt(0)}</div>
                      <div className="leaderboard-info">
                        <div className="leaderboard-name">
                          {s.userName}
                          {s.email === user.email && <span className="you-badge">YOU</span>}
                        </div>
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
          </>
        )}

        {/* ── POLICY TAB ─────────────────────────────────── */}
        {activeTab === 'policy' && (
          <>
            <div className={`panel glass-card fade-up ${policyUpdated ? 'value-flash' : ''}`}>
              <div className="panel-header">
                <h2 className="panel-title">⚖️ Policy Decisions & Adaptive Enforcement</h2>
                <span className="panel-count">{decisions.length} decisions</span>
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
          </>
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="dashboard-footer">
        Human Firewall · Centralized Security Platform · Powered by Threat Intelligence
      </footer>
    </div>
  );
}
