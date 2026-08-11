'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles, Copy, Check, Download, FileText, ShieldCheck, RefreshCw,
  Search, Filter, ShieldAlert, Shield, Users, ChevronRight, X, AlertTriangle
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

  // Deep-Dive Modal State
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [userDeepDive, setUserDeepDive] = useState<UserDeepDive | null>(null);
  const [isDeepDiveLoading, setIsDeepDiveLoading] = useState(false);

  // Markdown Action Bar State
  const [copied, setCopied] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

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

  // Fetch Individual User Deep Dive
  const handleOpenUserModal = async (email: string) => {
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

  const handleCopyMarkdown = () => {
    if (!markdownReport) return;
    navigator.clipboard.writeText(markdownReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!markdownReport) return;
    const blob = new Blob([markdownReport], { type: 'text/markdown;charset=utf-8' });
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

  // Filtered User List
  const divisions = Array.from(new Set(classifications.map(c => c.divisi).filter(Boolean)));
  const filteredUsers = classifications.filter(u => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.divisi.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.one_line_assessment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiv = selectedDivision === 'ALL' || u.divisi === selectedDivision;
    const matchesRisk = selectedRiskFilter === 'ALL' || u.risk_level === selectedRiskFilter;
    return matchesSearch && matchesDiv && matchesRisk;
  });

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
        <div key={`table-${keyIndex}`} style={{ margin: '20px 0', overflow: 'hidden', borderRadius: '10px', border: '1px solid rgba(148,163,184,0.15)', background: '#0b1329', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', color: '#e2e8f0', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#172544', color: '#93c5fd', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                  {headers.map((h, idx) => (
                    <th key={idx} style={{ padding: '12px 16px', borderRight: '1px solid rgba(148,163,184,0.1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.4)' }}>
                    {row.map((cell, cIdx) => {
                      let badgeStyle: React.CSSProperties | null = null;
                      if (cell.includes('HIGH') || cell.includes('DANGER') || cell.includes('CRITICAL')) {
                        badgeStyle = { background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '10px', display: 'inline-block' };
                      } else if (cell.includes('MODERATE') || cell.includes('VULNERABLE')) {
                        badgeStyle = { background: 'rgba(245,158,11,0.2)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '10px', display: 'inline-block' };
                      } else if (cell.includes('SAFE')) {
                        badgeStyle = { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '10px', display: 'inline-block' };
                      }
                      return (
                        <td key={cIdx} style={{ padding: '12px 16px', borderRight: '1px solid rgba(148,163,184,0.08)' }}>
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

      const trimmed = line.trim();
      if (!trimmed) {
        elements.push(<div key={idx} style={{ height: '8px' }} />);
        return;
      }

      if (trimmed.startsWith('# ')) {
        elements.push(
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(59, 130, 246, 0.25)', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, background: 'linear-gradient(135deg, #60a5fa, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles style={{ width: '20px', height: '20px', color: '#60a5fa' }} />
              {trimmed.replace('# ', '')}
            </h1>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', padding: '4px 10px', borderRadius: '20px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
              GFM AI REPORT
            </span>
          </div>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={idx} style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '24px', marginBottom: '12px', borderLeft: '4px solid #3b82f6', paddingLeft: '12px' }}>
            {trimmed.replace('## ', '')}
          </h2>
        );
      } else if (trimmed.startsWith('> ')) {
        elements.push(
          <div key={idx} style={{ margin: '16px 0', padding: '16px', borderRadius: '10px', background: '#0b1329', border: '1px solid rgba(148,163,184,0.15)', borderLeft: '4px solid #3b82f6', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
            {trimmed.replace('> ', '')}
          </div>
        );
      } else if (trimmed.startsWith('- ')) {
        const text = trimmed.replace('- ', '');
        const parts = text.split('**');
        elements.push(
          <li key={idx} style={{ marginLeft: '20px', listStyleType: 'disc', fontSize: '13px', color: '#cbd5e1', margin: '6px 0', lineHeight: '1.6' }}>
            {parts.map((p, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} style={{ fontWeight: 700, color: '#f8fafc' }}>{p}</strong> : p))}
          </li>
        );
      } else {
        const parts = trimmed.split('**');
        elements.push(
          <p key={idx} style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6', margin: '8px 0' }}>
            {parts.map((p, pIdx) => (pIdx % 2 === 1 ? <strong key={pIdx} style={{ fontWeight: 700, color: '#f8fafc' }}>{p}</strong> : p))}
          </p>
        );
      }
    });

    if (tableBuffer.length > 0) flushTable(lines.length);
    return elements;
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans, Inter, sans-serif)' }}>
      {/* Top Banner Navigation & Sub-Tabs */}
      <div style={{
        background: '#0e172a',
        borderRadius: '12px',
        border: '1px solid rgba(148,163,184,0.15)',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            <Sparkles style={{ width: '20px', height: '20px', color: '#ffffff' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>AI Risk Intelligence Command Center</h2>
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                ROLE: {role}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#34d399', fontWeight: 600 }}>
                <ShieldCheck style={{ width: '14px', height: '14px' }} /> PII Masked (EMP-Tokens)
              </span>
              <span>•</span>
              <span>Multi-LLM Failover Engine Active</span>
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#080d19', padding: '4px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.15)' }}>
          <button
            onClick={() => setActiveSubTab('heatmap')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeSubTab === 'heatmap' ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'transparent',
              color: activeSubTab === 'heatmap' ? '#ffffff' : '#94a3b8',
              boxShadow: activeSubTab === 'heatmap' ? '0 4px 12px rgba(37,99,235,0.3)' : 'none'
            }}
          >
            <Users style={{ width: '14px', height: '14px' }} />
            User & Division Risk Heatmap
          </button>
          <button
            onClick={() => setActiveSubTab('report')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeSubTab === 'report' ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'transparent',
              color: activeSubTab === 'report' ? '#ffffff' : '#94a3b8',
              boxShadow: activeSubTab === 'report' ? '0 4px 12px rgba(37,99,235,0.3)' : 'none'
            }}
          >
            <FileText style={{ width: '14px', height: '14px' }} />
            Executive Narrative & PDF Report
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: HEATMAP & USER CLASSIFICATION GRID */}
      {activeSubTab === 'heatmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Org Metrics Overview Cards */}
          {orgSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#0e172a', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.15)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>Safe Employees</p>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#34d399', margin: '4px 0 0 0' }}>{orgSummary.safe_count}</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
                  <ShieldCheck style={{ width: '20px', height: '20px' }} />
                </div>
              </div>

              <div style={{ background: '#0e172a', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.15)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>Vulnerable / Moderate</p>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24', margin: '4px 0 0 0' }}>{orgSummary.vulnerable_count}</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
                  <ShieldAlert style={{ width: '20px', height: '20px' }} />
                </div>
              </div>

              <div style={{ background: '#0e172a', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.15)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>Danger / High Risk</p>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#f87171', margin: '4px 0 0 0' }}>{orgSummary.danger_count}</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                  <Shield style={{ width: '20px', height: '20px' }} />
                </div>
              </div>

              <div style={{ background: '#0e172a', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.15)', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>Most At Risk Division</p>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#60a5fa', margin: '4px 0 0 0' }}>{orgSummary.most_at_risk_division || 'Network Operations'}</p>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                  <AlertTriangle style={{ width: '20px', height: '20px' }} />
                </div>
              </div>
            </div>
          )}

          {/* Controls & Filter Bar */}
          <div style={{ background: '#0e172a', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.15)', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search style={{ width: '16px', height: '16px', color: '#64748b', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search employee or division..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: '#080d19',
                  border: '1px solid rgba(148,163,184,0.2)',
                  borderRadius: '8px',
                  padding: '8px 12px 8px 36px',
                  fontSize: '13px',
                  color: '#f8fafc',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Division Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#080d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: '#cbd5e1' }}>
                <Filter style={{ width: '14px', height: '14px', color: '#64748b' }} />
                <span>Division:</span>
                <select
                  value={selectedDivision}
                  onChange={e => setSelectedDivision(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: 600, fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="ALL" style={{ background: '#0e172a', color: '#f8fafc' }}>All Divisions</option>
                  {divisions.map(d => (
                    <option key={d} value={d} style={{ background: '#0e172a', color: '#f8fafc' }}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Risk Level Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#080d19', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: '#cbd5e1' }}>
                <span>Risk:</span>
                <select
                  value={selectedRiskFilter}
                  onChange={e => setSelectedRiskFilter(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: 600, fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="ALL" style={{ background: '#0e172a', color: '#f8fafc' }}>All Levels</option>
                  <option value="DANGER" style={{ background: '#0e172a', color: '#f87171' }}>DANGER</option>
                  <option value="VULNERABLE" style={{ background: '#0e172a', color: '#fbbf24' }}>VULNERABLE</option>
                  <option value="SAFE" style={{ background: '#0e172a', color: '#34d399' }}>SAFE</option>
                </select>
              </div>

              <button
                onClick={() => fetchHeatmapData(true)}
                disabled={isHeatmapLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid rgba(148,163,184,0.2)',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw style={{ width: '14px', height: '14px', animation: isHeatmapLoading ? 'spin 1s linear infinite' : 'none' }} />
                Refresh Batch
              </button>
            </div>
          </div>

          {/* User Grid Cards */}
          {isHeatmapLoading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', background: '#0e172a', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.15)' }}>
              <RefreshCw style={{ width: '32px', height: '32px', color: '#3b82f6', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>Running AI Batch Classification Engine...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '50px 0', textAlign: 'center', color: '#94a3b8', background: '#0e172a', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.15)', fontSize: '13px' }}>
              No employee classifications found matching filter criteria.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {filteredUsers.map((user, idx) => {
                let badgeBg = 'rgba(16,185,129,0.15)';
                let badgeColor = '#34d399';
                let badgeBorder = 'rgba(16,185,129,0.3)';
                let barBg = '#10b981';

                if (user.risk_level === 'DANGER') {
                  badgeBg = 'rgba(239,68,68,0.15)';
                  badgeColor = '#f87171';
                  badgeBorder = 'rgba(239,68,68,0.3)';
                  barBg = '#ef4444';
                } else if (user.risk_level === 'VULNERABLE') {
                  badgeBg = 'rgba(245,158,11,0.15)';
                  badgeColor = '#fbbf24';
                  badgeBorder = 'rgba(245,158,11,0.3)';
                  barBg = '#f59e0b';
                }

                return (
                  <div
                    key={idx}
                    onClick={() => handleOpenUserModal(user.email)}
                    style={{
                      background: '#0e172a',
                      borderRadius: '12px',
                      border: '1px solid rgba(148,163,184,0.15)',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: 0, fontFamily: 'monospace' }}>
                            {user.email}
                          </p>
                          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>{user.divisi || 'General'}</p>
                        </div>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}` }}>
                          {user.risk_level}
                        </span>
                      </div>

                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>Risk Score:</span>
                          <span style={{ fontWeight: 700, color: '#f8fafc' }}>{user.risk_score}/100</span>
                        </div>
                        <div style={{ width: '100%', background: '#080d19', height: '6px', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.1)' }}>
                          <div style={{ width: `${user.risk_score}%`, height: '100%', background: barBg, borderRadius: '3px' }} />
                        </div>
                        <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '10px 0 0 0', lineHeight: 1.5, fontStyle: 'italic' }}>
                          "{user.one_line_assessment}"
                        </p>
                      </div>
                    </div>

                    <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(148,163,184,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#60a5fa', fontWeight: 600 }}>
                      <span>Click Deep-Dive AI Analysis</span>
                      <ChevronRight style={{ width: '16px', height: '16px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: EXECUTIVE GFM MARKDOWN & PDF REPORT */}
      {activeSubTab === 'report' && (
        <div style={{ background: '#0e172a', borderRadius: '12px', border: '1px solid rgba(148,163,184,0.15)', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {/* Action Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', paddingBottom: '18px', borderBottom: '1px solid rgba(148,163,184,0.15)', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText style={{ width: '18px', height: '18px', color: '#60a5fa' }} />
                Executive GFM Markdown & Vector PDF Report Generator
              </h3>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                Generates a formal, audit-ready Markdown document and compiles it into a high-res vector PDF.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={isLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.2)', cursor: 'pointer' }}
                >
                  <RefreshCw style={{ width: '14px', height: '14px', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                  Regenerate
                </button>
              )}

              <button
                onClick={handleCopyMarkdown}
                disabled={!markdownReport}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.2)', cursor: 'pointer' }}
              >
                {copied ? <Check style={{ width: '14px', height: '14px', color: '#34d399' }} /> : <Copy style={{ width: '14px', height: '14px', color: '#94a3b8' }} />}
                {copied ? 'Copied .md!' : 'Copy .md'}
              </button>

              <button
                onClick={handleDownloadMarkdown}
                disabled={!markdownReport}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.2)', cursor: 'pointer' }}
              >
                <Download style={{ width: '14px', height: '14px', color: '#60a5fa' }} />
                Download .md
              </button>

              <button
                onClick={handleExportPdf}
                disabled={isPdfLoading || pdfGenerating || !markdownReport}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                  cursor: 'pointer'
                }}
              >
                <FileText style={{ width: '16px', height: '16px' }} />
                {isPdfLoading || pdfGenerating ? 'Exporting Vector PDF...' : 'Export Executive PDF'}
              </button>
            </div>
          </div>

          {/* Report Body */}
          {isLoading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <RefreshCw style={{ width: '32px', height: '32px', color: '#3b82f6', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>Generating GFM Executive Report for role [{role}]...</p>
            </div>
          ) : !markdownReport ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No report available yet. Click "Regenerate" to trigger AI analysis.
            </div>
          ) : (
            <div>
              {renderFormattedMarkdown(markdownReport)}
            </div>
          )}
        </div>
      )}

      {/* INDIVIDUAL USER DEEP-DIVE MODAL */}
      {selectedUserEmail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(8,13,25,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0e172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '16px', maxWidth: '600px', width: '100%', padding: '24px', position: 'relative', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.8)' }}>
            <button
              onClick={() => setSelectedUserEmail(null)}
              style={{ position: 'absolute', right: '16px', top: '16px', background: '#1e293b', border: 'none', color: '#94a3b8', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(148,163,184,0.15)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontWeight: 700, fontFamily: 'monospace' }}>
                AI
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: 0, fontFamily: 'monospace' }}>{selectedUserEmail}</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>Individual Employee Deep-Dive AI Risk Profiling</p>
              </div>
            </div>

            {isDeepDiveLoading ? (
              <div style={{ padding: '50px 0', textAlign: 'center' }}>
                <RefreshCw style={{ width: '32px', height: '32px', color: '#3b82f6', animation: 'spin 1s linear infinite', margin: '0 auto 12px auto' }} />
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Analyzing individual behavioral telemetry...</p>
              </div>
            ) : userDeepDive ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', color: '#e2e8f0' }}>
                {/* Risk Level Badge & Score */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '14px', background: '#080d19', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.15)' }}>
                    <p style={{ color: '#94a3b8', margin: 0, fontWeight: 500 }}>Risk Level</p>
                    <p style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      margin: '4px 0 0 0',
                      color: userDeepDive.risk_level === 'DANGER' ? '#f87171' : userDeepDive.risk_level === 'VULNERABLE' ? '#fbbf24' : '#34d399'
                    }}>{userDeepDive.risk_level}</p>
                  </div>
                  <div style={{ padding: '14px', background: '#080d19', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.15)' }}>
                    <p style={{ color: '#94a3b8', margin: 0, fontWeight: 500 }}>Risk Score</p>
                    <p style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', margin: '4px 0 0 0' }}>{userDeepDive.risk_score} / 100</p>
                  </div>
                </div>

                {/* Personal Education Message */}
                {userDeepDive.education_message && (
                  <div style={{ padding: '16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '10px', color: '#93c5fd', fontStyle: 'italic', lineHeight: 1.6 }}>
                    "{userDeepDive.education_message}"
                  </div>
                )}

                {/* Priority Action */}
                {userDeepDive.priority_action && (
                  <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#fca5a5' }}>
                    <p style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px', color: '#f87171', margin: 0 }}>Priority Action</p>
                    <p style={{ fontWeight: 700, margin: '4px 0 0 0' }}>{userDeepDive.priority_action}</p>
                  </div>
                )}

                {/* Recommendations */}
                {userDeepDive.recommendations && userDeepDive.recommendations.length > 0 && (
                  <div>
                    <p style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '11px' }}>Personalized Recommendations</p>
                    <ul style={{ paddingLeft: '20px', margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>
                      {userDeepDive.recommendations.map((rec, rIdx) => (
                        <li key={rIdx} style={{ margin: '4px 0' }}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>Failed to load user deep dive analysis.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
