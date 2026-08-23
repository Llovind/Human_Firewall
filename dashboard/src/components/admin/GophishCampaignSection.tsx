'use client';

import React, { useState } from 'react';
import { 
  Fish, RefreshCw, Play, Users, Eye, Trash2, Pencil, Mail, Plus, Globe, 
  X, CheckCircle, AlertTriangle, ShieldAlert, MousePointer, Lock, ArrowRight, Clock, StopCircle
} from 'lucide-react';
import { GoPhishCampaign, GoPhishResource } from '@/components/admin/types';

interface GophishCampaignSectionProps {
  readOnly: boolean;
  campaigns: GoPhishCampaign[];
  employees: any[];
  divisions: any[];
  resources: GoPhishResource | null;
  selectedEmails: string[];
  onSelectedEmailsChange: (emails: string[]) => void;
  onSyncUsers: () => void;
  onOpenLaunchModal: () => void;
  onDeleteCampaign: (id: number) => void;
  onCompleteCampaign?: (id: number) => Promise<boolean | void> | void;
  onViewCampaignDetail?: (id: number) => void;
  onOpenTemplateBuilder: (mode: 'new' | 'edit', type: 'template' | 'page', item?: any) => void;
  onDeleteTemplate: (id: number) => void;
  onDeletePage: (id: number) => void;
}

export function getCampaignStats(c: GoPhishCampaign) {
  if (c.stats && typeof c.stats.sent === 'number' && (c.stats.sent > 0 || c.stats.opened > 0 || c.stats.clicked > 0 || c.stats.submitted_data > 0)) {
    return {
      total: c.stats.total || c.stats.sent || 1,
      sent: c.stats.sent,
      opened: c.stats.opened,
      clicked: c.stats.clicked,
      submitted_data: c.stats.submitted_data,
      error: (c.stats as any).error || 0
    };
  }

  const results: any[] = (c as any).results || [];
  const timeline: any[] = (c as any).timeline || [];
  const sent = new Set<string>();
  const opened = new Set<string>();
  const clicked = new Set<string>();
  const submitted_data = new Set<string>();
  const error = new Set<string>();

  results.forEach(r => {
    const st = (r.status || '').toLowerCase();
    const em = r.email;
    if (!em) return;
    if (st.includes('sent') || st.includes('open') || st.includes('click') || st.includes('submit') || st.includes('success')) sent.add(em);
    if (st.includes('open') || st.includes('click') || st.includes('submit')) opened.add(em);
    if (st.includes('click') || st.includes('submit')) clicked.add(em);
    if (st.includes('submit')) submitted_data.add(em);
    if (st.includes('error')) error.add(em);
  });

  timeline.forEach(ev => {
    const msg = (ev.message || '').toLowerCase();
    const em = ev.email;
    if (!em) return;
    if (msg.includes('sent')) sent.add(em);
    if (msg.includes('open') || msg.includes('opened')) opened.add(em);
    if (msg.includes('click') || msg.includes('clicked')) clicked.add(em);
    if (msg.includes('submit') || msg.includes('submitted')) submitted_data.add(em);
    if (msg.includes('error')) error.add(em);
  });

  const total = results.length || sent.size || 1;
  return {
    total,
    sent: sent.size,
    opened: opened.size,
    clicked: clicked.size,
    submitted_data: submitted_data.size,
    error: error.size
  };
}

