'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import OverviewSection from '@/components/admin/OverviewSection';
import IncidentTriageSection from '@/components/admin/IncidentTriageSection';
import ThreatCacheSection from '@/components/admin/ThreatCacheSection';
import LoginHistorySection from '@/components/admin/LoginHistorySection';
import { usePolling } from '@/hooks/usePolling';
import type { Incident, Stats, ThreatCacheEntry, AISummary, BehaviorScore, ComplianceSummary, AdminLoginEvent } from '@/components/admin/types';
import AIIntelligenceSection from '@/components/admin/AIIntelligenceSection';
import ProxyOperationsSection from '@/components/admin/ProxyOperationsSection';
import SecurityInboxSection from '@/components/admin/SecurityInboxSection';

export default function SOCDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [threatTypeFilter, setThreatTypeFilter] = useState('ALL');
  const [threatActionFilter, setThreatActionFilter] = useState('ALL');
  const [loginHistory, setLoginHistory] = useState<AdminLoginEvent[]>([]);

  // Polling core data
  const { data: incidentData, hasUpdated: incidentUpdated } = usePolling<{ incidents: Incident[]; stats: Stats }>('/api/incident', 3000);
  const { data: cacheData, hasUpdated: cacheUpdated } = usePolling<{ cache: ThreatCacheEntry[] }>('/api/cache', 3000);
  const { data: summaryData, hasUpdated: summaryUpdated, refresh: refreshSummary, error: summaryError } = usePolling<{ summaries: AISummary[] }>('/api/summary', 10000);
  const { data: behaviorData, hasUpdated: behaviorUpdated, error: behaviorError } = usePolling<{ scores: BehaviorScore[] }>('/api/behavior', 10000);
  const { data: complianceData } = usePolling<ComplianceSummary>('/api/admin/compliance-summary', 3000);

  useEffect(() => {
    fetch('/api/admin/login-history')
      .then(async r => (r.ok ? r.json() : null))
      .then(data => data && setLoginHistory(Array.isArray(data) ? data : data.logs || []))
      .catch(() => {});
  }, []);

  const handleResolveIncident = async (id: string) => {
    try {
      const res = await fetch('/api/incident', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: id, status: 'closed' }),
      });
      if (!res.ok) alert('Could not update incident status.');
    } catch {
      alert('Could not reach the server.');
    }
  };

  const incidents = incidentData?.incidents || [];
  const activeIncidents = incidents.filter(inc => inc.status !== 'closed');
  const cache = cacheData?.cache || [];
  const summaries = summaryData?.summaries || [];
  const scores = behaviorData?.scores || [];

  return (
    <DashboardLayout role="soc" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && (
        <>
          {(summaryError || behaviorError) && <p className="debt-error" role="alert">Telemetry belum dapat diperbarui. Snapshot terakhir ditampilkan, tanpa data contoh.</p>}
          <OverviewSection
            onRefreshSummary={refreshSummary}
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
          <ProxyOperationsSection />
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

      {activeTab === 'ai' && (
        <AIIntelligenceSection role="soc" readOnly={false} />
      )}
      {activeTab === 'inbox' && <SecurityInboxSection />}
    </DashboardLayout>
  );
}
