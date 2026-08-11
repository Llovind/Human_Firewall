'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import OverviewSection from '@/components/admin/OverviewSection';
import IncidentTriageSection from '@/components/admin/IncidentTriageSection';
import ThreatCacheSection from '@/components/admin/ThreatCacheSection';
import LoginHistorySection from '@/components/admin/LoginHistorySection';
import PolicySection from '@/components/admin/PolicySection';
import { usePolling } from '@/hooks/usePolling';
import type { Incident, Stats, ThreatCacheEntry, AISummary, BehaviorScore, PolicyDecision, ComplianceSummary, AdminLoginEvent } from '@/components/admin/types';

export default function SOCDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [threatTypeFilter, setThreatTypeFilter] = useState('ALL');
  const [threatActionFilter, setThreatActionFilter] = useState('ALL');
  const [loginHistory, setLoginHistory] = useState<AdminLoginEvent[]>([]);

  // Polling core data
  const { data: incidentData, hasUpdated: incidentUpdated } = usePolling<{ incidents: Incident[]; stats: Stats }>('/api/incident', 3000);
  const { data: cacheData, hasUpdated: cacheUpdated } = usePolling<{ cache: ThreatCacheEntry[] }>('/api/cache', 3000);
  const { data: summaryData, hasUpdated: summaryUpdated } = usePolling<{ summaries: AISummary[] }>('/api/summary', 3000);
  const { data: behaviorData, hasUpdated: behaviorUpdated } = usePolling<{ scores: BehaviorScore[] }>('/api/behavior', 3000);
  const { data: policyData, hasUpdated: policyUpdated } = usePolling<{ decisions: PolicyDecision[] }>('/api/policy', 3000);
  const { data: complianceData } = usePolling<ComplianceSummary>('/api/admin/compliance-summary', 3000);

  useEffect(() => {
    fetch('/api/admin/login-history').then(r => r.ok && r.json()).then(data => data && setLoginHistory(data)).catch(() => {});
  }, []);

  const handleResolveIncident = async (id: string) => {
    try {
      const res = await fetch('/api/incident', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: id, status: 'closed' }),
      });
      if (!res.ok) alert('Gagal memperbarui status insiden.');
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  const incidents = incidentData?.incidents || [];
  const activeIncidents = incidents.filter(inc => inc.status !== 'closed');
  const cache = cacheData?.cache || [];
  const summaries = summaryData?.summaries || [];
  const scores = behaviorData?.scores || [];
  const decisions = policyData?.decisions || [];

  return (
    <DashboardLayout role="soc" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && (
        <>
          <OverviewSection
            readOnly={false}
            stats={incidentData?.stats}
            incidents={activeIncidents}
            summaries={summaries}
            scores={scores}
            cache={cache}
            complianceData={complianceData}
            incidentUpdated={incidentUpdated}
            cacheUpdated={cacheUpdated}
            summaryUpdated={summaryUpdated}
            behaviorUpdated={behaviorUpdated}
          />
          <div style={{ marginTop: '24px' }}>
            <IncidentTriageSection
              readOnly={false}
              incidents={activeIncidents}
              onSelectIncident={() => {}}
              onResolveIncident={handleResolveIncident}
            />
          </div>
        </>
      )}

      {activeTab === 'threats' && (
        <>
          <ThreatCacheSection
            readOnly={false}
            cacheData={cache}
            threatTypeFilter={threatTypeFilter}
            threatActionFilter={threatActionFilter}
            onThreatTypeFilterChange={setThreatTypeFilter}
            onThreatActionFilterChange={setThreatActionFilter}
          />
          <div style={{ marginTop: '24px' }}>
            <LoginHistorySection readOnly={false} loginHistory={loginHistory} />
          </div>
        </>
      )}

      {activeTab === 'policy' && (
        <PolicySection readOnly={false} decisions={decisions} />
      )}

      {activeTab === 'ai' && (
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>AI Behavioral Risk Heatmap</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Buka halaman AI penuh untuk analisis pengguna individual & agentic investigator.</p>
          <a
            href="/ai"
            className="admin-submit-btn"
            style={{ display: 'inline-block', width: 'auto', padding: '8px 24px', textDecoration: 'none' }}
          >
            Buka Halaman AI Heatmap →
          </a>
        </div>
      )}
    </DashboardLayout>
  );
}
