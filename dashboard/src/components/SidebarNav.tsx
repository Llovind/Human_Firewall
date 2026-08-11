import React from 'react';
import Logo from './Logo';
import { LayoutDashboard, ShieldAlert, Trophy, FileWarning, Fish, Mail } from 'lucide-react';

interface SidebarNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
    { id: 'threats', label: 'Threats', icon: <ShieldAlert size={18} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={18} /> },
    { id: 'policy', label: 'Policy', icon: <FileWarning size={18} /> },
    { id: 'gophish', label: 'GoPhish', icon: <Fish size={18} /> },
    { id: 'webmail', label: 'Webmail', icon: <Mail size={18} /> },
  ];

  return (
    <aside className="sidebar-nav">
      <div className="radar-sweep-bg" />
      <div className="sidebar-nav-logo">
        <Logo variant="mark" size={42} />
      </div>
      <nav className="sidebar-menu">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
