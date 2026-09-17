'use client';

import React, { useState } from 'react';
import { AlertTriangle, FileWarning, Fish, Shield, Bot, Search, CheckCircle2, HelpCircle } from 'lucide-react';
import { Incident, timeAgo } from '@/components/admin/types';

interface IncidentTriageSectionProps {
  readOnly: boolean;
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onResolveIncident: (id: string) => void;
}

const severityIcon: Record<string, React.ReactNode> = {
  critical: <AlertTriangle size={14} style={{ color: 'var(--danger)', marginRight: '4px' }} />,
  high: <AlertTriangle size={14} style={{ color: 'var(--warning)', marginRight: '4px' }} />,
  medium: <AlertTriangle size={14} style={{ color: 'var(--info)', marginRight: '4px' }} />,
  low: <CheckCircle2 size={14} style={{ color: 'var(--success)', marginRight: '4px' }} />,
};

const typeIcon: Record<string, React.ReactNode> = {
  phishing_click: <Fish size={14} style={{ marginRight: '4px' }} />,
  phishing_report: <Shield size={14} style={{ marginRight: '4px' }} />,
  malware_detected: <Bot size={14} style={{ marginRight: '4px' }} />,
  suspicious_url: <Search size={14} style={{ marginRight: '4px' }} />,
  dlp_violation: <FileWarning size={14} style={{ marginRight: '4px' }} />,
};

export default function IncidentTriageSection({
  readOnly,
  incidents,
  onSelectIncident,
  onResolveIncident
}: IncidentTriageSectionProps) {
  const [incidentPage, setIncidentPage] = useState(1);
  const INCIDENTS_PER_PAGE = 8;
  const incidentTotalPages = Math.max(1, Math.ceil((incidents?.length || 0) / INCIDENTS_PER_PAGE));
  const paginatedIncidents = (incidents || []).slice((incidentPage - 1) * INCIDENTS_PER_PAGE, incidentPage * INCIDENTS_PER_PAGE);

  return (
    <div className="panel glass-card fade-up-2 font-body" style={{
      marginBottom: 0,
      display: 'flex',
      flexDirection: 'column',
      padding: '24px'
    }}>
      <div className="panel-header" style={{ marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
        <h2 className="panel-title font-heading" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={20} style={{ color: 'var(--text-danger)' }} /> Recent Threat Incidents
        </h2>
        <span className="font-mono-data" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', background: 'rgba(33, 150, 243, 0.1)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {incidents.length} total
        </span>
      </div>
      <div className="incident-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {incidents.length > 0 ? (
          paginatedIncidents.map(inc => (
            <div key={inc.id} className="incident-row" onClick={() => !readOnly && onSelectIncident(inc)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
              <div className="incident-icon">{typeIcon[inc.type] || <FileWarning size={16} />}</div>
              <div className="incident-info">
                <div className="incident-title font-body">{inc.description}</div>
                <div className="incident-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="font-mono-data" style={{ fontWeight: 700, color: 'var(--accent)' }}>{inc.id}</span>
                  <span>•</span>
                  <span>{inc.source}</span>
                  <span>•</span>
                  <span className="font-mono-data">{timeAgo(inc.timestamp)}</span>
                </div>
              </div>
              <span className={`badge badge-${inc.severity || 'muted'} font-body`} style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center' }}>
                {severityIcon[inc.severity?.toLowerCase()] || <HelpCircle size={14} style={{ color: 'var(--text-muted)', marginRight: '4px' }} />} {(inc.severity || 'UNKNOWN').toUpperCase()}
              </span>
            </div>
          ))
        ) : (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            No security incidents recorded.
          </div>
        )}
      </div>
      {/* Pagination Controls */}
      {incidents.length > INCIDENTS_PER_PAGE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', marginTop: '16px' }}>
          <button 
            onClick={() => setIncidentPage(p => Math.max(1, p - 1))}
            disabled={incidentPage === 1}
            className="font-body"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: incidentPage === 1 ? 'var(--text-muted)' : 'var(--accent)', cursor: incidentPage === 1 ? 'default' : 'pointer', fontWeight: 700, padding: '6px 12px', fontSize: '12px' }}
          >
            &laquo; Prev
          </button>
          <span className="font-mono-data" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            Page {incidentPage} of {incidentTotalPages}
          </span>
          <button 
            onClick={() => setIncidentPage(p => Math.min(incidentTotalPages, p + 1))}
            disabled={incidentPage === incidentTotalPages}
            className="font-body"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: incidentPage === incidentTotalPages ? 'var(--text-muted)' : 'var(--accent)', cursor: incidentPage === incidentTotalPages ? 'default' : 'pointer', fontWeight: 700, padding: '6px 12px', fontSize: '12px' }}
          >
            Next &raquo;
          </button>
        </div>
      )}
    </div>
  );
}
