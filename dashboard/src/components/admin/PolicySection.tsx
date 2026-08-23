'use client';

import React, { useState } from 'react';
import { Scale, ShieldBan, AlertTriangle, CheckCircle, Eye, Cpu, Play, CheckCircle2 } from 'lucide-react';
import { PolicyDecision, timeAgo } from '@/components/admin/types';

interface PolicySectionProps {
  readOnly: boolean;
  decisions: PolicyDecision[];
}

const actionIcon: Record<string, React.ReactNode> = {
  block: <ShieldBan size={16} style={{ color: 'var(--danger)' }} />,
  warning: <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />,
  allow: <CheckCircle size={16} style={{ color: 'var(--success)' }} />,
  notify_soc: <Eye size={16} style={{ color: 'var(--info)' }} />
};

export default function PolicySection({ readOnly, decisions }: PolicySectionProps) {
  const safeDecisions = Array.isArray(decisions) ? decisions : [];

  // Simulator state
  const [simTier, setSimTier] = useState('Guardian');
  const [simThreatScore, setSimThreatScore] = useState(65);
  const [simResult, setSimResult] = useState<{ action: string; reason: string } | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const handleSimulate = async () => {
    setSimLoading(true);
    try {
      const res = await fetch('/api/admin/policy/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threatScore: simThreatScore, userTier: simTier }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch {
      // ignore
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="font-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', marginBottom: '48px' }}>
      
      {/* 2D Adaptive Matrix Header Card */}
      <div className="glass-card fade-up" style={{ padding: '20px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="panel-title font-heading" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
              <Scale size={20} /> 2D Adaptive Policy Decision Engine
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Dynamic risk convergence: Threat Intelligence Severity (0–100) × Employee Vulnerability Tier (Vulnerable, Guardian, Sentinel).
            </p>
          </div>
          <span className="panel-count font-mono-data">{safeDecisions.length} live decisions</span>
        </div>

        {/* 2D Rule Reference Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '12px' }}>
          <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-danger)', border: '1px solid var(--border-danger)' }}>
            <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldBan size={14} /> BLOCK (Red)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-danger)', marginTop: '4px', lineHeight: 1.4 }}>
              Severity ≥ 75 OR (Severity ≥ 50 AND Tier <strong>Vulnerable</strong>)
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-warning)', border: '1px solid var(--border-warning)' }}>
            <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} /> WARN & MANDATE (Amber)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-warning)', marginTop: '4px', lineHeight: 1.4 }}>
              Severity 40–74 AND Tier <strong>Guardian</strong> (requires security confirmation)
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-success)', border: '1px solid var(--border-success)' }}>
            <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} /> ALLOW & AUDIT (Green)
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-success)', marginTop: '4px', lineHeight: 1.4 }}>
              Severity &lt; 40 AND Tier <strong>Sentinel / Champion</strong> (seamless access)
            </div>
          </div>
        </div>
      </div>

      {/* Interactive 2D Policy Simulator */}
      {!readOnly && (
        <div className="glass-card fade-up" style={{ padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Cpu size={16} style={{ color: 'var(--accent)' }} /> Interactive 2D Matrix Evaluator
            </h3>
            <button
              onClick={handleSimulate}
              disabled={simLoading}
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
              <Play size={12} /> {simLoading ? 'Evaluating...' : 'Test Policy Evaluation'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                EMPLOYEE VULNERABILITY TIER
              </label>
              <select
                value={simTier}
                onChange={(e) => setSimTier(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
              >
                <option value="Vulnerable">🚨 Vulnerable (High Risk / Low Training)</option>
                <option value="Guardian">🛡️ Guardian (Standard Security Awareness)</option>
                <option value="Sentinel">👑 Sentinel / Champion (Elite Security Hygiene)</option>
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  THREAT SEVERITY SCORE
                </label>
                <span className="font-mono-data" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                  {simThreatScore} / 100
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={simThreatScore}
                onChange={(e) => setSimThreatScore(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>
          </div>

          {simResult && (
            <div style={{
              marginTop: '14px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: simResult.action === 'block' ? 'var(--bg-danger)' : simResult.action === 'warning' ? 'var(--bg-warning)' : 'var(--bg-success)',
              border: `1px solid ${simResult.action === 'block' ? 'var(--border-danger)' : simResult.action === 'warning' ? 'var(--border-warning)' : 'var(--border-success)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: simResult.action === 'block' ? 'var(--text-danger)' : simResult.action === 'warning' ? 'var(--text-warning)' : 'var(--text-success)'
                }}>
                  Decision: {simResult.action.toUpperCase()}
                </div>
                <div style={{ fontSize: '12px', marginTop: '2px', color: 'var(--text-primary)' }}>
                  {simResult.reason}
                </div>
              </div>
              <span className={`badge badge-${simResult.action} font-body`}>
                {actionIcon[simResult.action]} {simResult.action.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Live Policy Stream Card */}
      <div className="panel glass-card fade-up" style={{ marginBottom: 0 }}>
        {/* Metric strip */}
        <div className="policy-summary-strip" style={{ marginBottom: '16px' }}>
          {(['block', 'warning', 'allow', 'notify_soc'] as const).map(action => (
            <div key={action} className="policy-summary-item">
              <div className="policy-summary-value font-mono-data">
                {safeDecisions.filter(d => (d.finalAction || '').toLowerCase() === action).length}
              </div>
              <div className="policy-summary-label font-body">{action.replace('_', ' ').toUpperCase()}</div>
            </div>
          ))}
        </div>

        <div className="policy-list">
          {safeDecisions.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No policy engine decisions recorded yet.
            </div>
          ) : (
            safeDecisions.map(d => (
              <div key={d.id} className="policy-card font-body">
                <div className="policy-header-row">
                  <span className="font-mono-data policy-id">{d.id}</span>
                  <span className={`badge badge-${d.finalAction} font-body`}>
                    {actionIcon[d.finalAction]} {(d.finalAction || '').replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="policy-scores">
                  <div className="policy-score-item">
                    <span className="policy-score-label">Threat Score</span>
                    <div className="policy-score-bar">
                      <div className="policy-score-fill threat-fill" style={{ width: `${d.threatScore}%` }} />
                    </div>
                    <span className="policy-score-val font-mono-data">{d.threatScore}</span>
                  </div>
                  <div className="policy-score-combine font-mono-data">+</div>
                  <div className="policy-score-item">
                    <span className="policy-score-label">Behavior Score</span>
                    <div className="policy-score-bar">
                      <div className="policy-score-fill behavior-fill" style={{ width: `${d.behaviorScore}%` }} />
                    </div>
                    <span className="policy-score-val font-mono-data">{d.behaviorScore}</span>
                  </div>
                  <div className="policy-score-combine font-mono-data">→</div>
                  <div className="policy-final-action">
                    {actionIcon[d.finalAction]}
                  </div>
                </div>
                <p className="policy-reason">{d.reason}</p>
                {d.url && <p className="policy-url font-mono-data">{d.url}</p>}
                <span className="policy-time font-mono-data">{timeAgo(d.timestamp)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
