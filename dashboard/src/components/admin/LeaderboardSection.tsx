'use client';

import React, { useState } from 'react';
import { Sliders, Trophy, Users, Search } from 'lucide-react';
import { LeaderboardResponse } from '@/components/admin/types';

interface LeaderboardSectionProps {
  readOnly: boolean;
  leaderboardData: LeaderboardResponse | null;
  divisiFilter?: string;
  badgeFilter?: string;
  onDivisiFilterChange?: (val: string) => void;
  onBadgeFilterChange?: (val: string) => void;
}

export default function LeaderboardSection({
  readOnly,
  leaderboardData,
  divisiFilter = 'ALL',
  badgeFilter = 'ALL',
  onDivisiFilterChange,
  onBadgeFilterChange
}: LeaderboardSectionProps) {
  const [localDivisi, setLocalDivisi] = useState(divisiFilter || 'ALL');
  const [localBadge, setLocalBadge] = useState(badgeFilter || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const handleDivisiChange = (val: string) => {
    setLocalDivisi(val);
    if (onDivisiFilterChange) onDivisiFilterChange(val);
  };

  const handleBadgeChange = (val: string) => {
    setLocalBadge(val);
    if (onBadgeFilterChange) onBadgeFilterChange(val);
  };

  const activeDivisi = localDivisi;
  const activeBadge = localBadge;

  // Extract unique divisions dynamically from live data
  const divisionList = Array.from(
    new Set((leaderboardData?.by_divisi || []).map(d => d.divisi).filter(Boolean))
  );

  return (
    <div className="font-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', marginBottom: '48px' }}>
      {/* Top Horizontal Filter Bar */}
      <div className="glass-card fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px', width: '100%', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          <Sliders size={16} /> Gamification Filters
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          {/* Search box */}
          <div style={{ position: 'relative', minWidth: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="font-body"
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '12px'
              }}
            />
          </div>

          {/* Division Filter */}
          <select 
            className="filter-select font-body" 
            value={activeDivisi} 
            onChange={(e) => handleDivisiChange(e.target.value)}
            disabled={readOnly}
            style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
          >
            <option value="ALL">ALL DIVISIONS</option>
            {divisionList.map(div => (
              <option key={div} value={div}>{div.toUpperCase()}</option>
            ))}
          </select>

          {/* Badge Filter */}
          <select 
            className="filter-select font-body" 
            value={activeBadge} 
            onChange={(e) => handleBadgeChange(e.target.value)}
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
          const filteredDivisions = (leaderboardData?.by_divisi || [])
            .filter(row => activeDivisi === 'ALL' || row.divisi === activeDivisi);

          return (
            <div className="panel glass-card fade-up font-body" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '520px' }}>
              <div>
                <div className="panel-header">
                  <h2 className="panel-title font-heading"><Trophy size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Division Leaderboard</h2>
                  <span className="panel-count font-mono-data">{filteredDivisions.length} divisions</span>
                </div>
                <div className="threat-table-wrap" style={{ height: '420px', overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="threat-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '15%', textAlign: 'left', padding: '14px 10px' }}>Rank</th>
                        <th style={{ width: '45%', textAlign: 'left', padding: '14px 10px' }}>Division</th>
                        <th style={{ width: '20%', textAlign: 'left', padding: '14px 10px' }}>Members</th>
                        <th style={{ width: '20%', textAlign: 'left', padding: '14px 10px' }}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDivisions.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No division records found.
                          </td>
                        </tr>
                      ) : (
                        filteredDivisions.map((row, idx) => {
                          const actualRank = idx + 1;
                          return (
                            <tr key={idx}>
                              <td className="font-mono-data" style={{ width: '15%', fontWeight: 600, textAlign: 'left', padding: '14px 10px' }}>#{actualRank}</td>
                              <td style={{ width: '45%', fontWeight: 600, textAlign: 'left', padding: '14px 10px' }}>{row.divisi}</td>
                              <td className="font-mono-data" style={{ width: '20%', textAlign: 'left', padding: '14px 10px' }}>{row.member_count}</td>
                              <td className="font-mono-data" style={{ width: '20%', textAlign: 'left', fontWeight: 600, color: 'var(--accent)', padding: '14px 10px' }}>{row.avg_points} pts</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Individual Leaderboard */}
        {(() => {
          const individualList = leaderboardData?.individual || [];
          const filteredIndividual = individualList.filter(row => {
            const matchesDivisi = activeDivisi === 'ALL' || row.divisi === activeDivisi;
            const matchesBadge = activeBadge === 'ALL' || (row.badge || '').toLowerCase() === activeBadge.toLowerCase();
            const matchesSearch = !searchQuery || row.email.toLowerCase().includes(searchQuery.toLowerCase()) || (row.divisi || '').toLowerCase().includes(searchQuery.toLowerCase());
            return matchesDivisi && matchesBadge && matchesSearch;
          });

          return (
            <div className="panel glass-card fade-up-1 font-body" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '520px' }}>
              <div>
                <div className="panel-header">
                  <h2 className="panel-title font-heading"><Users size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> Individual Security Leaderboard</h2>
                  <span className="panel-count font-mono-data">{filteredIndividual.length} total</span>
                </div>
                <div className="threat-table-wrap" style={{ height: '420px', overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="threat-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '10%', padding: '14px 10px' }}>Rank</th>
                        <th style={{ width: '38%', padding: '14px 10px' }}>Email</th>
                        <th style={{ width: '22%', padding: '14px 10px' }}>Division</th>
                        <th style={{ width: '15%', padding: '14px 10px' }}>Badge</th>
                        <th style={{ width: '10%', padding: '14px 10px' }}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIndividual.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No employee records found matching the filter.
                          </td>
                        </tr>
                      ) : (
                        filteredIndividual.map((row, idx) => {
                          const actualRank = idx + 1;
                          const badgeLower = (row.badge || '').toLowerCase();
                          const isVulnerable = badgeLower === 'vulnerable';
                          const isSentinel = badgeLower === 'sentinel' || badgeLower === 'cyber shield elite' || badgeLower === 'the front man';
                          const badgeClass = isSentinel ? 'badge-success' : isVulnerable ? 'badge-danger' : 'badge-warning';

                          return (
                            <tr key={idx}>
                              <td className="font-mono-data" style={{ fontWeight: 600, padding: '14px 10px' }}>#{actualRank}</td>
                              <td className="font-mono-data" style={{ fontWeight: 600, padding: '14px 10px' }}>{row.email}</td>
                              <td style={{ padding: '14px 10px' }}>{row.divisi}</td>
                              <td style={{ padding: '14px 10px' }}>
                                <span
                                  className={`badge ${badgeClass} font-body`}
                                  style={isVulnerable ? {
                                    background: 'var(--bg-danger)',
                                    color: 'var(--text-danger)',
                                    border: '1px solid var(--border-danger)'
                                  } : undefined}
                                >
                                  {row.badge}
                                </span>
                              </td>
                              <td className="font-mono-data" style={{ fontWeight: 600, color: isVulnerable ? 'var(--danger)' : 'var(--accent)', padding: '14px 10px' }}>{row.points} pts</td>
                            </tr>
                          );
                        })
                      )}
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
