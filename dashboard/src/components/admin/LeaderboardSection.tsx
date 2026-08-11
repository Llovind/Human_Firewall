'use client';

import React, { useState } from 'react';
import { Sliders, Trophy, Users } from 'lucide-react';
import { LeaderboardResponse } from '@/components/admin/types';

interface LeaderboardSectionProps {
  readOnly: boolean;
  leaderboardData: LeaderboardResponse | null;
  divisiFilter: string;
  badgeFilter: string;
  onDivisiFilterChange: (val: string) => void;
  onBadgeFilterChange: (val: string) => void;
}

export default function LeaderboardSection({
  readOnly,
  leaderboardData,
  divisiFilter,
  badgeFilter,
  onDivisiFilterChange,
  onBadgeFilterChange
}: LeaderboardSectionProps) {
  const [divisionPage, setDivisionPage] = useState(1);
  const [leaderboardPage, setLeaderboardPage] = useState(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', marginBottom: '48px' }}>
      {/* Top Horizontal Filter Bar */}
      <div className="glass-card fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px', width: '100%', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          <Sliders size={16} /> Gamification Filters
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="filter-select" 
            value={divisiFilter} 
            onChange={(e) => onDivisiFilterChange(e.target.value)}
            disabled={readOnly}
            style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
          >
            <option value="ALL">ALL DIVISIONS</option>
            <option value="IT">IT</option>
            <option value="Network Engineering">Network Engineering</option>
            <option value="Network Operations">Network Operations</option>
            <option value="Performance & Shared Service">Performance & Shared Service</option>
            <option value="Sales Support">Sales Support</option>
            <option value="Unknown">Unknown</option>
          </select>
          <select 
            className="filter-select" 
            value={badgeFilter} 
            onChange={(e) => onBadgeFilterChange(e.target.value)}
            disabled={readOnly}
            style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
          >
            <option value="ALL">ALL BADGES</option>
            <option value="Sentinel">Sentinel (Secure)</option>
            <option value="Guardian">Guardian (Medium)</option>
            <option value="Vulnerable">Vulnerable (High Risk)</option>
          </select>
        </div>
      </div>

      {/* Content Row: Side-by-side Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', width: '100%', alignItems: 'stretch' }}>
        {/* Division Leaderboard */}
        {(() => {
          const filteredDivisions = (leaderboardData?.by_divisi || [
            { divisi: 'IT', avg_points: 105, member_count: 1 },
            { divisi: 'Network Engineering', avg_points: 80, member_count: 1 },
            { divisi: 'Network Operations', avg_points: 68, member_count: 1 },
            { divisi: 'Performance & Shared Service', avg_points: 50, member_count: 1 },
            { divisi: 'Sales Support', avg_points: 35, member_count: 1 }
          ]).filter(row => divisiFilter === 'ALL' || row.divisi === divisiFilter);

          const itemsPerPage = 5;
          const totalPages = Math.max(1, Math.ceil(filteredDivisions.length / itemsPerPage));
          const activePage = Math.min(divisionPage, totalPages);
          const paginatedDivisions = filteredDivisions.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

          return (
            <div className={`panel glass-card fade-up`} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '520px' }}>
              <div>
                <div className="panel-header">
                  <h2 className="panel-title"><Trophy size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Division Leaderboard</h2>
                  <span className="panel-count">{filteredDivisions.length} divisi</span>
                </div>
                <div className="threat-table-wrap" style={{ height: '420px', overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="threat-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '15%', textAlign: 'left', padding: '14px 10px' }}>Rank</th>
                        <th style={{ width: '45%', textAlign: 'left', padding: '14px 10px' }}>Divisi</th>
                        <th style={{ width: '20%', textAlign: 'left', padding: '14px 10px' }}>Anggota</th>
                        <th style={{ width: '20%', textAlign: 'left', padding: '14px 10px' }}>Poin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDivisions.map((row, idx) => {
                        const actualRank = idx + 1;
                        return (
                          <tr key={idx}>
                            <td className="mono" style={{ width: '15%', fontWeight: 600, textAlign: 'left', padding: '14px 10px' }}>#{actualRank}</td>
                            <td style={{ width: '45%', fontWeight: 600, textAlign: 'left', padding: '14px 10px' }}>{row.divisi}</td>
                            <td style={{ width: '20%', textAlign: 'left', padding: '14px 10px' }}>{row.member_count}</td>
                            <td className="mono" style={{ width: '20%', textAlign: 'left', fontWeight: 600, color: 'var(--accent)', padding: '14px 10px' }}>{row.avg_points} pts</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Individual Leaderboard */}
        {(() => {
          const filteredIndividual = (leaderboardData?.individual || [
            { rank: 1, email: 'sari@netops-dummy.local', divisi: 'Network Operations', points: 230, badge: 'Sentinel', click_count: 0 },
            { rank: 2, email: 'lovind@netengineering-dummy.local', divisi: 'IT', points: 105, badge: 'Guardian', click_count: 0 },
            { rank: 3, email: 'rina@perfshared-dummy.local', divisi: 'Performance & Shared Service', points: 75, badge: 'Guardian', click_count: 1 },
            { rank: 4, email: 'budi@netengineering-dummy.local', divisi: 'Network Engineering', points: 20, badge: 'Vulnerable', click_count: 3 },
            { rank: 5, email: 'daffa@netops-dummy.local', divisi: 'Unknown', points: 65, badge: 'Guardian', click_count: 0 },
            { rank: 6, email: 'kiko@salessupport-dummy.local', divisi: 'Unknown', points: 62, badge: 'Guardian', click_count: 0 },
            { rank: 7, email: 'lovin@perfshared-dummy.local', divisi: 'Unknown', points: 61, badge: 'Guardian', click_count: 0 }
          ]).filter(row => {
            const matchesDivisi = divisiFilter === 'ALL' || row.divisi === divisiFilter;
            const matchesBadge = badgeFilter === 'ALL' || row.badge === badgeFilter;
            return matchesDivisi && matchesBadge;
          });

          const itemsPerPage = 6;
          const totalPages = Math.max(1, Math.ceil(filteredIndividual.length / itemsPerPage));
          const activePage = Math.min(leaderboardPage, totalPages);
          const paginatedIndividual = filteredIndividual.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

          return (
            <div className={`panel glass-card fade-up-1`} style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '520px' }}>
              <div>
                <div className="panel-header">
                  <h2 className="panel-title"><Users size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Individual Security Leaderboard</h2>
                  <span className="panel-count">{filteredIndividual.length} total</span>
                </div>
                <div className="threat-table-wrap" style={{ height: '420px', overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="threat-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '10%', padding: '14px 10px' }}>Rank</th>
                        <th style={{ width: '38%', padding: '14px 10px' }}>Email</th>
                        <th style={{ width: '22%', padding: '14px 10px' }}>Divisi</th>
                        <th style={{ width: '15%', padding: '14px 10px' }}>Badge</th>
                        <th style={{ width: '10%', padding: '14px 10px' }}>Poin</th>
                        <th style={{ width: '5%', textAlign: 'right', padding: '14px 10px' }}>Klik</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIndividual.map((row, idx) => (
                        <tr key={idx}>
                          <td className="mono" style={{ fontWeight: 600, padding: '14px 10px' }}>#{row.rank}</td>
                          <td className="mono" style={{ fontSize: '12px', padding: '14px 10px' }}>{row.email}</td>
                          <td style={{ fontSize: '13px', padding: '14px 10px' }}>{row.divisi}</td>
                          <td style={{ padding: '14px 10px' }}>
                            <span className={`badge badge-${row.badge === 'Sentinel' ? 'low' : row.badge === 'Guardian' ? 'notify_soc' : 'critical'}`}>
                              {row.badge}
                            </span>
                          </td>
                          <td className="mono" style={{ fontWeight: 600, color: 'var(--success)', padding: '14px 10px' }}>{row.points}</td>
                          <td className="mono" style={{ textAlign: 'right', color: row.click_count > 0 ? 'var(--danger)' : 'var(--text-muted)', padding: '14px 10px' }}>{row.click_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
