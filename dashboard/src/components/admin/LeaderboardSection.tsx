'use client';

import React, { useState } from 'react';
import { Search, Users, Trophy } from 'lucide-react';
import { LeaderboardResponse } from '@/components/admin/types';

interface LeaderboardSectionProps {
  readOnly: boolean;
  leaderboardData: LeaderboardResponse | null;
  divisiFilter?: string;
  badgeFilter?: string;
  onDivisiFilterChange?: (val: string) => void;
  onBadgeFilterChange?: (val: string) => void;
}

type ActiveView = 'individuals' | 'divisions';

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
  const [activeView, setActiveView] = useState<ActiveView>('individuals');

  // ── handlers (unchanged) ──────────────────────────────────────────
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

  // ── data (unchanged logic) ────────────────────────────────────────
  const divisionList = Array.from(
    new Set((leaderboardData?.by_divisi || []).map(d => d.divisi).filter(Boolean))
  );

  const filteredDivisions = (leaderboardData?.by_divisi || [])
    .filter(row => activeDivisi === 'ALL' || row.divisi === activeDivisi);

  const individualList = leaderboardData?.individual || [];
  const filteredIndividual = individualList.filter(row => {
    const matchesDivisi = activeDivisi === 'ALL' || row.divisi === activeDivisi;
    const matchesBadge = activeBadge === 'ALL' || (row.badge || '').toLowerCase() === activeBadge.toLowerCase();
    const matchesSearch = !searchQuery || row.email.toLowerCase().includes(searchQuery.toLowerCase()) || (row.divisi || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDivisi && matchesBadge && matchesSearch;
  });

  const resultCount = activeView === 'individuals'
    ? `${filteredIndividual.length} employee${filteredIndividual.length !== 1 ? 's' : ''}`
    : `${filteredDivisions.length} division${filteredDivisions.length !== 1 ? 's' : ''}`;

  return (
    <div className="lb-section font-body">

      {/* ── Toolbar row ───────────────────────────────────────────── */}
      <div className="lb-toolbar">
        {/* Left: title + count */}
        <div className="lb-title-group">
          <h2 className="lb-title font-heading">
            <Trophy size={18} />
            Leaderboard
          </h2>
          <span className="lb-count">{resultCount}</span>
        </div>

        {/* Centre: segmented toggle (Fix A: aria-pressed + prominent active state) */}
        <div className="lb-seg" role="group" aria-label="View toggle">
          <button
            className={`lb-seg-btn${activeView === 'individuals' ? ' active' : ''}`}
            onClick={() => setActiveView('individuals')}
            type="button"
            aria-pressed={activeView === 'individuals'}
          >
            <Users size={13} />
            Individuals
          </button>
          <button
            className={`lb-seg-btn${activeView === 'divisions' ? ' active' : ''}`}
            onClick={() => setActiveView('divisions')}
            type="button"
            aria-pressed={activeView === 'divisions'}
          >
            <Trophy size={13} />
            Divisions
          </button>
        </div>

        {/* Right: filters */}
        <div className="lb-filters">
          {/* Search (individuals only) */}
          {activeView === 'individuals' && (
            <div className="lb-search-wrap">
              <Search size={13} className="lb-search-icon" />
              <input
                type="text"
                placeholder="Search user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="lb-search font-body"
                aria-label="Search user"
              />
            </div>
          )}

          {/* Division select */}
          <select
            className="lb-select font-body"
            value={activeDivisi}
            onChange={(e) => handleDivisiChange(e.target.value)}
            disabled={readOnly}
            aria-label="Filter by division"
          >
            <option value="ALL">All Divisions</option>
            {divisionList.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>

          {/* Badge select (individuals only) */}
          {activeView === 'individuals' && (
            <select
              className="lb-select font-body"
              value={activeBadge}
              onChange={(e) => handleBadgeChange(e.target.value)}
              disabled={readOnly}
              aria-label="Filter by badge"
            >
              <option value="ALL">All Badges</option>
              <option value="Sentinel">Sentinel</option>
              <option value="Guardian">Guardian</option>
              <option value="Vulnerable">Vulnerable</option>
            </select>
          )}
        </div>
      </div>

      {/* ── Table (Fix B, C, D, E) ─────────────────────────────────── */}
      <div className="lb-table-wrap">
        {activeView === 'individuals' ? (
          <table className="lb-table">
            <thead>
              <tr>
                <th className="lb-th-rank">Rank</th>
                <th className="lb-th-email">Employee</th>
                <th className="lb-th-div">Division</th>
                <th className="lb-th-badge">Badge</th>
                <th className="lb-th-points">Points</th>
              </tr>
            </thead>
            <tbody>
              {filteredIndividual.length === 0 ? (
                <tr>
                  <td colSpan={5} className="lb-empty">
                    No results match your filters.
                  </td>
                </tr>
              ) : (
                filteredIndividual.map((row, idx) => {
                  const rank = idx + 1;
                  const isTop3 = rank <= 3;
                  const badgeLower = (row.badge || '').toLowerCase();
                  const isVulnerable = badgeLower === 'vulnerable';
                  const isSentinel = badgeLower === 'sentinel' || badgeLower === 'cyber shield elite' || badgeLower === 'the front man';
                  const badgeClass = isSentinel ? 'badge-success' : isVulnerable ? 'badge-danger' : 'badge-warning';

                  return (
                    <tr key={idx} className="lb-row">
                      {/* Rank cell: fixed 14px dot slot on every row */}
                      <td className="lb-cell-rank">
                        <div className="lb-rank-content">
                          <span className="lb-rank-slot">
                            {isTop3 && <span className={`lb-rank-dot lb-rank-dot-${rank}`} />}
                          </span>
                          <span className={`lb-rank-num${isTop3 ? ' top' : ''}`}>#{rank}</span>
                        </div>
                      </td>
                      {/* Employee cell: 14px font, middle aligned */}
                      <td className="lb-email-cell">
                        <span className="lb-email" title={row.email}>{row.email}</span>
                      </td>
                      {/* Division cell: 14px matching font */}
                      <td className="lb-div-cell">
                        <span className="lb-div">{row.divisi}</span>
                      </td>
                      {/* Badge cell: 24-26px pill */}
                      <td className="lb-badge-cell">
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
                      {/* Points cell: tabular-nums, neutral primary (accent for top 3) */}
                      <td className="lb-pts-cell">
                        <span className={isTop3 ? 'lb-pts-top' : 'lb-pts-val'}>
                          {row.points}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="lb-table">
            <thead>
              <tr>
                <th className="lb-th-rank">Rank</th>
                <th className="lb-th-div-main">Division</th>
                <th className="lb-th-members">Members</th>
                <th className="lb-th-points">Points</th>
              </tr>
            </thead>
            <tbody>
              {filteredDivisions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="lb-empty">
                    No results match your filters.
                  </td>
                </tr>
              ) : (
                filteredDivisions.map((row, idx) => {
                  const rank = idx + 1;
                  const isTop3 = rank <= 3;
                  return (
                    <tr key={idx} className="lb-row">
                      {/* Rank cell: fixed 14px dot slot on every row */}
                      <td className="lb-cell-rank">
                        <div className="lb-rank-content">
                          <span className="lb-rank-slot">
                            {isTop3 && <span className={`lb-rank-dot lb-rank-dot-${rank}`} />}
                          </span>
                          <span className={`lb-rank-num${isTop3 ? ' top' : ''}`}>#{rank}</span>
                        </div>
                      </td>
                      {/* Division cell: 14px matching font */}
                      <td className="lb-div-cell">
                        <span className="lb-div">{row.divisi}</span>
                      </td>
                      {/* Members count */}
                      <td className="lb-members-cell">
                        <span className="lb-members">{row.member_count}</span>
                      </td>
                      {/* Points cell: tabular-nums, neutral primary (accent for top 3) */}
                      <td className="lb-pts-cell">
                        <span className={isTop3 ? 'lb-pts-top' : 'lb-pts-val'}>
                          {row.avg_points}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
