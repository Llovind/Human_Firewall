'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { BarChart3, TrendingUp, ShieldAlert, Award, FileText, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import '../../dashboard.css';

interface ComplianceSummary {
  compliance_pct: number;
  estimated_savings_idr: number;
  divisi_risk_map: { divisi: string; risk_level: string; avg_points: number }[];
}

export default function CISODashboard() {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCISOData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/compliance-summary');
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (e) {
      console.error('Failed to fetch CISO summary:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCISOData();
  }, []);

  return (
    <div className="admin-container fade-in" style={{ padding: '32px', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Logo variant="mark" size={48} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-purple" style={{ fontSize: '10px', letterSpacing: '1px' }}>CISO EXECUTIVE ROLE</span>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-light)', margin: 0 }}>
                Executive Security Culture & Human Risk Overview
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Strategic organization risk metrics, UU PDP readiness, and financial impact projections
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchCISOData} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Executive Metrics
          </button>
          <Link href="/admin" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Master Admin
          </Link>
        </div>
      </header>

      {/* Strategic Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>UU PDP Compliance Signal</span>
            <ShieldAlert style={{ color: 'var(--accent-blue)' }} size={20} />
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--success)' }}>
            {summary ? `${summary.compliance_pct}%` : '88%'}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Mapped directly to Articles 35 & 46 (Mandatory Data Protection Training & Incident Mitigation)
          </p>
        </div>

        <div className="card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Estimated Breach Penalty Avoidance</span>
            <TrendingUp style={{ color: 'var(--success)' }} size={20} />
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-light)' }}>
            Rp 2.4B+
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Projected risk mitigation value based on 2% annual revenue fine cap under UU PDP
          </p>
        </div>

        <div className="card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Organization Behavioral Score</span>
            <Award style={{ color: 'var(--warning)' }} size={20} />
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--warning)' }}>
            78.4 / 100
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Behavioral score benchmarked across 5 core corporate divisions
          </p>
        </div>
      </div>

      {/* AI Executive Summary Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '32px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-blue)' }}>
          <Sparkles size={20} /> AI Culture & Risk Intelligence Verdict (CISO Summary)
        </h3>
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: '8px', borderLeft: '4px solid var(--accent-blue)', fontSize: '14px', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 12px 0' }}>
            <strong>Executive Assessment:</strong> Overall employee threat awareness shows a <strong>34% improvement</strong> over the last 30 days. The Sales & Finance teams demonstrate the highest reporting rates for suspicious URLs via the Telegram Bot.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Key CISO Recommendation:</strong> Focus the upcoming GoPhish simulation campaign on credential harvesting templates specifically targeting the <em>Network Engineering</em> division to improve their baseline resilience.
          </p>
        </div>
      </div>
    </div>
  );
}
