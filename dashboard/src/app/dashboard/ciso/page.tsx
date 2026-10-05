'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import OverviewSection from '@/components/admin/OverviewSection';
import IncidentQueue from '@/components/admin/IncidentQueue';
import ExecutiveSummary from '@/components/admin/ExecutiveSummary';
import { useI18n } from '@/i18n/I18nProvider';
import ThreatCacheSection from '@/components/admin/ThreatCacheSection';
import LeaderboardSection from '@/components/admin/LeaderboardSection';
import PolicySection from '@/components/admin/PolicySection';
import GophishCampaignSection from '@/components/admin/GophishCampaignSection';
import EmployeeRosterSection from '@/components/admin/EmployeeRosterSection';
import { usePolling } from '@/hooks/usePolling';
import type { Incident, Stats, ThreatCacheEntry, AISummary, BehaviorScore, PolicyDecision, ComplianceSummary, GoPhishCampaign, LeaderboardResponse, EmployeeAccount, Division } from '@/components/admin/types';

import AIIntelligenceSection from '@/components/admin/AIIntelligenceSection';

export default function CISODashboard() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('overview');
  const [campaigns, setCampaigns] = useState<GoPhishCampaign[]>([]);
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  // Polling core data
  const { data: incidentData, hasUpdated: incidentUpdated, isLoading: incidentsLoading, error: incidentsError, refresh: refreshIncidents } = usePolling<{ incidents: Incident[]; stats: Stats }>('/api/incident', 3000);
  const { data: cacheData, hasUpdated: cacheUpdated } = usePolling<{ cache: ThreatCacheEntry[] }>('/api/cache', 3000);
  const { data: summaryData, hasUpdated: summaryUpdated } = usePolling<{ summaries: AISummary[] }>('/api/summary', 3000);
  const { data: behaviorData, hasUpdated: behaviorUpdated } = usePolling<{ scores: BehaviorScore[] }>('/api/behavior', 3000);
  const { data: policyData } = usePolling<{ decisions: PolicyDecision[] }>('/api/policy', 3000);
  const { data: complianceData } = usePolling<ComplianceSummary>('/api/admin/compliance-summary', 3000);
  const { data: leaderboardData } = usePolling<LeaderboardResponse>('/api/admin/leaderboard', 3000);

  useEffect(() => {
    fetch('/api/admin/gophish/campaigns')
      .then(async r => (r.ok ? r.json() : null))
      .then(data => data && setCampaigns(Array.isArray(data) ? data : data?.campaigns || []))
      .catch(() => {});
    fetch('/api/admin/employees')
      .then(async r => (r.ok ? r.json() : null))
      .then(data => data && setEmployees(Array.isArray(data) ? data : data?.employees || []))
      .catch(() => {});
    fetch('/api/admin/divisions')
      .then(async r => (r.ok ? r.json() : null))
      .then(data => data && setDivisions(Array.isArray(data) ? data : data?.divisions || []))
      .catch(() => {});
  }, []);

  const incidents = incidentData?.incidents || [];
  const activeIncidents = incidents.filter(inc => inc.status !== 'closed');
  const cache = cacheData?.cache || [];
  const summaries = summaryData?.summaries || [];
  const scores = behaviorData?.scores || [];
  const decisions = policyData?.decisions || [];

  return (
    <DashboardLayout role="ciso" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && (
        <>
          <ExecutiveSummary incidents={incidents} scores={scores} compliance={complianceData} campaigns={campaigns} />
          <IncidentQueue incidents={incidents} canResolve={false} onChanged={refreshIncidents} loading={incidentsLoading} error={Boolean(incidentsError) && !incidentData} />
          <details className="exec-more">
            <summary>{t('exec.more')}<small>{t('exec.more.hint')}</small></summary>
            <div>
              <OverviewSection
                readOnly={true}
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
            </div>
          </details>
        </>
      )}

      {activeTab === 'threats' && (
        <ThreatCacheSection
          readOnly={true}
          cacheData={cache}
          threatTypeFilter="ALL"
          threatActionFilter="ALL"
          onThreatTypeFilterChange={() => {}}
          onThreatActionFilterChange={() => {}}
        />
      )}

      {activeTab === 'leaderboard' && (
        <LeaderboardSection
          readOnly={true}
          leaderboardData={leaderboardData}
          divisiFilter="ALL"
          badgeFilter="ALL"
          onDivisiFilterChange={() => {}}
          onBadgeFilterChange={() => {}}
        />
      )}

      {activeTab === 'policy' && (
        <PolicySection readOnly={true} decisions={decisions} />
      )}

      {activeTab === 'gophish' && (
        <GophishCampaignSection
          readOnly={true}
          campaigns={campaigns}
          employees={employees}
          divisions={divisions}
          resources={null}
          selectedEmails={[]}
          onSelectedEmailsChange={() => {}}
          onSyncUsers={() => {}}
          onOpenLaunchModal={() => {}}
          onDeleteCampaign={() => {}}
          onViewCampaignDetail={() => {}}
          onOpenTemplateBuilder={() => {}}
          onDeleteTemplate={() => {}}
          onDeletePage={() => {}}
        />
      )}

      {activeTab === 'employees' && (
        <EmployeeRosterSection
          readOnly={true}
          employees={employees}
          divisions={divisions}
          onOpenAddEmployee={() => {}}
          onOpenEditEmployee={() => {}}
          onOpenAddDivision={() => {}}
        />
      )}

      {activeTab === 'ai' && (
        <AIIntelligenceSection role="ciso" readOnly={true} />
      )}
    </DashboardLayout>
  );
}
