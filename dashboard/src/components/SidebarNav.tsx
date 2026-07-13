import React from 'react';
import Logo from './Logo';
import { LayoutDashboard, ShieldAlert, Trophy, FileWarning, Fish, Mail, Users } from 'lucide-react';

interface SidebarNavProps {
  activeTab: 'overview' | 'threats' | 'leaderboard' | 'policy' | 'gophish' | 'webmail' | 'employees';
  onTabChange: (tab: 'overview' | 'threats' | 'leaderboard' | 'policy' | 'gophish' | 'webmail' | 'employees') => void;
}

export default function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'threats', label: 'Threats', icon: <ShieldAlert size={20} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> },
    { id: 'policy', label: 'Policy', icon: <FileWarning size={20} /> },
    { id: 'gophish', label: 'GoPhish', icon: <Fish size={20} /> },
    { id: 'employees', label: 'Employees', icon: <Users size={20} /> },
    { id: 'webmail', label: 'Webmail', icon: <Mail size={20} /> },
  ];

  return (
    <aside className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '8px' }}>
      <div className="radar-sweep-bg" />
      <div className="sidebar-nav-logo" style={{ marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
        <Logo variant="mark" size={36} />
      </div>
      <nav className="sidebar-menu" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 'none' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id as any)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
