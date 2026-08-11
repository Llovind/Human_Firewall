'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import OverviewSection from '@/components/admin/OverviewSection';
import LeaderboardSection from '@/components/admin/LeaderboardSection';
import EmployeeRosterSection from '@/components/admin/EmployeeRosterSection';
import { usePolling } from '@/hooks/usePolling';
import type { Incident, Stats, ThreatCacheEntry, AISummary, BehaviorScore, ComplianceSummary, LeaderboardResponse } from '@/components/admin/types';
import { FileCheck, Download } from 'lucide-react';

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
    fetch('/api/admin/employees').then(r => r.ok && r.json()).then(data => data && setEmployees(data)).catch(() => {});
    fetch('/api/admin/divisions').then(r => r.ok && r.json()).then(data => data && setDivisions(data)).catch(() => {});
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Compliance & Financial Impact Center</h2>
              <a
                href="/ai"
                className="admin-submit-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'auto', padding: '8px 16px', textDecoration: 'none' }}
              >
                <Download size={16} /> Export Executive PDF
              </a>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              GRC Specialist bertanggung jawab mengelola kepatuhan ISO 27001, UU PDP, dan pemantauan postur risiko antar divisi.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>AI Risk Heatmap & Executive PDF</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Generasi laporan naratif eksekutif & PDF resmi di halaman AI.</p>
          <a href="/ai" className="admin-submit-btn" style={{ display: 'inline-block', width: 'auto', padding: '8px 24px', textDecoration: 'none' }}>
            Buka Halaman AI Report →
          </a>
        </div>
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
