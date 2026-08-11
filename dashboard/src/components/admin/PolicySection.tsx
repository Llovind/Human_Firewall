'use client';

import React from 'react';
import { Scale, ShieldBan, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { PolicyDecision, timeAgo } from '@/components/admin/types';

interface PolicySectionProps {
  readOnly: boolean;
  decisions: PolicyDecision[];
}

const actionIcon: Record<string, React.ReactNode> = {
  block: <ShieldBan size={16} />,
  warning: <AlertTriangle size={16} />,
  allow: <CheckCircle size={16} />,
  notify_soc: <Eye size={16} />
};

export default function PolicySection({ readOnly, decisions }: PolicySectionProps) {
  const safeDecisions = Array.isArray(decisions) ? decisions : [];

  return (
    <div className={`panel glass-card fade-up`} style={{ marginBottom: '48px' }}>
      <div className="panel-header">
        <h2 className="panel-title"><Scale size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Policy Decisions & Adaptive Enforcement</h2>
        <span className="panel-count">{safeDecisions.length} keputusan</span>
      </div>

      {/* Ringkasan horizontal */}
      <div className="policy-summary-strip">
        {(['block', 'warning', 'allow', 'notify_soc'] as const).map(action => (
          <div key={action} className="policy-summary-item">
            <div className="policy-summary-value">
              {safeDecisions.filter(d => (d.finalAction || '').toLowerCase() === action).length}
            </div>
            <div className="policy-summary-label">{action.replace('_', ' ').toUpperCase()}</div>
          </div>
        ))}
      </div>

      <div className="policy-list">
        {safeDecisions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Belum ada keputusan policy engine terrekam.
          </div>
        ) : (
          safeDecisions.map(d => (
            <div key={d.id} className="policy-card">
              <div className="policy-header-row">
                <span className="mono policy-id">{d.id}</span>
                <span className={`badge badge-${d.finalAction}`}>
                  {actionIcon[d.finalAction]} {(d.finalAction || '').replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="policy-scores">
                <div className="policy-score-item">
                  <span className="policy-score-label">Threat Score</span>
                  <div className="policy-score-bar">
                    <div className="policy-score-fill threat-fill" style={{ width: `${d.threatScore}%` }} />
                  </div>
                  <span className="policy-score-val">{d.threatScore}</span>
                </div>
                <div className="policy-score-combine">+</div>
                <div className="policy-score-item">
                  <span className="policy-score-label">Behavior Score</span>
                  <div className="policy-score-bar">
                    <div className="policy-score-fill behavior-fill" style={{ width: `${d.behaviorScore}%` }} />
                  </div>
                  <span className="policy-score-val">{d.behaviorScore}</span>
                </div>
                <div className="policy-score-combine">→</div>
                <div className="policy-final-action">
                  {actionIcon[d.finalAction]}
                </div>
              </div>
              <p className="policy-reason">{d.reason}</p>
              {d.url && <p className="policy-url mono">{d.url}</p>}
              <span className="policy-time">{timeAgo(d.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
