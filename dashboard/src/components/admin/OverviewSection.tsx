'use client';

import React from 'react';
import type { Stats, Incident, ThreatCacheEntry, AISummary, BehaviorScore, ComplianceSummary } from '@/components/admin/types';
import { timeAgo } from '@/components/admin/types';
import { AlertTriangle, Activity, Shield, TrendingUp, Bot } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
  onSelectIncident,
}: OverviewSectionProps) {
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
    const sev = inc.severity.toLowerCase();
    if (sev === 'critical') acc['Critical'] = (acc['Critical'] || 0) + 1;
    else if (sev === 'high') acc['High'] = (acc['High'] || 0) + 1;
    else if (sev === 'medium') acc['Medium'] = (acc['Medium'] || 0) + 1;
    else if (sev === 'low') acc['Low'] = (acc['Low'] || 0) + 1;
    return acc;
  }, { 'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0 });

  const severityChartData = Object.entries(severityCounts).map(([name, value]) => ({ name, value: value as number }));
  const totalSeverityCount = severityChartData.reduce((sum, item) => sum + item.value, 0);

  return (
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

      {/* Bento Grid: AI Threat Summary & Divisional Risk Map */}
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
                      {s.threatLevel.toUpperCase()}
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
      </div>
    </>
  );
}
