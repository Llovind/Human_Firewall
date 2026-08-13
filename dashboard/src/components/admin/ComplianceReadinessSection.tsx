'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Lock, RefreshCw, Info, Edit2, Check, Save, FileText } from 'lucide-react';

export interface ClauseEvidence {
  label: string;
  formula: string;
  components: Record<string, number>;
}

export interface ReadinessClause {
  clause_id: string;
  clause_number: string;
  clause_title: string;
  current_value: number | null;
  target_value: number | null;
  unit: string;
  is_legally_mandated: boolean;
  readiness_tier: 'Strong Readiness' | 'Partial Readiness' | 'Needs Attention' | 'Not Configured';
  rationale: string;
  evidence?: ClauseEvidence;
}

export interface ReadinessSummaryResponse {
  disclaimer: string;
  overall_readiness_indicator: 'Strong Readiness' | 'Partial Readiness' | 'Needs Attention' | 'Not Configured';
  clause_readiness: ReadinessClause[];
  total_users: number;
  total_reports: number;
  total_clicks: number;
  mean_time_to_close_hours: number | null;
}

export interface ThresholdItem {
  clause_id: string;
  clause_number: string;
  clause_title: string;
  target_value: number | null;
  unit: string;
  is_legally_mandated: boolean;
  rationale: string;
}

export interface ComplianceReadinessSectionProps {
  readOnly?: boolean;
}

