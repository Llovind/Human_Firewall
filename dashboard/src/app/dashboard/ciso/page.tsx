'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import OverviewSection from '@/components/admin/OverviewSection';
import IncidentTriageSection from '@/components/admin/IncidentTriageSection';
import ThreatCacheSection from '@/components/admin/ThreatCacheSection';
import LeaderboardSection from '@/components/admin/LeaderboardSection';
import PolicySection from '@/components/admin/PolicySection';
import GophishCampaignSection from '@/components/admin/GophishCampaignSection';
import EmployeeRosterSection from '@/components/admin/EmployeeRosterSection';
import { usePolling } from '@/hooks/usePolling';
import type { Incident, Stats, ThreatCacheEntry, AISummary, BehaviorScore, PolicyDecision, ComplianceSummary, GoPhishCampaign, LeaderboardResponse } from '@/components/admin/types';

import AIIntelligenceSection from '@/components/admin/AIIntelligenceSection';

export default function CISODashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [campaigns, setCampaigns] = useState<GoPhishCampaign[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);

  // Polling core data
  const { data: incidentData, hasUpdated: incidentUpdated } = usePolling<{ incidents: Incident[]; stats: Stats }>('/api/incident', 3000);
  const { data: cacheData, hasUpdated: cacheUpdated } = usePolling<{ cache: ThreatCacheEntry[] }>('/api/cache', 3000);
  const { data: summaryData, hasUpdated: summaryUpdated } = usePolling<{ summaries: AISummary[] }>('/api/summary', 3000);
  const { data: behaviorData, hasUpdated: behaviorUpdated } = usePolling<{ scores: BehaviorScore[] }>('/api/behavior', 3000);
  const { data: policyData, hasUpdated: policyUpdated } = usePolling<{ decisions: PolicyDecision[] }>('/api/policy', 3000);
  const { data: complianceData } = usePolling<ComplianceSummary>('/api/admin/compliance-summary', 3000);
  const { data: leaderboardData } = usePolling<LeaderboardResponse>('/api/admin/leaderboard', 3000);

  useEffect(() => {
    fetch('/api/admin/gophish/campaigns')
      .then(r => r.ok && r.json())
      .then(data => data && setCampaigns(Array.isArray(data) ? data : data?.campaigns || []))
      .catch(() => {});
    fetch('/api/admin/employees')
      .then(r => r.ok && r.json())
      .then(data => data && setEmployees(Array.isArray(data) ? data : data?.employees || []))
      .catch(() => {});
    fetch('/api/admin/divisions')
      .then(r => r.ok && r.json())
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
      {/* CISO Executive Notice Banner */}
      <div style={{
        background: 'rgba(251, 191, 36, 0.06)',
        border: '1px solid rgba(251, 191, 36, 0.2)',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        color: '#fbbf24',
      }}>
        <span>👑 <strong>CISO Executive View:</strong> Anda berada dalam mode Read-Only dengan akses visibilitas penuh ke seluruh 17 komponen sistem.</span>
      </div>

      {activeTab === 'overview' && (
        <>
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
          <div style={{ marginTop: '24px' }}>
            <IncidentTriageSection
              readOnly={true}
              incidents={activeIncidents}
              onSelectIncident={() => {}}
              onResolveIncident={() => {}}
            />
          </div>
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
