'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/admin/DashboardLayout';
import GophishCampaignSection from '@/components/admin/GophishCampaignSection';
import EmployeeRosterSection from '@/components/admin/EmployeeRosterSection';
import MockWebmailSection from '@/components/admin/MockWebmailSection';
import LeaderboardSection from '@/components/admin/LeaderboardSection';
import { usePolling } from '@/hooks/usePolling';
import type { GoPhishCampaign, GoPhishResource, MockEmail, LeaderboardResponse } from '@/components/admin/types';
import AIIntelligenceSection from '@/components/admin/AIIntelligenceSection';

export default function PhishingAdminDashboard() {
  const [activeTab, setActiveTab] = useState('gophish');
  const [campaigns, setCampaigns] = useState<GoPhishCampaign[]>([]);
  const [resources, setResources] = useState<GoPhishResource | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [emails, setEmails] = useState<MockEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);

  const { data: leaderboardData } = usePolling<LeaderboardResponse>('/api/admin/leaderboard', 3000);

  // Load GoPhish data & employees on mount
  useEffect(() => {
    fetch('/api/admin/gophish/campaigns')
      .then(r => r.ok && r.json())
      .then(data => setCampaigns(Array.isArray(data) ? data : data?.campaigns || []))
      .catch(() => {});

    fetch('/api/admin/gophish/resources')
      .then(r => r.ok && r.json())
      .then(data => data && setResources(data))
      .catch(() => {});

    fetch('/api/admin/employees')
      .then(r => r.ok && r.json())
      .then(data => setEmployees(Array.isArray(data) ? data : data?.employees || []))
      .catch(() => {});

    fetch('/api/admin/divisions')
      .then(r => r.ok && r.json())
      .then(data => setDivisions(Array.isArray(data) ? data : data?.divisions || []))
      .catch(() => {});

    fetch('/api/admin/emails')
      .then(r => r.ok && r.json())
      .then(data => setEmails(Array.isArray(data) ? data : data?.emails || []))
      .catch(() => {});
  }, []);

  const handleSyncUsers = async () => {
    try {
      const res = await fetch('/api/admin/gophish/sync', { method: 'POST' });
      if (res.ok) alert('Roster karyawan berhasil disinkronkan ke GoPhish!');
      else alert('Gagal menyinkronkan roster.');
    } catch {
      alert('Gagal menghubungi server.');
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (!confirm('Yakin ingin menghapus kampanye ini?')) return;
    try {
      const res = await fetch(`/api/admin/gophish/campaigns/${id}`, { method: 'DELETE' });
      if (res.ok) setCampaigns(c => c.filter(item => item.id !== id));
    } catch {
      alert('Gagal menghapus kampanye.');
    }
  };

  return (
    <DashboardLayout role="phishing_admin" activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'gophish' && (
        <GophishCampaignSection
          readOnly={false}
          campaigns={Array.isArray(campaigns) ? campaigns : []}
          employees={Array.isArray(employees) ? employees : []}
          divisions={Array.isArray(divisions) ? divisions : []}
          resources={resources}
          selectedEmails={Array.isArray(selectedEmails) ? selectedEmails : []}
          onSelectedEmailsChange={setSelectedEmails}
          onSyncUsers={handleSyncUsers}
          onOpenLaunchModal={() => alert('Fitur buat kampanye GoPhish dapat diakses di panel Master Admin (/admin).')}
          onDeleteCampaign={handleDeleteCampaign}
          onViewCampaignDetail={() => {}}
          onOpenTemplateBuilder={() => {}}
          onDeleteTemplate={() => {}}
          onDeletePage={() => {}}
        />
      )}

      {activeTab === 'employees' && (
        <EmployeeRosterSection
          readOnly={false}
          employees={Array.isArray(employees) ? employees : []}
          divisions={Array.isArray(divisions) ? divisions : []}
          onOpenAddEmployee={() => {}}
          onOpenEditEmployee={() => {}}
          onOpenAddDivision={() => {}}
        />
      )}

      {activeTab === 'webmail' && (
        <MockWebmailSection
          readOnly={false}
          emails={Array.isArray(emails) ? emails : []}
          selectedEmail={selectedEmail}
          onSelectEmail={setSelectedEmail}
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

      {activeTab === 'ai' && (
        <AIIntelligenceSection role="phishing_admin" readOnly={false} />
      )}
    </DashboardLayout>
  );
}
