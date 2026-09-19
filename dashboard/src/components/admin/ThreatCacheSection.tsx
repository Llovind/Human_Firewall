'use client';

import React, { useState } from 'react';
import { Sliders, Activity, Search, StopCircle, FileWarning, CheckCircle2, ShieldAlert, Trash2, Plus, X, HelpCircle } from 'lucide-react';
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
  block: <StopCircle size={14} style={{ color: 'var(--danger)', marginRight: '4px' }} />,
  warning: <FileWarning size={14} style={{ color: 'var(--warning)', marginRight: '4px' }} />,
  allow: <CheckCircle2 size={14} style={{ color: 'var(--success)', marginRight: '4px' }} />,
  notify_soc: <Activity size={14} style={{ color: 'var(--info)', marginRight: '4px' }} />,
};

export default function ThreatCacheSection({
  readOnly,
  cacheData,
  threatTypeFilter,
  threatActionFilter,
  onThreatTypeFilterChange,
  onThreatActionFilterChange
}: ThreatCacheSectionProps) {
  const [isAddingIOC, setIsAddingIOC] = useState(false);
  const [newIndicator, setNewIndicator] = useState('');
  const [newAction, setNewAction] = useState('block');
  const [newReason, setNewReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleExecuteAction = async (indicator: string, action: 'block' | 'allow' | 'purge', reason?: string) => {
    setActionLoading(`${action}-${indicator}`);
    try {
      const res = await fetch('/api/admin/threats/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicator, action, reason }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification(data.message || `Action ${action} executed successfully.`);
      } else {
        showNotification(data.error || 'Failed to execute threat action.', 'error');
      }
    } catch {
      showNotification('Network error executing threat action.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndicator.trim()) return;
    await handleExecuteAction(newIndicator.trim(), newAction as any, newReason.trim());
    setNewIndicator('');
    setNewReason('');
    setIsAddingIOC(false);
  };

  const threatChartData = Object.values(
    (cacheData || []).reduce((acc: any, item: ThreatCacheEntry) => {
      const date = item.detectedAt 
        ? new Date(item.detectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Today';
      acc[date] = acc[date] || { date, detections: 0 };
      acc[date].detections += 1;
      return acc;
    }, {})
  ).reverse();

  return (
    <div className="font-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', marginBottom: '48px' }}>
      {/* Action Notification Banner */}
      {feedbackMsg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '8px',
          background: feedbackMsg.type === 'success' ? 'var(--bg-success)' : 'var(--bg-danger)',
          color: feedbackMsg.type === 'success' ? 'var(--text-success)' : 'var(--text-danger)',
          border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--border-success)' : 'var(--border-danger)'}`,
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Horizontal Filter & Controls Bar */}
      <div className="glass-card fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px', width: '100%', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          <Sliders size={16} /> Telemetry & Feed Controls
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!readOnly && (
            <button
              onClick={() => setIsAddingIOC(true)}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Block / Add IOC
            </button>
          )}

          <select 
            className="filter-select font-body" 
            value={threatTypeFilter} 
            onChange={(e) => onThreatTypeFilterChange(e.target.value)}
            disabled={readOnly}
            style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px', cursor: readOnly ? 'default' : 'pointer', opacity: readOnly ? 0.7 : 1 }}
          >
            <option value="ALL">All Types</option>
            <option value="PHISHING_CLICK">Phishing Click</option>
            <option value="PHISHING_REPORT">Phishing Report</option>
            <option value="MALWARE_DETECTED">Malware Detected</option>
            <option value="SUSPICIOUS_URL">Suspicious URL</option>
            <option value="DLP_VIOLATION">DLP Violation</option>
          </select>
          <select 
            className="filter-select font-body" 
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

      {/* Add / Block IOC Modal */}
      {isAddingIOC && !readOnly && (
        <div className="glass-card fade-up" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-accent)', background: 'var(--bg-elevated)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <ShieldAlert size={16} style={{ color: 'var(--danger)' }} /> Manual Threat Intelligence Action
            </h3>
            <button onClick={() => setIsAddingIOC(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  INDICATOR (URL / DOMAIN / HASH)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. https://malicious-portal.com/login or sha256"
                  value={newIndicator}
                  onChange={(e) => setNewIndicator(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  ACTION
                </label>
                <select
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                >
                  <option value="block">BLOCK IMMEDIATELY</option>
                  <option value="allow">ALLOW / WHITELIST</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                REASON / NOTES (OPTIONAL)
              </label>
              <input
                type="text"
                placeholder="e.g. Confirmed phishing domain reported in SOC incident"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setIsAddingIOC(false)}
                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading !== null}
                style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                {actionLoading ? 'Executing...' : 'Apply IOC Policy'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Panels (Full Width) */}
      <div className="panel glass-card fade-up" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <h2 className="panel-title font-heading" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} /> Daily Threat Detections
          </h2>
        </div>
        <div style={{ height: '200px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={threatChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} className="font-mono-data" />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} className="font-mono-data" />
              <Tooltip 
                cursor={false}
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--accent-bright)' }}
              />
              <Bar dataKey="detections" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={32} isAnimationActive={true} animationDuration={250} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel glass-card fade-up" style={{ marginBottom: 0 }}>
        <div className="panel-header">
          <h2 className="panel-title font-heading">
            <Search size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Unified Threat Intelligence Feed
          </h2>
          <span className="panel-count font-mono-data">
            {cacheData.filter(entry => {
              const matchesType = threatTypeFilter === 'ALL' || entry.threatType?.toUpperCase().includes(threatTypeFilter.toUpperCase());
              const matchesAction = threatActionFilter === 'ALL' || entry.action?.toUpperCase() === threatActionFilter.toUpperCase();
              return matchesType && matchesAction;
            }).length} of {cacheData.length} entries
          </span>
        </div>
        <div className="threat-table-wrap">
          <table className="threat-table">
            <thead>
              <tr>
                <th>Indicator / URL</th>
                <th>Type</th>
                <th>Confidence</th>
                <th>Source</th>
                <th>Action</th>
                <th>Detected</th>
                {!readOnly && <th style={{ textAlign: 'right' }}>Remediation</th>}
              </tr>
            </thead>
            <tbody>
              {cacheData
                .filter(entry => {
                  const matchesType = threatTypeFilter === 'ALL' || entry.threatType?.toUpperCase().includes(threatTypeFilter.toUpperCase());
                  const matchesAction = threatActionFilter === 'ALL' || entry.action?.toUpperCase() === threatActionFilter.toUpperCase();
                  return matchesType && matchesAction;
                })
                .map(entry => {
                  const isBlocked = entry.action === 'block';
                  return (
                    <tr key={entry.id}>
                      <td className="font-mono-data url-cell" title={entry.url}>
                        {entry.url && entry.url.length > 70 ? entry.url.substring(0, 70) + '...' : entry.url || 'N/A'}
                      </td>
                      <td><span className={`badge badge-${entry.action} font-body`}>{entry.threatType || 'THREAT'}</span></td>
                      <td>
                        <div className="score-bar-wrap">
                          <div
                            className="score-bar"
                            style={{
                              width: `${entry.score}%`,
                              background: entry.score >= 80 ? 'var(--danger)' : entry.score >= 50 ? 'var(--warning)' : 'var(--success)',
                            }}
                          />
                          <span className="score-bar-label font-mono-data">{entry.score}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '12px' }}>{entry.source}</td>
                      <td>
                        <span className={`badge badge-${entry.action || 'muted'} font-body`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {actionIcon[entry.action?.toLowerCase()] || <HelpCircle size={14} style={{ color: 'var(--text-muted)', marginRight: '4px' }} />} {(entry.action || 'UNKNOWN').toUpperCase()}
                        </span>
                      </td>
                      <td className="font-mono-data" style={{ fontSize: '12px' }}>{timeAgo(entry.detectedAt)}</td>
                      {!readOnly && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {!isBlocked && (
                              <button
                                title="Block Indicator"
                                disabled={actionLoading === `block-${entry.url}`}
                                onClick={() => handleExecuteAction(entry.url, 'block')}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-danger)',
                                  background: 'var(--bg-danger)',
                                  color: 'var(--text-danger)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                }}
                              >
                                Block
                              </button>
                            )}
                            <button
                              title="Purge Cache"
                              disabled={actionLoading === `purge-${entry.url}`}
                              onClick={() => handleExecuteAction(entry.url, 'purge')}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
