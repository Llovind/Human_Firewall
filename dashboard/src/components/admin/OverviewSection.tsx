'use client';

import React, { useState } from 'react';
import type { Stats, Incident, ThreatCacheEntry, AISummary, BehaviorScore, ComplianceSummary } from '@/components/admin/types';
import { timeAgo } from '@/components/admin/types';
import { AlertTriangle, Activity, Shield, TrendingUp, Bot, Users, Trophy, ShieldAlert, ShieldCheck, Info, Flame, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TremorDonutCard } from '@/components/admin/TremorDonutCard';
import { TrendBadge } from '@/components/admin/TrendBadge';

interface OverviewSectionProps {
  readOnly: boolean;
  stats: Stats | undefined;
  incidents: Incident[];
  summaries: AISummary[];
  scores: BehaviorScore[];
  cache: ThreatCacheEntry[];
  complianceData: ComplianceSummary | null;
  incidentUpdated: boolean;
  cacheUpdated: boolean;
  summaryUpdated: boolean;
  behaviorUpdated: boolean;
  onSelectIncident?: (inc: Incident) => void;
}

export default function OverviewSection({
  readOnly,
  stats,
  incidents,
  summaries,
  scores,
  cache,
  complianceData,
  incidentUpdated,
  cacheUpdated,
  summaryUpdated,
  behaviorUpdated,
  onSelectIncident
}: OverviewSectionProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerateBrief = async () => {
    setIsRegenerating(true);
    try {
      await fetch('/api/ai/classify', { method: 'POST' });
      await fetch('/api/summary');
    } catch {
      // ignore
    } finally {
      setIsRegenerating(false);
    }
  };
  // Chart Data Calculations
  const divScores = scores.reduce((acc: any, user: BehaviorScore) => {
    if (!acc[user.division]) acc[user.division] = { total: 0, count: 0 };
    acc[user.division].total += user.score;
    acc[user.division].count += 1;
    return acc;
  }, {});

  const divisionChartData = Object.entries(divScores).map(([name, data]: [string, any]) => ({
    name,
    score: Math.min(100, Math.round(data.total / data.count))
  })).sort((a, b) => b.score - a.score);

  const severityCounts = incidents.reduce((acc: any, inc: Incident) => {
    const sev = (inc.severity || '').toLowerCase();
    if (sev === 'critical') acc['Critical'] = (acc['Critical'] || 0) + 1;
    else if (sev === 'high') acc['High'] = (acc['High'] || 0) + 1;
    else if (sev === 'medium') acc['Medium'] = (acc['Medium'] || 0) + 1;
    else if (sev === 'low') acc['Low'] = (acc['Low'] || 0) + 1;
    return acc;
  }, { 'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0 });

  const donutSeverityData = [
    { name: 'Critical Severity', value: severityCounts['Critical'] || 0, color: 'var(--danger)' },
    { name: 'High Severity', value: severityCounts['High'] || 0, color: 'var(--warning)', borderColor: 'var(--border-warning)' },
    { name: 'Medium Severity', value: severityCounts['Medium'] || 0, color: 'var(--info)' },
    { name: 'Low / Safe', value: severityCounts['Low'] || 0, color: 'var(--success)' },
  ];

  // Dynamic telemetry calculations from Single Source of Truth
  const resolvedCount = Math.max(0, (stats?.totalIncidents ?? incidents.length) - (stats?.openIncidents ?? incidents.filter(i => i.status !== 'resolved').length));
  const criticalCount = stats?.criticalIncidents ?? (severityCounts['Critical'] || 0);
  const avgScore = stats?.avgBehaviorScore ?? (scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : 0);
  const scorePosture = avgScore >= 80 ? 'Optimal' : avgScore >= 50 ? 'Moderate' : 'High Risk';
  const scorePostureType = avgScore >= 80 ? 'success' : avgScore >= 50 ? 'warning' : 'danger';
  const cachedRulesCount = stats?.blockedUrls ?? cache.length;

  // Single Source of Truth: Sort champions (top scores/points) and at-risk personnel (lowest scores)
  const sortedByScore = [...scores].sort((a, b) => b.score - a.score || b.totalPoints - a.totalPoints);
  const champions = sortedByScore.slice(0, 3);
  const atRisk = [...scores].sort((a, b) => a.score - b.score || a.totalPoints - b.totalPoints).slice(0, 3);

  const optimalCount = scores.filter(s => s.score >= 80).length;
  const moderateCount = scores.filter(s => s.score >= 50 && s.score < 80).length;
  const needsAttentionCount = scores.filter(s => s.score < 50).length;

  return (
    <>
      {/* Stats Row */}
      <div className="stats-grid fade-up font-body">
        <div className={`stat-card glass-card ${incidentUpdated ? 'value-flash' : ''}`}>
          <div className="stat-icon stat-icon-danger"><AlertTriangle size={26} /></div>
          <div className="stat-value font-mono-data">{stats?.totalIncidents ?? incidents.length}</div>
          <div className="stat-label">Total Incidents</div>
          <div style={{ marginTop: '10px' }}>
            <TrendBadge type="danger" value={criticalCount} suffix=" critical" iconType="arrow" />
          </div>
        </div>
        <div className={`stat-card glass-card ${incidentUpdated ? 'value-flash' : ''}`}>
          <div className="stat-icon stat-icon-warning"><Activity size={26} /></div>
          <div className="stat-value font-mono-data">{stats?.openIncidents ?? incidents.filter(i => i.status !== 'resolved').length}</div>
          <div className="stat-label">Open Incidents</div>
          <div style={{ marginTop: '10px' }}>
            <TrendBadge type="success" value={resolvedCount} suffix=" resolved" iconType="arrow" />
          </div>
        </div>
        <div className={`stat-card glass-card ${cacheUpdated ? 'value-flash' : ''}`}>
          <div className="stat-icon stat-icon-accent"><Shield size={26} /></div>
          <div className="stat-value font-mono-data">{cachedRulesCount}</div>
          <div className="stat-label">Blocked URLs</div>
          <div style={{ marginTop: '10px' }}>
            <TrendBadge type="info" value={cachedRulesCount} suffix=" active rules" iconType="arrow" />
          </div>
        </div>
        <div className={`stat-card glass-card ${behaviorUpdated ? 'value-flash' : ''}`}>
          <div className="stat-icon stat-icon-success"><TrendingUp size={26} /></div>
          <div className="stat-value font-mono-data">{avgScore || 0}</div>
          <div className="stat-label">Avg. Behavior Score</div>
          <div style={{ marginTop: '10px' }}>
            <TrendBadge type={scorePostureType} value={scorePosture} iconType="trend" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-grid fade-up font-body">
        {/* Security Posture by Division Bar Chart */}
        <div className="chart-card glass-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title font-heading">Security Posture by Division</h3>
              <p style={{ fontSize: '12px', color: '#526f99', margin: '4px 0 0 0' }}>
                Average behavioral score and security compliance by department
              </p>
            </div>
            <span className="chart-badge font-mono-data">Score 0-100</span>
          </div>
          <div className="chart-container bar-chart">
            {divisionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={divisionChartData}
                  margin={{ top: 5, right: 20, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(144, 202, 249, 0.2)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--text-secondary)" fontSize={11} className="font-mono-data" />
                  <YAxis type="category" dataKey="name" stroke="var(--text-secondary)" fontSize={12} width={120} className="font-body" />
                  <Tooltip
                    cursor={false}
                    contentStyle={{ background: '#ffffff', border: '1px solid rgba(13, 71, 161, 0.15)', borderRadius: '8px', boxShadow: '0 4px 14px rgba(13, 71, 161, 0.1)' }}
                    itemStyle={{ color: '#091b38', fontWeight: 600 }}
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
              <div className="chart-empty-state">No division activity data available</div>
            )}
          </div>
        </div>

        {/* Tremor-Style Donut Chart Card */}
        <TremorDonutCard
          title="Incident Severity Distribution"
          description="Real-time proportion of threat severity levels across active triage events"
          data={donutSeverityData}
          totalLabel="Total Incidents"
          unit="tickets"
        />
      </div>

      {/* Bento Grid: Threat Intelligence & Risk Synthesis & Human Telemetry Spotlight */}
      <div className="admin-overview-grid font-body">
        {/* Threat Intelligence Synthesis Panel */}
        <div className={`panel glass-card fade-up-1 ${summaryUpdated ? 'value-flash' : ''}`} style={{ marginBottom: 0 }}>
          <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="panel-title font-heading"><ShieldAlert size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom", color: "var(--accent)" }} /> Threat Intelligence & Risk Synthesis</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="panel-badge" style={{ background: 'rgba(33, 150, 243, 0.08)', color: 'var(--accent)', borderColor: 'rgba(33, 150, 243, 0.3)' }}>Live Telemetry</span>
              {!readOnly && (
                <button
                  onClick={handleRegenerateBrief}
                  disabled={isRegenerating}
                  title="Synthesize / Refresh Threat Intelligence Synthesis"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: isRegenerating ? 'default' : 'pointer',
                    opacity: isRegenerating ? 0.6 : 1
                  }}
                >
                  <RefreshCw size={11} className={isRegenerating ? 'spin-icon' : ''} />
                  {isRegenerating ? 'Synthesizing...' : 'Refresh'}
                </button>
              )}
            </div>
          </div>
          <div className="summary-list">
            {summaries.length > 0 ? (
              summaries.slice(0, 3).map(s => (
                <div key={s.id} className="summary-item">
                  <div className="summary-meta">
                    <span className={`badge badge-${s.threatLevel}`}>
                      {s.threatLevel.toUpperCase()}
                    </span>
                    <span className="summary-time font-mono-data">{timeAgo(s.timestamp)}</span>
                  </div>
                  <h3 className="summary-title font-heading">{s.title}</h3>
                  <p className="summary-text">{s.summary}</p>
                  {s.recommendations.length > 0 && (
                    <div className="summary-recs">
                      <span className="rec-label">Recommendations:</span>
                      <ul>
                        {s.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Awaiting threat telemetry for LLM analysis...
              </div>
            )}
          </div>
        </div>

        {/* ── Column 2: Human Telemetry Spotlight ── */}
        <div className="panel glass-card fade-up-2" style={{
          marginBottom: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          height: '100%'
        }}>
          <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '16px' }}>
              <h2 className="panel-title font-heading" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: '#2196F3' }} /> Human Telemetry Spotlight
              </h2>
              <span className="font-mono-data" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', background: 'rgba(33, 150, 243, 0.1)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                {scores.length} Personnel
              </span>
            </div>

            {/* Roster Distribution KPI Strip - Desaturated subtle backgrounds */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-success)', border: '1px solid var(--border-success)', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <div className="font-mono-data" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-success)', lineHeight: 1 }}>{optimalCount}</div>
                <div className="font-body" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.04em' }}>Optimal</div>
              </div>
              <div style={{ background: 'var(--bg-warning)', border: '1px solid var(--border-warning)', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <div className="font-mono-data" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-warning)', lineHeight: 1 }}>{moderateCount}</div>
                <div className="font-body" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.04em' }}>Moderate</div>
              </div>
              <div style={{ background: 'var(--bg-danger)', border: '1px solid var(--border-danger)', borderRadius: '10px', padding: '10px 8px', textAlign: 'center' }}>
                <div className="font-mono-data" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-danger)', lineHeight: 1 }}>{needsAttentionCount}</div>
                <div className="font-body" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.04em' }}>At Risk</div>
              </div>
            </div>

            {/* Top Performers */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <ShieldCheck size={15} style={{ color: 'var(--text-success)' }} />
                <span className="font-body" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  Top Performers
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {champions.length > 0 ? (
                  champions.map((u, i) => {
                    const displayName = u.userName || (u.email ? u.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Employee');
                    const initials = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

                    return (
                      <div key={u.userId || i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div className="font-mono-data" style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '11px',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="font-body" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                              {displayName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{u.division}</span>
                              <span>•</span>
                              <span className="font-mono-data" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Flame size={12} style={{ color: 'var(--text-muted)' }} />
                                {u.streak || 0} wks clean
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span className="font-mono-data" style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)'
                          }}>
                            {u.score} pts
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                    No performer records available
                  </div>
                )}
              </div>
            </div>

            {/* At-Risk Personnel */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <AlertTriangle size={15} style={{ color: 'var(--text-danger)' }} />
                <span className="font-body" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  At-Risk Personnel
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {atRisk.length > 0 ? (
                  atRisk.map((u, i) => {
                    const displayName = u.userName || (u.email ? u.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Employee');
                    const initials = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

                    return (
                      <div key={u.userId || i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        borderLeft: '3px solid var(--danger)',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div className="font-mono-data" style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '11px',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="font-body" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>
                              {displayName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{u.division}</span>
                              <span>•</span>
                              <span className="font-body" style={{ color: 'var(--text-danger)', fontWeight: 700 }}>
                                {u.risk?.toUpperCase() || 'HIGH RISK'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span className="font-mono-data" style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)'
                          }}>
                            {u.score} pts
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                    No risk records available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actionable Prompt Note */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <Info size={16} style={{ color: '#2196F3', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>SOC Remediation Target:</span> Automated intervention training is scheduled for employees with scores &lt; 50 to minimize phishing click rates.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
