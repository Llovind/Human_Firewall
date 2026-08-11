'use client';

import React, { useState } from 'react';
import { AlertTriangle, FileWarning, Fish, Shield, Bot, Search, CheckCircle2 } from 'lucide-react';
import { Incident, timeAgo } from '@/components/admin/types';

interface IncidentTriageSectionProps {
  readOnly: boolean;
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onResolveIncident: (id: string) => void;
}

const severityIcon: Record<string, React.ReactNode> = {
  critical: <AlertTriangle size={16} style={{ color: 'var(--danger)', marginRight: '4px' }} />,
  high: <AlertTriangle size={16} style={{ color: 'var(--warning)', marginRight: '4px' }} />,
  medium: <AlertTriangle size={16} style={{ color: 'var(--info)', marginRight: '4px' }} />,
  low: <CheckCircle2 size={16} style={{ color: 'var(--success)', marginRight: '4px' }} />,
};

const typeIcon: Record<string, React.ReactNode> = {
  phishing_click: <Fish size={16} style={{ marginRight: '4px' }} />,
  phishing_report: <Shield size={16} style={{ marginRight: '4px' }} />,
  malware_detected: <Bot size={16} style={{ marginRight: '4px' }} />,
  suspicious_url: <Search size={16} style={{ marginRight: '4px' }} />,
  dlp_violation: <FileWarning size={16} style={{ marginRight: '4px' }} />,
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
              <div className={`panel glass-card fade-up-2`} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                <div className="panel-header">
                  <h2 className="panel-title"><AlertTriangle size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Insiden Terbaru</h2>
                  <span className="panel-count">{incidents.length} total</span>
                </div>
                <div className="incident-list" style={{ flex: 1 }}>
                  {incidents.length > 0 ? (
                    paginatedIncidents.map(inc => (
                      <div key={inc.id} className="incident-row" onClick={() => !readOnly && onSelectIncident(inc)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
                        <div className="incident-icon">{typeIcon[inc.type] || <FileWarning size={16} />}</div>
                        <div className="incident-info">
                          <div className="incident-title">{inc.description}</div>
                          <div className="incident-meta">
                            <span className="mono">{inc.id}</span>
                            <span>·</span>
                            <span>{inc.source}</span>
                            <span>·</span>
                            <span>{timeAgo(inc.timestamp)}</span>
                          </div>
                        </div>
                        <span className={`badge badge-${inc.severity}`}>
                          {severityIcon[inc.severity]} {inc.severity}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Belum ada insiden tercatat.
                    </div>
                  )}
                </div>
                {/* Pagination Controls */}
                {incidents.length > INCIDENTS_PER_PAGE && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    <button 
                      onClick={() => setIncidentPage(p => Math.max(1, p - 1))}
                      disabled={incidentPage === 1}
                      style={{ background: 'none', border: 'none', color: incidentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: incidentPage === 1 ? 'default' : 'pointer', fontWeight: 600, padding: '4px 8px' }}
                    >
                      &laquo; Prev
                    </button>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Page {incidentPage} of {incidentTotalPages}
                    </span>
                    <button 
                      onClick={() => setIncidentPage(p => Math.min(incidentTotalPages, p + 1))}
                      disabled={incidentPage === incidentTotalPages}
                      style={{ background: 'none', border: 'none', color: incidentPage === incidentTotalPages ? 'var(--text-muted)' : 'var(--text-primary)', cursor: incidentPage === incidentTotalPages ? 'default' : 'pointer', fontWeight: 600, padding: '4px 8px' }}
                    >
                      Next &raquo;
                    </button>
                  </div>
                )}
              </div>
  );
}
