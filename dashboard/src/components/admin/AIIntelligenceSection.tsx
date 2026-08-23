'use client';

import React, { useState, useEffect } from 'react';
import {
  Copy, Check, Download, FileText, ShieldCheck, RefreshCw,
  Search, Filter, ShieldAlert, Shield, Users, ChevronRight,
  AlertTriangle, Zap, CheckCircle2, Info, Activity, UserCheck
} from 'lucide-react';
import { exportExecutivePdf } from '@/lib/ExecutivePdfExporter';

export interface AIIntelligenceSectionProps {
  role?: 'soc' | 'ciso' | 'grc' | 'phishing_admin';
  markdownReport?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  onExportPdf?: () => void;
  isPdfLoading?: boolean;
  readOnly?: boolean;
}

interface UserClassification {
  email: string;
  divisi: string;
  risk_level: 'SAFE' | 'VULNERABLE' | 'DANGER';
  risk_score: number;
  primary_risk: string;
  one_line_assessment: string;
  education_tip: string;
}

interface OrgRiskSummary {
  safe_count: number;
  vulnerable_count: number;
  danger_count: number;
  most_at_risk_division: string;
  overall_assessment: string;
}

interface UserDeepDive {
  email: string;
  risk_level: 'SAFE' | 'VULNERABLE' | 'DANGER';
  risk_score: number;
  vulnerable_to: string[];
  risk_factors: string[];
  positive_factors: string[];
  education_message: string;
  recommendations: string[];
  priority_action: string;
  trend_assessment: string;
}