export const ComplianceReadinessSection: React.FC<ComplianceReadinessSectionProps> = ({
  readOnly = false,
}) => {
  const [data, setData] = useState<ReadinessSummaryResponse | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, string>>({});
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  const fetchReadinessData = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [resSummary, resThresholds] = await Promise.all([
        fetch('/api/admin/compliance-summary'),
        fetch('/api/admin/readiness-thresholds')
      ]);

      if (resSummary.ok) {
        const summaryData = await resSummary.json();
        setData(summaryData);
      } else {
        const errData = await resSummary.json().catch(() => ({}));
        setFetchError(errData.error || 'Failed to fetch compliance summary');
      }

      if (resThresholds.ok) {
        const thresholdData = await resThresholds.json();
        setThresholds(thresholdData);
        const initEdits: Record<string, string> = {};
        thresholdData.forEach((t: ThresholdItem) => {
          initEdits[t.clause_id] = t.target_value !== null ? String(t.target_value) : '';
        });
        setEditingValues(initEdits);
      }
    } catch (err: any) {
      console.error('Failed to fetch readiness data:', err);
      setFetchError('Connection error while reaching backend server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReadinessData();
  }, []);

  const handleSaveThreshold = async (clauseId: string) => {
    const rawVal = editingValues[clauseId];
    const targetVal = rawVal === '' || rawVal === null ? null : parseFloat(rawVal);
    
    setSaveStatus(prev => ({ ...prev, [clauseId]: 'saving' }));
    try {
      const res = await fetch('/api/admin/readiness-thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clause_id: clauseId, target_value: targetVal })
      });
      if (res.ok) {
        setSaveStatus(prev => ({ ...prev, [clauseId]: 'saved' }));
        setTimeout(() => setSaveStatus(prev => ({ ...prev, [clauseId]: '' })), 2000);
        fetchReadinessData();
      } else {
        const errJson = await res.json();
        alert(`Failed to update threshold: ${errJson.detail || errJson.error}`);
        setSaveStatus(prev => ({ ...prev, [clauseId]: 'error' }));
      }
    } catch (err) {
      console.error('Error saving threshold:', err);
      setSaveStatus(prev => ({ ...prev, [clauseId]: 'error' }));
    }
  };

  const toggleEvidence = (clauseId: string) => {
    setExpandedEvidence(prev => ({ ...prev, [clauseId]: !prev[clauseId] }));
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans, Inter, sans-serif)' }}>
      {/* PERSISTENT AUDIT DISCLAIMER BANNER */}
      <div style={{
        background: '#0f172a',
        borderRadius: '12px',
        border: '1px solid rgba(59,130,246,0.3)',
        borderLeft: '5px solid #3b82f6',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        boxShadow: '0 8px 25px rgba(0,0,0,0.4)'
      }}>
        <Info style={{ width: '24px', height: '24px', color: '#60a5fa', flexShrink: 0 }} />
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Persistent Audit & Behavioral Telemetry Disclaimer
          </h4>
          <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.5 }}>
            {data?.disclaimer || 'Tingkat kesiapan ini merupakan indikator internal berdasarkan telemetri perilaku (human telemetry) dan bukan merupakan penentuan sertifikasi resmi atau hasil audit formal. Indikator ini berfungsi sebagai panduan sinyal risiko untuk persiapan audit sesungguhnya.'}
          </p>
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {fetchError && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#f87171',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertTriangle style={{ width: '18px', height: '18px' }} />
          <span>{fetchError}</span>
        </div>
      )}

      {/* OVERALL READINESS STATUS CARD */}
      {data && (
        <div style={{
          background: '#0e172a',
          borderRadius: '12px',
          border: '1px solid rgba(148,163,184,0.15)',
          padding: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>
              Overall Human Telemetry Readiness Indicator
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {data.overall_readiness_indicator}
              </h2>
              <span style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                background: data.overall_readiness_indicator === 'Strong Readiness' ? 'rgba(16,185,129,0.15)' :
                            data.overall_readiness_indicator === 'Partial Readiness' ? 'rgba(245,158,11,0.15)' :
                            data.overall_readiness_indicator === 'Needs Attention' ? 'rgba(239,68,68,0.15)' : 'rgba(148,163,184,0.15)',
                color: data.overall_readiness_indicator === 'Strong Readiness' ? '#34d399' :
                       data.overall_readiness_indicator === 'Partial Readiness' ? '#fbbf24' :
                       data.overall_readiness_indicator === 'Needs Attention' ? '#f87171' : '#94a3b8',
                border: `1px solid ${
                  data.overall_readiness_indicator === 'Strong Readiness' ? 'rgba(16,185,129,0.3)' :
                  data.overall_readiness_indicator === 'Partial Readiness' ? 'rgba(245,158,11,0.3)' :
                  data.overall_readiness_indicator === 'Needs Attention' ? 'rgba(239,68,68,0.3)' : 'rgba(148,163,184,0.3)'
                }`
              }}>
                {data.overall_readiness_indicator}
              </span>
            </div>
          </div>

          <button
            onClick={fetchReadinessData}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid rgba(148,163,184,0.2)',
              cursor: 'pointer'
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh Telemetry
          </button>
        </div>
      )}

      {/* CLAUSE-MAPPED READINESS CARDS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {data?.clause_readiness.map((c, idx) => {
          let badgeBg = 'rgba(16,185,129,0.15)';
          let badgeColor = '#34d399';
          let badgeBorder = 'rgba(16,185,129,0.3)';

          if (c.readiness_tier === 'Needs Attention') {
            badgeBg = 'rgba(239,68,68,0.15)';
            badgeColor = '#f87171';
            badgeBorder = 'rgba(239,68,68,0.3)';
          } else if (c.readiness_tier === 'Partial Readiness') {
            badgeBg = 'rgba(245,158,11,0.15)';
            badgeColor = '#fbbf24';
            badgeBorder = 'rgba(245,158,11,0.3)';
          } else if (c.readiness_tier === 'Not Configured') {
            badgeBg = 'rgba(148,163,184,0.15)';
            badgeColor = '#94a3b8';
            badgeBorder = 'rgba(148,163,184,0.3)';
          }

          const isEvidenceOpen = !!expandedEvidence[c.clause_id];

          return (
            <div key={idx} style={{
              background: '#0e172a',
              borderRadius: '12px',
              border: '1px solid rgba(148,163,184,0.15)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace', background: 'rgba(56,189,248,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(56,189,248,0.2)' }}>
                    {c.clause_number}
                  </span>

                  <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}` }}>
                    {c.readiness_tier}
                  </span>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                  {c.clause_title}
                </h3>

                <div style={{ background: '#080d19', borderRadius: '8px', padding: '12px', border: '1px solid rgba(148,163,184,0.1)', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: '#94a3b8' }}>Telemetry Current Value:</span>
                    <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                      {c.current_value !== null ? `${c.current_value} ${c.unit}` : 'Unset / N/A'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#94a3b8' }}>Readiness Target Benchmark:</span>
                    <span style={{ fontWeight: 700, color: c.target_value !== null ? '#60a5fa' : '#94a3b8' }}>
                      {c.target_value !== null ? `${c.target_value} ${c.unit}` : 'Unset (Org Specific)'}
                    </span>
                  </div>
                </div>

                {/* FRAMEWORK MAPPING EVIDENCE BREAKDOWN (NEW) */}
                {c.evidence && (
                  <div style={{ marginBottom: '12px' }}>
                    <button
                      onClick={() => toggleEvidence(c.clause_id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#60a5fa',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0,
                        marginBottom: isEvidenceOpen ? '8px' : '0'
                      }}
                    >
                      <FileText style={{ width: '12px', height: '12px' }} />
                      {isEvidenceOpen ? 'Hide Evidence Breakdown ▲' : 'Show Evidence Breakdown ▼'}
                    </button>

                    {isEvidenceOpen && (
                      <div style={{
                        background: 'rgba(15,23,42,0.8)',
                        borderRadius: '6px',
                        border: '1px solid rgba(59,130,246,0.2)',
                        padding: '10px 12px',
                        fontSize: '11px',
                        color: '#cbd5e1'
                      }}>
                        <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: '4px' }}>
                          {c.evidence.label}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#38bdf8', marginBottom: '6px', background: 'rgba(0,0,0,0.3)', padding: '3px 6px', borderRadius: '4px' }}>
                          Formula: {c.evidence.formula}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', color: '#94a3b8' }}>
                          {Object.entries(c.evidence.components).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>• {k.replace(/_/g, ' ')}:</span>
                              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(148,163,184,0.1)', fontSize: '11px', color: '#94a3b8', lineHeight: 1.4, fontStyle: 'italic' }}>
                <strong>Source Rationale:</strong> {c.rationale}
              </div>
            </div>
          );
        })}
      </div>

      {/* ADMIN THRESHOLD CONFIGURATION PANEL */}
      {!readOnly && (
        <div style={{
          background: '#0e172a',
          borderRadius: '12px',
          border: '1px solid rgba(148,163,184,0.15)',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          marginTop: '10px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit2 style={{ width: '18px', height: '18px', color: '#60a5fa' }} />
            Admin Readiness Threshold Configuration Panel
          </h3>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 20px 0' }}>
            Configure risk-based organizational target values per clause. Statutory legal mandates (e.g. UU PDP Pasal 46) are immutably locked.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', color: '#e2e8f0', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#172544', color: '#93c5fd', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
                  <th style={{ padding: '12px 16px' }}>Clause Number & Title</th>
                  <th style={{ padding: '12px 16px' }}>Legal Mandate Status</th>
                  <th style={{ padding: '12px 16px' }}>Target Benchmark Value</th>
                  <th style={{ padding: '12px 16px' }}>Sourced Rationale</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(148,163,184,0.08)', background: idx % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.4)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      <span style={{ color: '#38bdf8', fontFamily: 'monospace', display: 'block' }}>{t.clause_number}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{t.clause_title}</span>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {t.is_legally_mandated ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700, fontSize: '10px' }} title="Fixed by law — not adjustable">
                          <Lock style={{ width: '12px', height: '12px' }} /> Fixed by law — not adjustable
                        </span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', fontWeight: 700, fontSize: '10px' }}>
                          Risk-Based Editable Target
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {t.is_legally_mandated ? (
                        <span style={{ fontWeight: 700, color: '#f8fafc', background: '#080d19', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(148,163,184,0.15)', display: 'inline-block' }}>
                          {t.target_value} {t.unit} (Locked)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            placeholder="Unset"
                            value={editingValues[t.clause_id] ?? ''}
                            onChange={e => setEditingValues({ ...editingValues, [t.clause_id]: e.target.value })}
                            style={{
                              width: '100px',
                              background: '#080d19',
                              border: '1px solid rgba(148,163,184,0.25)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              color: '#f8fafc',
                              fontSize: '12px',
                              outline: 'none'
                            }}
                          />
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{t.unit}</span>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '11px', color: '#94a3b8', maxWidth: '300px', lineHeight: 1.4 }}>
                      {t.rationale}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {!t.is_legally_mandated && (
                        <button
                          onClick={() => handleSaveThreshold(t.clause_id)}
                          disabled={saveStatus[t.clause_id] === 'saving'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: saveStatus[t.clause_id] === 'saved' ? '#10b981' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                            color: '#ffffff',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          {saveStatus[t.clause_id] === 'saved' ? <Check style={{ width: '12px', height: '12px' }} /> : <Save style={{ width: '12px', height: '12px' }} />}
                          {saveStatus[t.clause_id] === 'saved' ? 'Saved!' : 'Save'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
