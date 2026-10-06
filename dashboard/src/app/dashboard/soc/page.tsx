'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import { useI18n } from '@/i18n/I18nProvider';
import OverviewSection from '@/components/admin/OverviewSection';
import IncidentQueue from '@/components/admin/IncidentQueue';
import ThreatCacheSection from '@/components/admin/ThreatCacheSection';
import LoginHistorySection from '@/components/admin/LoginHistorySection';
import { usePolling } from '@/hooks/usePolling';
import type { Incident, Stats, ThreatCacheEntry, AISummary, BehaviorScore, ComplianceSummary, AdminLoginEvent } from '@/components/admin/types';
import AuditLogSection from '@/components/admin/AuditLogSection';
import AIIntelligenceSection from '@/components/admin/AIIntelligenceSection';
import ProxyOperationsSection from '@/components/admin/ProxyOperationsSection';
import SecurityInboxSection from '@/components/admin/SecurityInboxSection';

export default function SOCDashboard() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('overview');
  const [threatTypeFilter, setThreatTypeFilter] = useState('ALL');
  const [threatActionFilter, setThreatActionFilter] = useState('ALL');
  const [loginHistory, setLoginHistory] = useState<AdminLoginEvent[]>([]);

  // Polling core data
  const { data: incidentData, hasUpdated: incidentUpdated, isLoading: incidentsLoading, error: incidentsError, refresh: refreshIncidents } = usePolling<{ incidents: Incident[]; stats: Stats }>('/api/incident', 3000);
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

  const incidents = incidentData?.incidents || [];
  const activeIncidents = incidents.filter(inc => inc.status !== 'closed');
  const cache = cacheData?.cache || [];
  const summaries = summaryData?.summaries || [];
  const scores = behaviorData?.scores || [];

  return (
    <DashboardLayout role="soc" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && (
        <>
          <IncidentQueue incidents={incidents} canResolve onChanged={refreshIncidents} loading={incidentsLoading} error={Boolean(incidentsError) && !incidentData} />
          {(summaryError || behaviorError) && <p className="debt-error" role="alert">{t('soc.err.telemetry')}</p>}
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

      {activeTab === 'audit' && <AuditLogSection />}
      {activeTab === 'ai' && (
        <AIIntelligenceSection role="soc" readOnly={false} />
      )}
      {activeTab === 'inbox' && <SecurityInboxSection canDecideAccess={true} />}
    </DashboardLayout>
  );
}
