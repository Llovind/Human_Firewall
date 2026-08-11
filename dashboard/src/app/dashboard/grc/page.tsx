'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import OverviewSection from '@/components/admin/OverviewSection';
import LeaderboardSection from '@/components/admin/LeaderboardSection';
import EmployeeRosterSection from '@/components/admin/EmployeeRosterSection';
import { usePolling } from '@/hooks/usePolling';
import type { Incident, Stats, ThreatCacheEntry, AISummary, BehaviorScore, ComplianceSummary, LeaderboardResponse } from '@/components/admin/types';
import { ComplianceReadinessSection } from '@/components/admin/ComplianceReadinessSection';
import AIIntelligenceSection from '@/components/admin/AIIntelligenceSection';

export default function GCDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [divisiFilter, setDivisiFilter] = useState('ALL');
  const [badgeFilter, setBadgeFilter] = useState('ALL');
  const [employees, setEmployees] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);

  const { data: incidentData, hasUpdated: incidentUpdated } = usePolling<{ incidents: Incident[]; stats: Stats }>('/api/incident', 3000);
  const { data: cacheData, hasUpdated: cacheUpdated } = usePolling<{ cache: ThreatCacheEntry[] }>('/api/cache', 3000);
  const { data: summaryData, hasUpdated: summaryUpdated } = usePolling<{ summaries: AISummary[] }>('/api/summary', 3000);
  const { data: behaviorData, hasUpdated: behaviorUpdated } = usePolling<{ scores: BehaviorScore[] }>('/api/behavior', 3000);
  const { data: complianceData } = usePolling<ComplianceSummary>('/api/admin/compliance-summary', 3000);
  const { data: leaderboardData } = usePolling<LeaderboardResponse>('/api/admin/leaderboard', 3000);

  useEffect(() => {
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

  return (
    <DashboardLayout role="grc" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && (
        <OverviewSection
          readOnly={true}
          stats={incidentData?.stats}
          incidents={activeIncidents}
          summaries={summaryData?.summaries || []}
          scores={behaviorData?.scores || []}
          cache={cacheData?.cache || []}
          complianceData={complianceData}
          incidentUpdated={incidentUpdated}
          cacheUpdated={cacheUpdated}
          summaryUpdated={summaryUpdated}
          behaviorUpdated={behaviorUpdated}
        />
      )}

      {activeTab === 'leaderboard' && (
        <LeaderboardSection
          readOnly={false}
          leaderboardData={leaderboardData}
          divisiFilter={divisiFilter}
          badgeFilter={badgeFilter}
          onDivisiFilterChange={setDivisiFilter}
          onBadgeFilterChange={setBadgeFilter}
        />
      )}

      {activeTab === 'compliance' && (
        <ComplianceReadinessSection readOnly={false} />
      )}

      {activeTab === 'ai' && (
        <AIIntelligenceSection role="grc" readOnly={false} />
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
    </DashboardLayout>
  );
}
