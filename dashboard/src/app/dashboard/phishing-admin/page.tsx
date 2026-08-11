'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Fish, Play, Plus, RefreshCw, Mail, Users, ArrowLeft, CheckCircle2 } from 'lucide-react';
import '../../dashboard.css';

interface Campaign {
  id: number;
  name: string;
  status: string;
  created_date: string;
  stats: {
    sent: number;
    opened: number;
    clicked: number;
    submitted_data: number;
  };
}

export default function PhishingAdminDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gophish/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (e) {
      console.error('Failed to fetch GoPhish campaigns:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  return (
    <div className="admin-container fade-in" style={{ padding: '32px', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Logo variant="mark" size={48} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-warning" style={{ fontSize: '10px', letterSpacing: '1px' }}>PHISHING ADMIN ROLE</span>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-light)', margin: 0 }}>
                GoPhish Campaign & Simulation Admin
              </h1>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Manage phishing simulation campaigns, target employee rosters, and landing page templates
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchCampaigns} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Campaigns
          </button>
          <Link href="/admin" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Master Admin
          </Link>
        </div>
      </header>

      {/* Campaign List */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Fish size={20} style={{ color: 'var(--warning)' }} /> Active Simulation Campaigns
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin" size={24} style={{ marginBottom: '12px' }} />
            <p>Loading GoPhish campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Fish size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p>No active GoPhish campaigns. Create one in the Master Admin panel.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Created Date</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                  <th>Submitted Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.created_date}</td>
                    <td>{c.stats?.sent || 0}</td>
                    <td>{c.stats?.opened || 0}</td>
                    <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{c.stats?.clicked || 0}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{c.stats?.submitted_data || 0}</td>
                    <td>
                      <span className={`badge badge-${c.status === 'In progress' ? 'warning' : 'success'}`}>
                        {c.status}
                      </span>
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