export default function GophishCampaignSection({
  readOnly,
  campaigns,
  employees,
  divisions,
  resources,
  selectedEmails,
  onSelectedEmailsChange,
  onSyncUsers,
  onOpenLaunchModal,
  onDeleteCampaign,
  onCompleteCampaign,
  onViewCampaignDetail,
  onOpenTemplateBuilder,
  onDeleteTemplate,
  onDeletePage
}: GophishCampaignSectionProps) {
  const [gpEmployeeFilter, setGpEmployeeFilter] = useState('ALL');
  const [detailCampaign, setDetailCampaign] = useState<GoPhishCampaign | null>(null);
  const [stopModalCampaign, setStopModalCampaign] = useState<GoPhishCampaign | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  const handleConfirmStop = async () => {
    if (!stopModalCampaign) return;
    setIsStopping(true);
    setStopError(null);
    try {
      const res = await fetch(`/api/admin/gophish/campaigns/${stopModalCampaign.id}/complete`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        setStopError(data.error || data.detail || 'Failed to stop campaign.');
        setIsStopping(false);
        return;
      }
      // Notify parent to refresh campaigns state in-place
      if (onCompleteCampaign) {
        await onCompleteCampaign(stopModalCampaign.id);
      }
      setStopModalCampaign(null);
      setIsStopping(false);
    } catch (err: any) {
      setStopError(err.message || 'Failed to connect to server.');
      setIsStopping(false);
    }
  };

  // Compute aggregated stats
  const aggregate = campaigns.reduce(
    (acc, c) => {
      const s = getCampaignStats(c);
      acc.totalCampaigns += 1;
      acc.totalTargets += s.total;
      acc.totalSent += s.sent;
      acc.totalOpened += s.opened;
      acc.totalClicked += s.clicked;
      acc.totalSubmitted += s.submitted_data;
      return acc;
    },
    { totalCampaigns: 0, totalTargets: 0, totalSent: 0, totalOpened: 0, totalClicked: 0, totalSubmitted: 0 }
  );

  const overallOpenRate = aggregate.totalSent > 0 ? Math.round((aggregate.totalOpened / aggregate.totalSent) * 100) : 0;
  const overallClickRate = aggregate.totalSent > 0 ? Math.round((aggregate.totalClicked / aggregate.totalSent) * 100) : 0;
  const overallLeakRate = aggregate.totalSent > 0 ? Math.round((aggregate.totalSubmitted / aggregate.totalSent) * 100) : 0;

  const handleOpenDetail = (c: GoPhishCampaign) => {
    setDetailCampaign(c);
    if (onViewCampaignDetail) {
      onViewCampaignDetail(c.id);
    }
  };

  return (
    <div className="font-body">
      <div className="panel glass-card fade-up" style={{ marginBottom: '0' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="panel-title font-heading" style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Fish size={22} style={{ color: 'var(--accent)' }} /> GoPhish Command Center
            </h2>
            <p className="panel-desc" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Simulation orchestration console for tracking phishing telemetry, email delivery, click rates, and credential exposures.
            </p>
          </div>
          {!readOnly && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-action font-body"
                onClick={onSyncUsers}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'border-color 0.15s ease'
                }}
              >
                <RefreshCw size={15} /> Sync Target Group
              </button>
              <button
                className="btn-action font-body"
                onClick={onOpenLaunchModal}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.15s ease'
                }}
              >
                <Play size={15} /> Launch Simulation
              </button>
            </div>
          )}
        </div>

        {/* Target Selection panel for orchestration */}
        <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', padding: '18px 20px', marginBottom: '24px', marginLeft: '24px', marginRight: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 className="font-heading" style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Users size={16} style={{ color: 'var(--accent)' }} /> Target Selection
                <span className="font-mono-data" style={{ fontSize: '12px', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', marginLeft: '4px' }}>
                  {selectedEmails.length} selected
                </span>
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Select employee recipients to deploy into next simulation campaign group.
              </p>
            </div>
            {!readOnly && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={gpEmployeeFilter}
                  onChange={(e) => setGpEmployeeFilter(e.target.value)}
                  className="font-body"
                  style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                >
                  <option value="ALL">All Divisions</option>
                  {divisions.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                <button
                  onClick={() => {
                    const activeEmps = employees.filter(e => e.is_active === 1 && (gpEmployeeFilter === 'ALL' || e.divisi === gpEmployeeFilter));
                    onSelectedEmailsChange(activeEmps.map(e => e.email));
                  }}
                  className="font-body"
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                >
                  Select All
                </button>
                <button
                  onClick={() => onSelectedEmailsChange([])}
                  className="font-body"
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Target checklist grouped by division */}
          {(() => {
            const activeFilteredEmployees = employees
              .filter(emp => emp.is_active === 1)
              .filter(emp => gpEmployeeFilter === 'ALL' || emp.divisi === gpEmployeeFilter);

            const divisionGroups = activeFilteredEmployees.reduce((acc: Record<string, any[]>, emp) => {
              const divName = emp.divisi || 'General';
              if (!acc[divName]) acc[divName] = [];
              acc[divName].push(emp);
              return acc;
            }, {});

            return (
              <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {Object.keys(divisionGroups).length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px', fontSize: '12px' }}>
                    No active employees found matching the filter.
                  </div>
                ) : (
                  Object.entries(divisionGroups).map(([divName, divEmps]) => {
                    const selectedInDiv = divEmps.filter(e => selectedEmails.includes(e.email)).length;
                    return (
                      <div key={divName} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid var(--border)' }}>
                          <span className="font-heading" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                            {divName}
                          </span>
                          <span className="font-mono-data" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {selectedInDiv} of {divEmps.length} selected
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '6px' }}>
                          {divEmps.map(emp => {
                            const isChecked = selectedEmails.includes(emp.email);
                            return (
                              <label
                                key={emp.email}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 10px',
                                  background: isChecked ? 'rgba(33, 150, 243, 0.08)' : 'var(--bg-surface)',
                                  border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border)',
                                  borderRadius: '6px',
                                  cursor: readOnly ? 'default' : 'pointer',
                                  fontSize: '12px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={readOnly}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      onSelectedEmailsChange([...selectedEmails, emp.email]);
                                    } else {
                                      onSelectedEmailsChange(selectedEmails.filter(email => email !== emp.email));
                                    }
                                  }}
                                  style={{ accentColor: 'var(--accent)' }}
                                />
                                <span className="font-mono-data" title={emp.email} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.email}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })()}
        </div>

        {/* ── High-Clarity Telemetry Summary Cards (5 KPI Pillars) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          padding: '0 24px',
          marginBottom: '24px'
        }}>
          {/* Card 1: Total Campaigns */}
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>Total Campaigns</span>
              <Fish size={15} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="font-mono-data" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {aggregate.totalCampaigns}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>simulations</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {campaigns.filter(c => c.status === 'In progress' || c.status === 'In Progress').length} in progress
            </div>
          </div>

          {/* Card 2: Emails Sent */}
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>Emails Sent</span>
              <Mail size={15} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="font-mono-data" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {aggregate.totalSent}
              </span>
              <span className="font-mono-data" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                / {aggregate.totalTargets} targets
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {aggregate.totalTargets > 0 ? `${Math.round((aggregate.totalSent / aggregate.totalTargets) * 100)}% delivery rate` : '0% delivery'}
            </div>
          </div>

          {/* Card 3: Emails Opened */}
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>Emails Opened</span>
              <Eye size={15} style={{ color: 'var(--warning)' }} />
            </div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="font-mono-data" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--warning)' }}>
                {aggregate.totalOpened}
              </span>
              <span className="font-mono-data" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-warning)', background: 'var(--bg-warning)', border: '1px solid var(--border-warning)', padding: '1px 6px', borderRadius: '4px' }}>
                {overallOpenRate}% Rate
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {aggregate.totalSent > 0 ? `${aggregate.totalOpened} of ${aggregate.totalSent} recipients opened` : 'Awaiting opens'}
            </div>
          </div>

          {/* Card 4: Phishing Clicked */}
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>Phishing Clicked</span>
              <MousePointer size={15} style={{ color: 'var(--danger)' }} />
            </div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="font-mono-data" style={{ fontSize: '26px', fontWeight: 700, color: 'var(--danger)' }}>
                {aggregate.totalClicked}
              </span>
              <span className="font-mono-data" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-danger)', background: 'var(--bg-danger)', border: '1px solid var(--border-danger)', padding: '1px 6px', borderRadius: '4px' }}>
                {overallClickRate}% Rate
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {aggregate.totalSent > 0 ? `${aggregate.totalClicked} users fell for phishing link` : 'Awaiting clicks'}
            </div>
          </div>

          {/* Card 5: Credential Leaks */}
          <div style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>Credential Leaks</span>
              <ShieldAlert size={15} style={{ color: aggregate.totalSubmitted > 0 ? 'var(--danger)' : 'var(--text-muted)' }} />
            </div>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="font-mono-data" style={{ fontSize: '26px', fontWeight: 700, color: aggregate.totalSubmitted > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {aggregate.totalSubmitted}
              </span>
              <span className="font-mono-data" style={{ fontSize: '12px', fontWeight: 600, color: aggregate.totalSubmitted > 0 ? 'var(--text-danger)' : 'var(--text-neutral)', background: aggregate.totalSubmitted > 0 ? 'var(--bg-danger)' : 'var(--bg-neutral)', border: `1px solid ${aggregate.totalSubmitted > 0 ? 'var(--border-danger)' : 'var(--border-neutral)'}`, padding: '1px 6px', borderRadius: '4px' }}>
                {overallLeakRate}% Rate
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {aggregate.totalClicked > 0 
                ? `${aggregate.totalSubmitted} of ${aggregate.totalClicked} clicks converted to credential leaks`
                : (aggregate.totalSent > 0 ? `${aggregate.totalSubmitted} of ${aggregate.totalSent} recipients compromised` : '0 compromised')}
            </div>
          </div>
        </div>

        {/* ── Campaigns Data Table ── */}
        <div className="threat-table-wrap" style={{ margin: '0 24px 24px 24px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          <table className="threat-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ID</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Campaign Name</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sent / Targets</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Opened</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clicked</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Credential Leaks</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No simulation campaigns deployed yet. {readOnly ? '' : 'Click "Launch Simulation" to deploy targets.'}
                  </td>
                </tr>
              ) : (
                campaigns.map(c => {
                  const s = getCampaignStats(c);
                  const openPct = s.sent > 0 ? Math.round((s.opened / s.sent) * 100) : 0;
                  const clickPct = s.sent > 0 ? Math.round((s.clicked / s.sent) * 100) : 0;
                  const leakPct = s.sent > 0 ? Math.round((s.submitted_data / s.sent) * 100) : 0;
                  const isInProgress = (c.status || '').toLowerCase().includes('progress');

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="font-mono-data" style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        #{c.id}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div
                          onClick={() => handleOpenDetail(c)}
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          title="Click to view detailed campaign telemetry"
                        >
                          <span>{c.name}</span>
                        </div>
                        {c.created_date && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Created: {new Date(c.created_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          className="font-body"
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            background: isInProgress ? 'var(--bg-warning)' : 'var(--bg-success)',
                            color: isInProgress ? 'var(--text-warning)' : 'var(--text-success)',
                            border: `1px solid ${isInProgress ? 'var(--border-warning)' : 'var(--border-success)'}`
                          }}
                        >
                          {c.status || 'Completed'}
                        </span>
                      </td>
                      
                      {/* Sent */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div className="font-mono-data" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {s.sent} <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>/ {s.total}</span>
                        </div>
                      </td>

                      {/* Opened */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div className="font-mono-data" style={{ fontSize: '13px', fontWeight: 600, color: s.opened > 0 ? 'var(--text-warning)' : 'var(--text-muted)' }}>
                          {s.opened} <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>/ {s.sent}</span>
                        </div>
                      </td>

                      {/* Clicked */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div className="font-mono-data" style={{ fontSize: '13px', fontWeight: 600, color: s.clicked > 0 ? 'var(--text-danger)' : 'var(--text-muted)' }}>
                          {s.clicked} <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>/ {s.sent}</span>
                        </div>
                      </td>

                      {/* Credential Leaks */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div className="font-mono-data" style={{ fontSize: '13px', fontWeight: 700, color: s.submitted_data > 0 ? 'var(--text-danger)' : 'var(--text-muted)' }} title={`${s.submitted_data} of ${s.clicked} clicks converted to credential leaks`}>
                          {s.submitted_data} <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>/ {s.sent}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenDetail(c)}
                            title="View campaign telemetry"
                            style={{
                              padding: '6px 10px',
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: 'var(--accent)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: 600
                            }}
                          >
                            <Eye size={14} /> View
                          </button>
                          {!readOnly && isInProgress && (
                            <button
                              onClick={() => {
                                setStopModalCampaign(c);
                                setStopError(null);
                              }}
                              title="Stop campaign simulation"
                              style={{
                                padding: '6px 8px',
                                background: 'var(--bg-warning)',
                                border: '1px solid var(--border-warning)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: 'var(--text-warning)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                fontWeight: 600
                              }}
                            >
                              <StopCircle size={14} /> Stop
                            </button>
                          )}
                          {!readOnly && (
                            <button
                              onClick={() => onDeleteCampaign(c.id)}
                              title="Delete campaign"
                              style={{
                                padding: '6px 8px',
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: 'var(--danger)'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Custom Phishing Resources (Template & Landing Page) ── */}
      <div className="panel glass-card fade-up" style={{ marginTop: '24px', marginBottom: '48px' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="panel-title font-heading" style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Pencil size={18} style={{ color: 'var(--accent)' }} /> Phishing Resource Hub
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Configure custom email simulation pretexts and fake portal landing pages.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '0 24px 24px 24px' }}>
          {/* Email Templates */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="font-heading" style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Mail size={15} style={{ color: 'var(--accent)' }} /> Email Templates ({resources?.templates?.length ?? 0})
              </h3>
              {!readOnly && (
                <button
                  onClick={() => onOpenTemplateBuilder('new', 'template')}
                  className="font-body"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--accent)', border: 'none', color: '#ffffff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                >
                  <Plus size={14} /> Create Template
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {(resources?.templates?.length ?? 0) === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                  No email templates created yet.
                </div>
              ) : (
                resources!.templates.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{t.subject || 'No subject'}</div>
                    </div>
                    {!readOnly && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => onOpenTemplateBuilder('edit', 'template', t)} title="Edit" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onDeleteTemplate(t.id)} title="Delete" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Landing Pages */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="font-heading" style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Globe size={15} style={{ color: 'var(--accent)' }} /> Landing Pages ({resources?.pages?.length ?? 0})
              </h3>
              {!readOnly && (
                <button
                  onClick={() => onOpenTemplateBuilder('new', 'page')}
                  className="font-body"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--accent)', border: 'none', color: '#ffffff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                >
                  <Plus size={14} /> Create Page
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {(resources?.pages?.length ?? 0) === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                  No landing pages created yet.
                </div>
              ) : (
                resources!.pages.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {p.capture_credentials ? 'Credentials Capture: Active' : 'No credential capture'}
                      </div>
                    </div>
                    {!readOnly && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => onOpenTemplateBuilder('edit', 'page', p)} title="Edit" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onDeletePage(p.id)} title="Delete" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Built-in Campaign Detail Modal ── */}
      {detailCampaign && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-elevated)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 className="font-heading" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {detailCampaign.name}
                  </h3>
                  <span className="font-mono-data" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    #{detailCampaign.id}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: (detailCampaign.status || '').toLowerCase().includes('progress') ? 'var(--bg-warning)' : 'var(--bg-success)',
                      color: (detailCampaign.status || '').toLowerCase().includes('progress') ? 'var(--text-warning)' : 'var(--text-success)',
                      border: `1px solid ${(detailCampaign.status || '').toLowerCase().includes('progress') ? 'var(--border-warning)' : 'var(--border-success)'}`
                    }}
                  >
                    {detailCampaign.status || 'Completed'}
                  </span>
                </div>
                {detailCampaign.created_date && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Simulation launched on {new Date(detailCampaign.created_date).toLocaleString('id-ID')}
                  </div>
                )}
              </div>
              <button
                onClick={() => setDetailCampaign(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Funnel Telemetry Bar */}
              {(() => {
                const s = getCampaignStats(detailCampaign);
                const openPct = s.sent > 0 ? Math.round((s.opened / s.sent) * 100) : 0;
                const clickPct = s.sent > 0 ? Math.round((s.clicked / s.sent) * 100) : 0;
                const leakPct = s.sent > 0 ? Math.round((s.submitted_data / s.sent) * 100) : 0;

                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px',
                    background: 'var(--bg-base)',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>1. Sent</div>
                      <div className="font-mono-data" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{s.sent}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>of {s.total} targets</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: 600, textTransform: 'uppercase' }}>2. Opened</div>
                      <div className="font-mono-data" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--warning)', marginTop: '4px' }}>{s.opened}</div>
                      <div style={{ fontSize: '11px', color: 'var(--warning)', marginTop: '2px' }}>{openPct}% of sent</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600, textTransform: 'uppercase' }}>3. Clicked</div>
                      <div className="font-mono-data" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--danger)', marginTop: '4px' }}>{s.clicked}</div>
                      <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>{clickPct}% click-through</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 700, textTransform: 'uppercase' }}>4. Leaked Credentials</div>
                      <div className="font-mono-data" style={{ fontSize: '20px', fontWeight: 800, color: 'var(--danger)', marginTop: '4px' }}>{s.submitted_data}</div>
                      <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600, marginTop: '2px' }}>{leakPct}% compromise</div>
                    </div>
                  </div>
                );
              })()}

              {/* Target Breakdown Table */}
              <div>
                <h4 className="font-heading" style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
                  Target Recipients Telemetry ({(detailCampaign as any).results?.length || 0})
                </h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>RECIPIENT EMAIL</th>
                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>NAME / ROLE</th>
                        <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>TELEMETRY STATUS</th>
                        <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>SEND TIME</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((detailCampaign as any).results || []).length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                            No recipient telemetry recorded for this campaign.
                          </td>
                        </tr>
                      ) : (
                        ((detailCampaign as any).results || []).map((r: any, idx: number) => {
                          const st = r.status || 'Queued';
                          let badgeColor = 'var(--text-muted)';
                          let bg = 'var(--bg-elevated)';
                          let border = 'var(--border)';
                          if (st.includes('Sent')) { badgeColor = 'var(--accent)'; bg = 'rgba(33, 150, 243, 0.12)'; border = 'var(--border)'; }
                          if (st.includes('Opened')) { badgeColor = 'var(--text-warning)'; bg = 'var(--bg-warning)'; border = 'var(--border-warning)'; }
                          if (st.includes('Clicked')) { badgeColor = 'var(--text-danger)'; bg = 'var(--bg-danger)'; border = 'var(--border-danger)'; }
                          if (st.includes('Submitted')) { badgeColor = 'var(--text-danger)'; bg = 'var(--bg-danger)'; border = 'var(--border-danger)'; }
                          if (st.includes('Error')) { badgeColor = 'var(--text-neutral)'; bg = 'var(--bg-neutral)'; border = 'var(--border-neutral)'; }

                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="font-mono-data" style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {r.email}
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                                {r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : (r.position || '-')}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: bg,
                                  color: badgeColor,
                                  border: `1px solid ${border}`
                                }}>
                                  {st}
                                </span>
                              </td>
                              <td className="font-mono-data" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                {r.send_date ? new Date(r.send_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Event Timeline Log */}
              {((detailCampaign as any).timeline || []).length > 0 && (
                <div>
                  <h4 className="font-heading" style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-primary)' }}>
                    Chronological Timeline Events ({((detailCampaign as any).timeline || []).length})
                  </h4>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '160px', overflowY: 'auto', background: 'var(--bg-base)', padding: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {((detailCampaign as any).timeline || []).map((ev: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', borderBottom: '1px dashed var(--border)', paddingBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontWeight: 600, color: ev.message?.includes('Clicked') || ev.message?.includes('Submitted') ? 'var(--danger)' : 'var(--text-primary)' }}>
                              {ev.message}
                            </span>
                            {ev.email && (
                              <span className="font-mono-data" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                ({ev.email})
                              </span>
                            )}
                          </div>
                          <span className="font-mono-data" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {ev.time ? new Date(ev.time).toLocaleTimeString('id-ID') : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-elevated)' }}>
              <button
                onClick={() => setDetailCampaign(null)}
                style={{
                  padding: '8px 18px',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Stop Campaign Confirmation Modal ── */}
      {stopModalCampaign && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="font-body" style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 className="font-heading" style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <AlertTriangle size={18} style={{ color: 'var(--warning)' }} /> Stop Phishing Campaign
              </h3>
              <button
                onClick={() => !isStopping && setStopModalCampaign(null)}
                disabled={isStopping}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: isStopping ? 'default' : 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Are you sure you want to stop <strong>{stopModalCampaign.name}</strong>? This will permanently end the simulation and cancel any unsent emails. <strong>This action is final and cannot be resumed.</strong> (All telemetry collected so far will be preserved).
              </p>

              {stopError && (
                <div style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: 'var(--bg-danger)',
                  border: '1px solid var(--border-danger)',
                  color: 'var(--text-danger)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{stopError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setStopModalCampaign(null)}
                  disabled={isStopping}
                  className="font-body"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: isStopping ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStop}
                  disabled={isStopping}
                  className="font-body"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-danger)',
                    background: 'var(--bg-danger)',
                    color: 'var(--text-danger)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: isStopping ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isStopping ? 'Stopping...' : 'Stop Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
