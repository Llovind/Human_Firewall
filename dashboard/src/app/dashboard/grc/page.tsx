'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Scale, CheckCircle2, ShieldCheck, FileCheck, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import '../../dashboard.css';

export default function GRCDashboard() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="admin-container fade-in" style={{ padding: '32px', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Logo variant="mark" size={48} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-success" style={{ fontSize: '10px', letterSpacing: '1px' }}>GRC & COMPLIANCE ROLE</span>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-light)', margin: 0 }}>
                Governance, Risk & Compliance (UU PDP Portal)
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Indonesian Personal Data Protection Law (UU PDP No. 27/2022) & ISO 27001 Annex A Compliance Audit
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/admin" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Master Admin
          </Link>
        </div>
      </header>

      {/* Compliance Signal Banner */}
      <div className="card" style={{ padding: '24px', marginBottom: '32px', borderLeft: '6px solid var(--success)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(15, 23, 42, 0.9))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ShieldCheck size={36} style={{ color: 'var(--success)' }} />
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-light)' }}>
              UU PDP Compliance Readiness: READY (PASAL 35 & 46)
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Automated audit trail confirms continuous human-risk telemetry, threat reporting, and closed-loop training.
            </p>
          </div>
        </div>
      </div>

      {/* Regulatory Mapping Table */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={20} style={{ color: 'var(--accent-blue)' }} /> Regulatory Compliance Evidence Mapping
        </h3>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Regulation / Standard</th>
                <th>Article / Clause</th>
                <th>Requirement Summary</th>
                <th>Afferent Proof & Signal</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>UU PDP No. 27/2022</td>
                <td style={{ fontFamily: 'monospace' }}>Pasal 35</td>
                <td>Penyelenggara Data Pribadi wajib menjaga keamanan Data Pribadi.</td>
                <td>Simulasi phishing & continuous human risk telemetry per divisi</td>
                <td><span className="badge badge-success">COMPLIANT</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>UU PDP No. 27/2022</td>
                <td style={{ fontFamily: 'monospace' }}>Pasal 46</td>
                <td>Pemberitahuan tertulis jika terjadi kegagalan Pelindungan Data.</td>
                <td>Closed-loop Incident Triage & Telegram Instant SOC Alerting</td>
                <td><span className="badge badge-success">COMPLIANT</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>ISO/IEC 27001:2022</td>
                <td style={{ fontFamily: 'monospace' }}>Annex A 6.3</td>
                <td>Information security awareness, education, and training.</td>
                <td>Gamified Daily Quiz, Badges, and Teachable Moment Pages</td>
                <td><span className="badge badge-success">COMPLIANT</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>ISO/IEC 27001:2022</td>
                <td style={{ fontFamily: 'monospace' }}>Annex A 6.8</td>
                <td>Information security event reporting.</td>
                <td>Telegram Bot Instant Threat Reporting with VT Scanning</td>
                <td><span className="badge badge-success">COMPLIANT</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
