import React from 'react';
import Logo from './Logo';
import { LayoutDashboard, ShieldAlert, Trophy, FileWarning, Fish, Mail } from 'lucide-react';

interface SidebarNavProps {
  activeTab: 'overview' | 'threats' | 'leaderboard' | 'policy' | 'gophish' | 'webmail';
  onTabChange: (tab: 'overview' | 'threats' | 'leaderboard' | 'policy' | 'gophish' | 'webmail') => void;
}

export default function SidebarNav({ activeTab, onTabChange }: SidebarNavProps) {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'threats', label: 'Threats', icon: <ShieldAlert size={20} /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={20} /> },
    { id: 'policy', label: 'Policy', icon: <FileWarning size={20} /> },
    { id: 'gophish', label: 'GoPhish', icon: <Fish size={20} /> },
    { id: 'webmail', label: 'Webmail', icon: <Mail size={20} /> },
  ];

  return (
    <aside className="sidebar-nav">
      <div className="radar-sweep-bg" />
      <div className="sidebar-nav-logo">
        <Logo variant="mark" size={46} />
      </div>
      <nav className="sidebar-menu">
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
