'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Shield, AlertTriangle, CheckCircle2, Activity, RefreshCw, Filter, Search, ArrowLeft, ArrowUpRight } from 'lucide-react';
import '../../dashboard.css';

interface Incident {
  id: string;
  timestamp: string;
  type: string;
  severity: string;
  source: string;
  target: string;
  description: string;
  status: string;
}

export default function SOCDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('all');

  const fetchSOCData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/incident');
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
      }
    } catch (e) {
      console.error('Failed to fetch SOC incidents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSOCData();
  }, []);

  const filteredIncidents = incidents.filter(i => 
    filterSeverity === 'all' ? true : i.severity.toLowerCase() === filterSeverity
  );

  return (
    <div className="admin-container fade-in" style={{ padding: '32px', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Logo variant="mark" size={48} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-danger" style={{ fontSize: '10px', letterSpacing: '1px' }}>SOC ROLE</span>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-light)', margin: 0 }}>
                SOC Analyst Command Center
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Real-time threat triage, VirusTotal & urlscan.io intelligence, and incident queue
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchSOCData} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Queue
          </button>
          <Link href="/admin" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Master Admin
          </Link>
        </div>
      </header>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <div className="stat-card border-danger">
          <div className="stat-icon icon-danger"><AlertTriangle size={24} /></div>
          <div className="stat-value">{incidents.filter(i => i.severity === 'high' || i.severity === 'critical').length}</div>
          <div className="stat-label">Critical / High Triage</div>
        </div>

        <div className="stat-card border-warning">
          <div className="stat-icon icon-warning"><Activity size={24} /></div>
          <div className="stat-value">{incidents.filter(i => i.status === 'open').length}</div>
          <div className="stat-label">Open Incidents</div>
        </div>

        <div className="stat-card border-success">
          <div className="stat-icon icon-success"><CheckCircle2 size={24} /></div>
          <div className="stat-value">{incidents.filter(i => i.status === 'closed').length}</div>
          <div className="stat-label">Resolved / Sanitized</div>
        </div>

        <div className="stat-card border-info">
          <div className="stat-icon icon-info"><Shield size={24} /></div>
          <div className="stat-value">{incidents.length}</div>
          <div className="stat-label">Total Signals Analyzed</div>
        </div>
      </div>

      {/* Incident Triage Queue Table */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} style={{ color: 'var(--accent-blue)' }} /> Real-time Incident Triage Queue
          </h3>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={16} style={{ color: 'var(--text-muted)' }} />
            <select 
              value={filterSeverity} 
              onChange={e => setFilterSeverity(e.target.value)}
              className="form-control"
              style={{ padding: '6px 12px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-light)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin" size={24} style={{ marginBottom: '12px' }} />
            <p>Loading real-time SOC incident queue...</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={32} style={{ color: 'var(--success)', marginBottom: '12px' }} />
            <p>No active incidents found for this filter.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Source / Reporter</th>
                  <th>Target / URL</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((incident) => (
                  <tr key={incident.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{incident.timestamp}</td>
                    <td style={{ fontWeight: 600 }}>{incident.source}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-blue)' }}>{incident.target}</td>
                    <td>
                      <span className={`badge badge-${incident.severity === 'high' || incident.severity === 'critical' ? 'danger' : incident.severity === 'medium' ? 'warning' : 'success'}`}>
                        {incident.severity.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${incident.status === 'open' ? 'warning' : 'success'}`}>
                        {incident.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-xs btn-outline" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Triage <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