export const AIIntelligenceSection: React.FC<AIIntelligenceSectionProps> = ({
  role = 'soc',
  markdownReport = '',
  isLoading = false,
  onRefresh,
  onExportPdf,
  isPdfLoading = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'heatmap' | 'report'>('heatmap');
  
  // Heatmap State
  const [classifications, setClassifications] = useState<UserClassification[]>([]);
  const [orgSummary, setOrgSummary] = useState<OrgRiskSummary | null>(null);
  const [isHeatmapLoading, setIsHeatmapLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState('ALL');

  // Master-Detail Selection State
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [userDeepDive, setUserDeepDive] = useState<UserDeepDive | null>(null);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);

  // Markdown Report State
  const [internalReport, setInternalReport] = useState<string>('');
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const activeReport = markdownReport || internalReport;
  const isReportBusy = isLoading || isReportLoading;

  // Fetch Heatmap Data
  const fetchHeatmapData = async (refresh = false) => {
    setIsHeatmapLoading(true);
    try {
      const res = await fetch(`/api/ai/classify?role=${role}${refresh ? '&refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (data.classifications) setClassifications(data.classifications);
        if (data.org_risk_summary) setOrgSummary(data.org_risk_summary);
      }
    } catch (err) {
      console.error('Failed to fetch AI heatmap classifications:', err);
    } finally {
      setIsHeatmapLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmapData();
  }, [role]);

  // Fetch Individual User Deep Dive in-place
  const handleSelectUser = async (email: string) => {
    setSelectedUserEmail(email);
    setIsDeepDiveLoading(true);
    setUserDeepDive(null);
    try {
      const res = await fetch(`/api/ai/user/${encodeURIComponent(email)}?days=30`);
      if (res.ok) {
        const data = await res.json();
        setUserDeepDive(data);
      }
    } catch (err) {
      console.error('Failed to fetch user deep dive:', err);
    } finally {
      setIsDeepDiveLoading(false);
    }
  };

  const fetchReportData = async (refresh = false) => {
    setIsReportLoading(true);
    try {
      const res = await fetch(`/api/ai/report?days=7${refresh ? '&refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (data.markdown_report) setInternalReport(data.markdown_report);
      }
    } catch (err) {
      console.error('Failed to fetch AI report:', err);
    } finally {
      setIsReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'report' && !markdownReport && !internalReport) {
      fetchReportData();
    }
  }, [activeSubTab, markdownReport]);

  const handleCopyMarkdown = () => {
    if (!activeReport) return;
    navigator.clipboard.writeText(activeReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!activeReport) return;
    const blob = new Blob([activeReport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AFFERENT_${role.toUpperCase()}_Executive_Report_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    if (onExportPdf) {
      onExportPdf();
      return;
    }
    if (!markdownReport) return;
    setPdfGenerating(true);
    try {
      await exportExecutivePdf(role, markdownReport);
    } catch (err) {
      console.error('Failed to export vector PDF:', err);
    } finally {
      setPdfGenerating(false);
    }
  };

  // Filtered & Sorted User List (DANGER first -> VULNERABLE -> SAFE)
  const divisions = Array.from(new Set(classifications.map(c => c.divisi).filter(Boolean)));
  const filteredUsers = classifications.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.divisi.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.one_line_assessment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiv = selectedDivision === 'ALL' || u.divisi === selectedDivision;
    const matchesRisk = selectedRiskFilter === 'ALL' || u.risk_level === selectedRiskFilter;
    return matchesSearch && matchesDiv && matchesRisk;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const riskRank = { DANGER: 0, VULNERABLE: 1, SAFE: 2 };
    const rankDiff = (riskRank[a.risk_level] ?? 1) - (riskRank[b.risk_level] ?? 1);
    if (rankDiff !== 0) return rankDiff;
    return a.risk_score - b.risk_score;
  });

  // Selected Employee object from classification list (instant preview before deep-dive finishes)
  const activeSelectedUser = classifications.find(u => u.email === selectedUserEmail);

  // Custom Markdown Parser with Explicit Cyber-Security Styling Tokens
  const renderFormattedMarkdown = (content: string) => {
    if (!content) return null;
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];

    const flushTable = (keyIndex: number) => {
      if (tableBuffer.length < 2) {
        tableBuffer = [];
        return;
      }
      const headers = tableBuffer[0].split('|').map(h => h.trim()).filter(Boolean);
      const rows = tableBuffer.slice(2).map(r => r.split('|').map(cell => cell.trim()).filter(Boolean));

      elements.push(
        <div key={`table-${keyIndex}`} style={{ margin: '20px 0', overflow: 'hidden', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-surface)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', color: 'var(--text-primary)', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                  {headers.map((h, idx) => (
                    <th key={idx} style={{ padding: '12px 16px', borderRight: '1px solid var(--border)', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid var(--border)' }}>
                    {row.map((cell, cIdx) => {
                      let badgeStyle: React.CSSProperties | null = null;
                      if (cell.includes('HIGH') || cell.includes('DANGER') || cell.includes('CRITICAL')) {
                        badgeStyle = { background: 'var(--bg-danger)', color: 'var(--text-danger)', border: '1px solid var(--border-danger)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '10px', display: 'inline-block' };
                      } else if (cell.includes('MODERATE') || cell.includes('VULNERABLE')) {
                        badgeStyle = { background: 'var(--bg-warning)', color: 'var(--text-warning)', border: '1px solid var(--border-warning)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '10px', display: 'inline-block' };
                      } else if (cell.includes('SAFE')) {
                        badgeStyle = { background: 'var(--bg-success)', color: 'var(--text-success)', border: '1px solid var(--border-success)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '10px', display: 'inline-block' };
                      }
                      return (
                        <td key={cIdx} style={{ padding: '12px 16px', borderRight: '1px solid var(--border)' }}>
                          {badgeStyle ? <span style={badgeStyle}>{cell}</span> : cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
      tableBuffer = [];
    };

    lines.forEach((line, idx) => {
      if (line.trim().startsWith('|')) {
        tableBuffer.push(line);
        return;
      } else if (tableBuffer.length > 0) {
        flushTable(idx);
      }

      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={idx} className="font-heading" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '24px 0 12px 0', borderBottom: '2px solid var(--border)', paddingBottom: '8px' }}>
            {line.replace('# ', '')}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={idx} className="font-heading" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)', margin: '20px 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '4px', height: '16px', background: '#2196F3', borderRadius: '2px', display: 'inline-block' }} />
            {line.replace('## ', '')}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={idx} className="font-heading" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '14px 0 6px 0' }}>
            {line.replace('### ', '')}
          </h3>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <div key={idx} className="font-body" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '4px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <span style={{ color: '#2196F3', fontWeight: 800, marginTop: '-1px' }}>•</span>
            <span>{line.substring(2)}</span>
          </div>
        );
      } else if (line.trim().length > 0) {
        elements.push(
          <p key={idx} className="font-body" style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0', lineHeight: 1.6 }}>
            {line}
          </p>
        );
      }
    });

    if (tableBuffer.length > 0) flushTable(lines.length);
    return elements;
  };

  return (
    <div className="font-body" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner Navigation & Sub-Tabs */}
      <div className="panel glass-card" style={{
        padding: '18px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        borderRadius: '16px',
        marginBottom: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#0D47A1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck style={{ width: '22px', height: '22px', color: '#ffffff' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="font-heading" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                AI Risk Intelligence Command Center
              </h2>
              <span className="font-body" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', borderRadius: '4px', background: 'rgba(33,150,243,0.12)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                ROLE: {role}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-success)', fontWeight: 600 }}>
                <ShieldCheck style={{ width: '14px', height: '14px', color: 'var(--text-success)' }} /> PII Masked (EMP-Tokens)
              </span>
              <span>•</span>
              <span>Multi-LLM Failover Engine Active</span>
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveSubTab('heatmap')}
            className="font-body"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeSubTab === 'heatmap' ? 'var(--accent)' : 'transparent',
              color: activeSubTab === 'heatmap' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: 'none'
            }}
          >
            <Users style={{ width: '14px', height: '14px' }} />
            User &amp; Division Risk Heatmap
          </button>
          <button
            onClick={() => setActiveSubTab('report')}
            className="font-body"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeSubTab === 'report' ? 'var(--accent)' : 'transparent',
              color: activeSubTab === 'report' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: 'none'
            }}
          >
            <FileText style={{ width: '14px', height: '14px' }} />
            Executive Narrative &amp; PDF Report
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: HEATMAP & USER CLASSIFICATION — MASTER-DETAIL SPLIT CONSOLE */}
      {activeSubTab === 'heatmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Org Metrics Overview Cards */}
          {orgSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div className="stat-card glass-card font-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '14px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Safe Employees</p>
                  <p className="font-mono-data" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-success)', margin: '2px 0 0 0' }}>{orgSummary.safe_count}</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-success)', border: '1px solid var(--border-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-success)' }}>
                  <ShieldCheck style={{ width: '20px', height: '20px' }} />
                </div>
              </div>

              <div className="stat-card glass-card font-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '14px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Vulnerable / Moderate</p>
                  <p className="font-mono-data" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-warning)', margin: '2px 0 0 0' }}>{orgSummary.vulnerable_count}</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-warning)', border: '1px solid var(--border-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-warning)' }}>
                  <ShieldAlert style={{ width: '20px', height: '20px' }} />
                </div>
              </div>

              <div className="stat-card glass-card font-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '14px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Danger / High Risk</p>
                  <p className="font-mono-data" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-danger)', margin: '2px 0 0 0' }}>{orgSummary.danger_count}</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-danger)', border: '1px solid var(--border-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-danger)' }}>
                  <Shield style={{ width: '20px', height: '20px' }} />
                </div>
              </div>

              <div className="stat-card glass-card font-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '14px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Most At Risk Division</p>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--accent)', margin: '2px 0 0 0' }}>{orgSummary.most_at_risk_division || 'Network Operations'}</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(144,202,249,0.25)', border: '1px solid #90CAF9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0D47A1' }}>
                  <AlertTriangle style={{ width: '20px', height: '20px' }} />
                </div>
              </div>
            </div>
          )}

          {/* ── MASTER-DETAIL SPLIT CONSOLE (WAZUH / CROWDSTRIKE STYLE) ── */}
          <div style={{
            display: 'flex',
            gap: '18px',
            minHeight: '600px',
            height: 'calc(100vh - 280px)',
            width: '100%'
          }}>
            {/* ── LEFT COLUMN: MASTER LIST (38% width, independent scroll) ── */}
            <div className="panel glass-card" style={{
              width: '38%',
              minWidth: '320px',
              maxWidth: '430px',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              borderRadius: '16px',
              marginBottom: 0,
              height: '100%',
              overflow: 'hidden'
            }}>
              {/* Search & Quick Filters Header */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                {/* Search Bar */}
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search style={{ width: '15px', height: '15px', color: 'var(--text-muted)', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Filter by name, email, division..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="font-body"
                    style={{
                      width: '100%',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '7px 10px 7px 32px',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Filter Dropdowns & Refresh */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <select
                      value={selectedDivision}
                      onChange={e => setSelectedDivision(e.target.value)}
                      className="font-body"
                      style={{
                        flex: 1,
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        padding: '5px 6px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="ALL">All Divisions</option>
                      {divisions.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>

                    <select
                      value={selectedRiskFilter}
                      onChange={e => setSelectedRiskFilter(e.target.value)}
                      className="font-body"
                      style={{
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        padding: '5px 6px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="ALL">All Risk Levels</option>
                      <option value="DANGER">DANGER</option>
                      <option value="VULNERABLE">VULNERABLE</option>
                      <option value="SAFE">SAFE</option>
                    </select>
                  </div>

                  <button
                    onClick={() => fetchHeatmapData(true)}
                    disabled={isHeatmapLoading}
                    title="Refresh AI telemetry"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <RefreshCw style={{ width: '13px', height: '13px', animation: isHeatmapLoading ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Priority: Highest Risk (Danger First)</span>
                  <span className="font-mono-data" style={{ fontWeight: 700, color: 'var(--accent)' }}>{sortedUsers.length} Personnel</span>
                </div>
              </div>

              {/* Scrollable Master List */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                {isHeatmapLoading ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    <RefreshCw style={{ width: '24px', height: '24px', color: '#2196F3', animation: 'spin 1s linear infinite', margin: '0 auto 10px auto' }} />
                    Loading risk telemetry profiles...
                  </div>
                ) : sortedUsers.length === 0 ? (
                  <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No employees matched the active search filters.
                  </div>
                ) : (
                  sortedUsers.map(user => {
                    const isSelected = selectedUserEmail === user.email;
                    const displayName = user.email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                    let badgeBg = 'var(--bg-success)';
                    let badgeColor = 'var(--text-success)';
                    let badgeBorder = 'var(--border-success)';
                    let avatarBg = 'var(--bg-success)';
                    let avatarColor = 'var(--text-success)';

                    if (user.risk_level === 'DANGER') {
                      badgeBg = 'var(--bg-danger)';
                      badgeColor = 'var(--text-danger)';
                      badgeBorder = 'var(--border-danger)';
                      avatarBg = 'var(--bg-danger)';
                      avatarColor = 'var(--text-danger)';
                    } else if (user.risk_level === 'VULNERABLE') {
                      badgeBg = 'var(--bg-warning)';
                      badgeColor = 'var(--text-warning)';
                      badgeBorder = 'var(--border-warning)';
                      avatarBg = 'var(--bg-warning)';
                      avatarColor = 'var(--text-warning)';
                    }

                    return (
                      <div
                        key={user.email}
                        onClick={() => handleSelectUser(user.email)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                          borderLeft: isSelected ? '4px solid #2196F3' : '1px solid var(--border)',
                          boxShadow: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <div className="font-mono-data" style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: avatarBg,
                            color: avatarColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '11px',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="font-mono-data" style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.2
                            }}>
                              {user.email}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              marginTop: '2px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {user.divisi || 'General'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
                          <span className="font-body" style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background: badgeBg,
                            color: badgeColor,
                            border: `1px solid ${badgeBorder}`
                          }}>
                            {user.risk_level}
                          </span>
                          <span className="font-mono-data" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {user.risk_score} pts
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── RIGHT COLUMN: DETAIL CONSOLE (62% width, independent scroll) ── */}
            <div className="panel glass-card" style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '24px',
              borderRadius: '16px',
              marginBottom: 0,
              height: '100%',
              overflowY: 'auto'
            }}>
              {!selectedUserEmail || !activeSelectedUser ? (
                /* Empty State */
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: 'rgba(33,150,243,0.10)',
                    border: '1px solid rgba(33,150,243,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    color: '#2196F3'
                  }}>
                    <Users style={{ width: '32px', height: '32px' }} />
                  </div>
                  <h3 className="font-heading" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                    Select an Employee for Live AI Risk Analysis
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: 0, lineHeight: 1.5 }}>
                    Select an employee entity from the left investigation list to inspect behavioral risk profiling, vulnerability factors, and AI-tailored educational interventions.
                  </p>
                </div>
              ) : (
                /* In-Place Detail View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Entity Header Banner */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    paddingBottom: '18px',
                    borderBottom: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div className="font-mono-data" style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: activeSelectedUser.risk_level === 'DANGER' ? 'var(--bg-danger)' : activeSelectedUser.risk_level === 'VULNERABLE' ? 'var(--bg-warning)' : 'var(--bg-success)',
                        color: activeSelectedUser.risk_level === 'DANGER' ? 'var(--text-danger)' : activeSelectedUser.risk_level === 'VULNERABLE' ? 'var(--text-warning)' : 'var(--text-success)',
                        border: `1px solid ${activeSelectedUser.risk_level === 'DANGER' ? 'var(--border-danger)' : activeSelectedUser.risk_level === 'VULNERABLE' ? 'var(--border-warning)' : 'var(--border-success)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '15px'
                      }}>
                        {activeSelectedUser.email.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 className="font-mono-data" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            {activeSelectedUser.email}
                          </h3>
                          <span className="font-body" style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            background: activeSelectedUser.risk_level === 'DANGER' ? 'var(--bg-danger)' : activeSelectedUser.risk_level === 'VULNERABLE' ? 'var(--bg-warning)' : 'var(--bg-success)',
                            color: activeSelectedUser.risk_level === 'DANGER' ? 'var(--text-danger)' : activeSelectedUser.risk_level === 'VULNERABLE' ? 'var(--text-warning)' : 'var(--text-success)',
                            border: `1px solid ${activeSelectedUser.risk_level === 'DANGER' ? 'var(--border-danger)' : activeSelectedUser.risk_level === 'VULNERABLE' ? 'var(--border-warning)' : 'var(--border-success)'}`
                          }}>
                            {activeSelectedUser.risk_level}
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                          Division: <strong style={{ color: 'var(--text-primary)' }}>{activeSelectedUser.divisi || 'General'}</strong> • Human Risk Telemetry Profile
                        </p>
                      </div>
                    </div>

                    {/* Risk Score Meter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 14px' }}>
                      <div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Security Score</span>
                        <div className="font-mono-data" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {activeSelectedUser.risk_score} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>/ 100</span>
                        </div>
                      </div>
                      <div style={{ width: '70px', background: 'var(--bg-elevated)', height: '8px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <div style={{
                          width: `${activeSelectedUser.risk_score}%`,
                          height: '100%',
                          background: activeSelectedUser.risk_level === 'DANGER' ? 'var(--danger)' : activeSelectedUser.risk_level === 'VULNERABLE' ? 'var(--warning)' : 'var(--success)',
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* AI Quick Assessment Quote Box */}
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '10px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    fontStyle: 'italic'
                  }}>
                    <span style={{ fontWeight: 700, fontStyle: 'normal', color: 'var(--accent)', display: 'block', marginBottom: '2px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      AI Executive Assessment
                    </span>
                    "{activeSelectedUser.one_line_assessment}"
                  </div>

                  {/* Deep-Dive Analysis Content */}
                  {isDeepDiveLoading ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RefreshCw style={{ width: '28px', height: '28px', color: '#2196F3', animation: 'spin 1s linear infinite', margin: '0 auto 10px auto' }} />
                      <p style={{ fontSize: '13px', margin: 0, fontWeight: 600 }}>Executing Deep-Dive AI Behavioral Telemetry Analysis...</p>
                    </div>
                  ) : userDeepDive ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Priority Action Alert Box */}
                      {userDeepDive.priority_action && (
                        <div style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: 'var(--bg-danger)',
                          border: '1px solid var(--border-danger)',
                          color: 'var(--text-danger)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <AlertTriangle style={{ width: '14px', height: '14px' }} />
                            Priority SOC / Admin Action
                          </div>
                          <p style={{ fontSize: '13px', fontWeight: 700, margin: '6px 0 0 0', lineHeight: 1.4 }}>
                            {userDeepDive.priority_action}
                          </p>
                        </div>
                      )}

                      {/* Education & Coaching Guidance */}
                      {userDeepDive.education_message && (
                        <div style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          background: 'rgba(33,150,243,0.08)',
                          border: '1px solid rgba(33,150,243,0.25)',
                          color: 'var(--accent)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Info style={{ width: '14px', height: '14px' }} />
                            Targeted Education &amp; Coaching Insight
                          </div>
                          <p style={{ fontSize: '13px', margin: '6px 0 0 0', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                            {userDeepDive.education_message}
                          </p>
                        </div>
                      )}

                      {/* Two-Column Telemetry Factors: Vulnerabilities vs Resilience */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        {/* Risk Factors / Vulnerabilities */}
                        <div style={{
                          padding: '14px',
                          borderRadius: '10px',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-danger)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShieldAlert style={{ width: '14px', height: '14px' }} />
                            Identified Risk &amp; Vulnerability Factors
                          </div>
                          {userDeepDive.risk_factors && userDeepDive.risk_factors.length > 0 ? (
                            <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {userDeepDive.risk_factors.map((factor, fIdx) => (
                                <li key={fIdx} style={{ margin: '4px 0' }}>{factor}</li>
                              ))}
                            </ul>
                          ) : (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                              No critical vulnerability anomalies detected.
                            </p>
                          )}
                        </div>

                        {/* Positive Resilience Factors */}
                        <div style={{
                          padding: '14px',
                          borderRadius: '10px',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-success)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 style={{ width: '14px', height: '14px', color: 'var(--text-success)' }} />
                            Positive Resilience Factors
                          </div>
                          {userDeepDive.positive_factors && userDeepDive.positive_factors.length > 0 ? (
                            <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                              {userDeepDive.positive_factors.map((factor, fIdx) => (
                                <li key={fIdx} style={{ margin: '4px 0' }}>{factor}</li>
                              ))}
                            </ul>
                          ) : (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                              No positive resilience streak tracked yet.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Tailored Remediation Recommendations */}
                      {userDeepDive.recommendations && userDeepDive.recommendations.length > 0 && (
                        <div style={{
                          padding: '16px',
                          borderRadius: '10px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Zap style={{ width: '14px', height: '14px', color: '#2196F3' }} />
                            AI Remediation &amp; Coaching Recommendations
                          </div>
                          <ul style={{ paddingLeft: '18px', margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {userDeepDive.recommendations.map((rec, rIdx) => (
                              <li key={rIdx} style={{ margin: '4px 0' }}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      Deep telemetry data is being prepared.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: EXECUTIVE GFM MARKDOWN & PDF REPORT */}
      {activeSubTab === 'report' && (
        <div className="panel glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
          {/* Action Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', paddingBottom: '18px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
            <div>
              <h3 className="font-heading" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText style={{ width: '18px', height: '18px', color: '#2196F3' }} />
                Executive GFM Markdown &amp; Vector PDF Report Generator
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Generates a formal, audit-ready Markdown document and compiles it into a high-res vector PDF.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => fetchReportData(true)}
                disabled={isReportBusy}
                className="font-body"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <RefreshCw style={{ width: '14px', height: '14px', animation: isReportBusy ? 'spin 1s linear infinite' : 'none' }} />
                Regenerate
              </button>

              <button
                onClick={handleCopyMarkdown}
                disabled={!activeReport}
                className="font-body"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                {copied ? <Check style={{ width: '14px', height: '14px', color: 'var(--text-success)' }} /> : <Copy style={{ width: '14px', height: '14px', color: 'var(--accent)' }} />}
                {copied ? 'Copied .md!' : 'Copy .md'}
              </button>

              <button
                onClick={handleDownloadMarkdown}
                disabled={!activeReport}
                className="font-body"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <Download style={{ width: '14px', height: '14px', color: '#2196F3' }} />
                Download .md
              </button>

              <button
                onClick={() => exportExecutivePdf(role, activeReport)}
                disabled={isPdfLoading || pdfGenerating || !activeReport}
                className="font-body"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: 'var(--accent)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: 'none',
                  cursor: 'pointer'
                }}
              >
                <FileText style={{ width: '16px', height: '16px' }} />
                {isPdfLoading || pdfGenerating ? 'Exporting Vector PDF...' : 'Export Executive PDF'}
              </button>
            </div>
          </div>

          {/* Report Body */}
          {isReportBusy ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <RefreshCw style={{ width: '32px', height: '32px', color: '#2196F3', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Generating GFM Executive Report for role [{role}]...</p>
            </div>
          ) : !activeReport ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No report available yet. Click "Regenerate" to trigger AI analysis.
            </div>
          ) : (
            <div>
              {renderFormattedMarkdown(activeReport)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIIntelligenceSection;
