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

  const renderClauseCard = (c: ReadinessClause, idx: number) => {
    const isNotConfigured = c.readiness_tier === 'Not Configured' || c.target_value === null;
    const isEvidenceOpen = !!expandedEvidence[c.clause_id];

    let badgeBg = 'var(--bg-success)';
    let badgeColor = 'var(--text-success)';
    let badgeBorder = 'var(--border-success)';

    if (c.readiness_tier === 'Needs Attention') {
      badgeBg = 'var(--bg-danger)';
      badgeColor = 'var(--text-danger)';
      badgeBorder = 'var(--border-danger)';
    } else if (c.readiness_tier === 'Partial Readiness') {
      badgeBg = 'var(--bg-warning)';
      badgeColor = 'var(--text-warning)';
      badgeBorder = 'var(--border-warning)';
    } else if (isNotConfigured) {
      badgeBg = 'var(--bg-neutral)';
      badgeColor = 'var(--text-neutral)';
      badgeBorder = 'var(--border-neutral)';
    }

    return (
      <div key={c.clause_id || idx} className="stat-card glass-card font-body" style={{
        borderRadius: '14px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: isNotConfigured ? 0.92 : 1,
        textAlign: 'left'
      }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
            <span className="font-mono-data" style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent)', background: 'rgba(33,150,243,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
              {c.clause_number}
            </span>

            <span className="font-body" style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: badgeBg, color: badgeColor, border: `1px solid ${badgeBorder}` }}>
              {c.readiness_tier}
            </span>
          </div>

          <h3 className="font-body" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 10px 0', lineHeight: 1.4, textAlign: 'left' }}>
            {c.clause_title}
          </h3>

          {isNotConfigured ? (
            <div style={{
              background: 'var(--bg-base)',
              borderRadius: '8px',
              padding: '12px 14px',
              border: '1px dashed var(--border)',
              marginBottom: '12px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 600, lineHeight: 1.4, textAlign: 'left' }}>
                <Info style={{ width: '15px', height: '15px', flexShrink: 0, color: 'var(--text-muted)', marginTop: '2px' }} />
                <span style={{ textAlign: 'left' }}>
                  Threshold not set. Adjust the target benchmark in the admin panel below to activate readiness scoring.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-base)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border)', marginBottom: '12px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', textAlign: 'left' }}>
                <span style={{ color: 'var(--text-muted)' }}>Telemetry Current Value:</span>
                <span className="font-mono-data" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {c.current_value !== null ? `${c.current_value} ${c.unit}` : 'Unset / N/A'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', textAlign: 'left' }}>
                <span style={{ color: 'var(--text-muted)' }}>Readiness Target Benchmark:</span>
                <span className="font-mono-data" style={{ fontWeight: 700, color: '#2196F3' }}>
                  {c.target_value !== null ? `${c.target_value} ${c.unit}` : 'Unset (Org Specific)'}
                </span>
              </div>
            </div>
          )}

          {/* FRAMEWORK MAPPING EVIDENCE BREAKDOWN */}
          {c.evidence && (
            <div style={{ marginBottom: '12px', textAlign: 'left' }}>
              <button
                onClick={() => toggleEvidence(c.clause_id)}
                className="font-body"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2196F3',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                  marginBottom: isEvidenceOpen ? '8px' : '0',
                  textAlign: 'left'
                }}
              >
                <FileText style={{ width: '12px', height: '12px' }} />
                {isEvidenceOpen ? 'Hide Evidence Breakdown ▲' : 'Show Evidence Breakdown ▼'}
              </button>

              {isEvidenceOpen && (
                <div style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  padding: '10px 12px',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  textAlign: 'left'
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: '4px', textAlign: 'left' }}>
                    {c.evidence.label}
                  </div>
                  <div className="font-mono-data" style={{ fontSize: '10px', color: 'var(--accent)', marginBottom: '6px', background: 'var(--bg-surface)', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border)', textAlign: 'left' }}>
                    Formula: {c.evidence.formula}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'left' }}>
                    {Object.entries(c.evidence.components).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'left' }}>
                        <span>• {k.replace(/_/g, ' ')}:</span>
                        <span className="font-mono-data" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4, fontStyle: 'italic', textAlign: 'left' }}>
          <strong>Source Rationale:</strong> {c.rationale}
        </div>
      </div>
    );
  };

  const legalClauses = (data?.clause_readiness || []).filter(c =>
    c.clause_id.startsWith('UU_PDP') || c.clause_number.includes('UU PDP') || c.is_legally_mandated
  );
  const frameworkClauses = (data?.clause_readiness || []).filter(c =>
    !legalClauses.some(lc => lc.clause_id === c.clause_id)
  );

  return (
    <div className="font-body" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* PERSISTENT AUDIT DISCLAIMER BANNER */}
      <div className="panel glass-card" style={{
        borderLeft: '5px solid #2196F3',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: 0
      }}>
        <Info style={{ width: '24px', height: '24px', color: '#2196F3', flexShrink: 0 }} />
        <div>
          <h4 className="font-heading" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Persistent Audit &amp; Behavioral Telemetry Disclaimer
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
            {data?.disclaimer || 'This readiness level is an internal indicator derived from behavioral telemetry and does not constitute a formal certification determination or official audit finding. This indicator serves as a risk signal guide for audit preparedness.'}
          </p>
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {fetchError && (
        <div style={{
          background: 'var(--bg-danger)',
          border: '1px solid var(--border-danger)',
          borderRadius: '10px',
          padding: '12px 16px',
          color: 'var(--text-danger)',
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
        <div className="panel glass-card" style={{
          padding: '22px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: 0
        }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Overall Human Telemetry Readiness Indicator
            </span>
            <div style={{ marginTop: '6px' }}>
              <h2 className="font-heading" style={{
                fontSize: '22px',
                fontWeight: 600,
                color: data.overall_readiness_indicator === 'Strong Readiness' ? 'var(--text-success)' :
                       data.overall_readiness_indicator === 'Partial Readiness' ? 'var(--text-warning)' :
                       data.overall_readiness_indicator === 'Needs Attention' ? 'var(--text-danger)' : 'var(--text-muted)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {data.overall_readiness_indicator === 'Strong Readiness' && <ShieldCheck style={{ width: '22px', height: '22px', color: 'var(--text-success)' }} />}
                {data.overall_readiness_indicator === 'Partial Readiness' && <ShieldAlert style={{ width: '22px', height: '22px', color: 'var(--text-warning)' }} />}
                {data.overall_readiness_indicator === 'Needs Attention' && <AlertTriangle style={{ width: '22px', height: '22px', color: 'var(--text-danger)' }} />}
                {data.overall_readiness_indicator}
              </h2>
            </div>
          </div>

          <button
            onClick={fetchReadinessData}
            disabled={isLoading}
            className="font-body"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              cursor: 'pointer'
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh Telemetry
          </button>
        </div>
      )}

      {/* ── SECTION 1: LEGAL & REGULATORY OBLIGATIONS (UU PDP) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock style={{ width: '18px', height: '18px', color: '#2196F3' }} />
            <h3 className="font-heading" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Legal &amp; Regulatory Obligations (Personal Data Protection / PDP)
            </h3>
          </div>
          <span className="font-body" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', background: 'rgba(33, 150, 243, 0.1)', padding: '3px 10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            {legalClauses.length} Mandatory Clauses
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {legalClauses.map(renderClauseCard)}
        </div>
      </div>

      {/* ── SECTION 2: SECURITY FRAMEWORK READINESS (ISO/IEC 27001:2022) ── */}
      <div style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck style={{ width: '18px', height: '18px', color: '#2196F3' }} />
            <h3 className="font-heading" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Security Framework Readiness (ISO/IEC 27001:2022)
            </h3>
          </div>
          <span className="font-body" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', background: 'rgba(33, 150, 243, 0.1)', padding: '3px 10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            {frameworkClauses.length} Control Clauses
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {frameworkClauses.map(renderClauseCard)}
        </div>
      </div>

      {/* ADMIN THRESHOLD CONFIGURATION PANEL */}
      {!readOnly && (
        <div className="panel glass-card" style={{
          padding: '24px',
          marginTop: '10px',
          borderRadius: '16px'
        }}>
          <h3 className="font-heading" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit2 style={{ width: '18px', height: '18px', color: '#2196F3' }} />
            Admin Readiness Threshold Configuration Panel
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
            Configure risk-based organizational target values per clause. Statutory legal mandates (e.g. UU PDP Article 46) are immutably locked.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', fontSize: '12px', color: 'var(--text-primary)', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Clause Identifier &amp; Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Legal Mandate Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Target Benchmark Value</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-secondary)' }}>Sourced Rationale</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                      <span className="font-mono-data" style={{ color: 'var(--accent)', display: 'block' }}>{t.clause_number}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.clause_title}</span>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {t.is_legally_mandated ? (
                        <span className="font-body" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-danger)', color: 'var(--text-danger)', border: '1px solid var(--border-danger)', fontWeight: 700, fontSize: '10px' }} title="Fixed by law: not adjustable">
                          <Lock style={{ width: '12px', height: '12px' }} /> Fixed by law: not adjustable
                        </span>
                      ) : (
                        <span className="font-body" style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(33,150,243,0.12)', color: 'var(--accent-dim)', border: '1px solid var(--border)', fontWeight: 700, fontSize: '10px' }}>
                          Risk-Based Editable Target
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      {t.is_legally_mandated ? (
                        <span className="font-mono-data" style={{ fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-base)', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', display: 'inline-block' }}>
                          {t.target_value} {t.unit} (Locked)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            placeholder="Unset"
                            value={editingValues[t.clause_id] ?? ''}
                            onChange={e => setEditingValues({ ...editingValues, [t.clause_id]: e.target.value })}
                            className="font-mono-data"
                            style={{
                              width: '100px',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              outline: 'none'
                            }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.unit}</span>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', fontSize: '11px', color: 'var(--text-muted)', maxWidth: '300px', lineHeight: 1.4 }}>
                      {t.rationale}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {!t.is_legally_mandated && (
                        <button
                          onClick={() => handleSaveThreshold(t.clause_id)}
                          disabled={saveStatus[t.clause_id] === 'saving'}
                          className="font-body"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: saveStatus[t.clause_id] === 'saved' ? 'var(--bg-success)' : 'var(--accent)',
                            color: saveStatus[t.clause_id] === 'saved' ? 'var(--text-success)' : '#ffffff',
                            border: saveStatus[t.clause_id] === 'saved' ? '1px solid var(--border-success)' : 'none',
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

export default ComplianceReadinessSection;
