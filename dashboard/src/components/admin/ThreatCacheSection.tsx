'use client';

import React from 'react';
import { Sliders, Activity, Search, StopCircle, FileWarning, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ThreatCacheEntry, timeAgo } from '@/components/admin/types';
import '@/app/dashboard.css';

interface ThreatCacheSectionProps {
  readOnly: boolean;
  cacheData: ThreatCacheEntry[];
  threatTypeFilter: string;
  threatActionFilter: string;
  onThreatTypeFilterChange: (val: string) => void;
  onThreatActionFilterChange: (val: string) => void;
}

const actionIcon: Record<string, React.ReactNode> = {
  block: <StopCircle size={16} style={{ color: 'var(--danger)', marginRight: '4px' }} />,
  warning: <FileWarning size={16} style={{ color: 'var(--warning)', marginRight: '4px' }} />,
  allow: <CheckCircle2 size={16} style={{ color: 'var(--success)', marginRight: '4px' }} />,
  notify_soc: <Activity size={16} style={{ color: 'var(--info)', marginRight: '4px' }} />,
};

export default function ThreatCacheSection({
  readOnly,
  cacheData,
  threatTypeFilter,
  threatActionFilter,
  onThreatTypeFilterChange,
  onThreatActionFilterChange
}: ThreatCacheSectionProps) {
  const threatChartData = Object.values(
    (cacheData || []).reduce((acc: any, item: ThreatCacheEntry) => {
      const date = new Date(item.detectedAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
      acc[date] = acc[date] || { date, deteksi: 0 };
      acc[date].deteksi += 1;
      return acc;
    }, {})
  ).reverse();

  return (
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
                  onChange={(e) => onThreatTypeFilterChange(e.target.value)}
                  disabled={readOnly}
                  style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px', cursor: readOnly ? 'default' : 'pointer', opacity: readOnly ? 0.7 : 1 }}
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
                  onChange={(e) => onThreatActionFilterChange(e.target.value)}
                  disabled={readOnly}
                  style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px', cursor: readOnly ? 'default' : 'pointer', opacity: readOnly ? 0.7 : 1 }}
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

            <div className={`panel glass-card fade-up`} style={{ marginBottom: 0 }}>
              <div className="panel-header">
                <h2 className="panel-title"><Search size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Threat Intelligence Cache</h2>
                <span className="panel-count">
                  {cacheData.filter(entry => {
                    const matchesType = threatTypeFilter === 'ALL' || entry.threatType.toUpperCase() === threatTypeFilter.toUpperCase();
                    const matchesAction = threatActionFilter === 'ALL' || entry.action.toUpperCase() === threatActionFilter.toUpperCase();
                    return matchesType && matchesAction;
                  }).length} dari {cacheData.length} entri
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
                    {cacheData
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
          </div>
  );
}
