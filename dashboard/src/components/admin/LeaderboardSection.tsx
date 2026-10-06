'use client';

import { useState } from 'react';
import { Trophy, Users } from 'lucide-react';
import { LeaderboardResponse, type IndividualLeaderboard, type DivisionLeaderboard } from '@/components/admin/types';
import DataTable, { type Column } from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip, { type StatusTone } from '@/components/ui/StatusChip';
import { useI18n } from '@/i18n/I18nProvider';

interface LeaderboardSectionProps {
  readOnly: boolean;
  leaderboardData: LeaderboardResponse | null;
  divisiFilter?: string;
  badgeFilter?: string;
  onDivisiFilterChange?: (val: string) => void;
  onBadgeFilterChange?: (val: string) => void;
}

const BADGES = ['Sentinel', 'Guardian', 'Vulnerable'];

function badgeTone(badge: string): StatusTone {
  const value = (badge || '').toLowerCase();
  if (value === 'vulnerable') return 'bad';
  if (value === 'sentinel' || value === 'cyber shield elite' || value === 'the front man') return 'ok';
  return 'warn';
}

/** Filters are local: they work for read-only roles too, because looking at a list differently changes no data. */
export default function LeaderboardSection({ leaderboardData, divisiFilter = 'ALL', badgeFilter = 'ALL', onDivisiFilterChange, onBadgeFilterChange }: LeaderboardSectionProps) {
  const { t } = useI18n();
  const [division, setDivision] = useState(divisiFilter || 'ALL');
  const [badge, setBadge] = useState(badgeFilter || 'ALL');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'people' | 'divisions'>('people');

  const divisions = Array.from(new Set((leaderboardData?.by_divisi || []).map(d => d.divisi).filter(Boolean)));
  const divisionRows = (leaderboardData?.by_divisi || []).filter(row => division === 'ALL' || row.divisi === division);
  const people = (leaderboardData?.individual || []).filter(row =>
    (division === 'ALL' || row.divisi === division) &&
    (badge === 'ALL' || (row.badge || '').toLowerCase() === badge.toLowerCase()) &&
    (!query || row.email.toLowerCase().includes(query.toLowerCase()) || (row.divisi || '').toLowerCase().includes(query.toLowerCase())));

  const changeDivision = (value: string) => { setDivision(value); onDivisiFilterChange?.(value); };
  const changeBadge = (value: string) => { setBadge(value); onBadgeFilterChange?.(value); };
  const rankCell = (index: number) => <span className="rank">#{index + 1}</span>;
  const empty = <StateMessage variant="empty" title={t('lb.empty.title')} why={t('lb.empty.why')} />;

  const peopleColumns: Column<IndividualLeaderboard>[] = [
    { key: 'rank', header: t('lb.col.rank'), render: row => rankCell(people.indexOf(row)) },
    { key: 'email', header: t('lb.col.person'), render: row => <span className="cell-clip" title={row.email}>{row.email}</span> },
    { key: 'divisi', header: t('lb.col.division'), secondary: true, sortValue: row => row.divisi, render: row => row.divisi },
    { key: 'badge', header: t('lb.col.badge'), render: row => <StatusChip tone={badgeTone(row.badge)}>{row.badge}</StatusChip> },
    { key: 'points', header: t('lb.col.points'), align: 'right', sortValue: row => row.points, render: row => row.points },
  ];
  const divisionColumns: Column<DivisionLeaderboard>[] = [
    { key: 'rank', header: t('lb.col.rank'), render: row => rankCell(divisionRows.indexOf(row)) },
    { key: 'divisi', header: t('lb.col.division'), render: row => row.divisi },
    { key: 'members', header: t('lb.col.members'), align: 'right', secondary: true, sortValue: row => row.member_count, render: row => row.member_count },
    { key: 'avg', header: t('lb.col.avg'), align: 'right', sortValue: row => row.avg_points, render: row => row.avg_points },
  ];

  const selects = [
    { id: 'division', label: t('lb.filter.division'), value: division, onChange: changeDivision, options: [{ value: 'ALL', label: t('lb.division.all') }, ...divisions.map(d => ({ value: d, label: d }))] },
    ...(view === 'people' ? [{ id: 'badge', label: t('lb.filter.badge'), value: badge, onChange: changeBadge, options: [{ value: 'ALL', label: t('lb.badge.all') }, ...BADGES.map(b => ({ value: b, label: b }))] }] : []),
  ];
  const activeCount = (division !== 'ALL' ? 1 : 0) + (view === 'people' && badge !== 'ALL' ? 1 : 0) + (view === 'people' && query ? 1 : 0);

  return (
    <section className="ops-block" aria-labelledby="lb-title">
      <div className="ops-head">
        <h3 id="lb-title"><Trophy size={16} aria-hidden="true" /> {t('lb.title')}</h3>
        <span className="emp-muted">{view === 'people' ? t('lb.count.people', { n: people.length }) : t('lb.count.divisions', { n: divisionRows.length })}</span>
      </div>
      <div className="seg" role="group" aria-label={t('lb.view')}>
        <button type="button" aria-pressed={view === 'people'} onClick={() => setView('people')}><Users size={14} aria-hidden="true" />{t('lb.view.people')}</button>
        <button type="button" aria-pressed={view === 'divisions'} onClick={() => setView('divisions')}><Trophy size={14} aria-hidden="true" />{t('lb.view.divisions')}</button>
      </div>
      <FilterBar
        search={view === 'people' ? { value: query, onChange: setQuery, placeholder: t('lb.search') } : undefined}
        selects={selects}
        activeCount={activeCount}
        onClear={() => { changeDivision('ALL'); changeBadge('ALL'); setQuery(''); }}
      />
      {view === 'people'
        ? <DataTable caption={t('lb.title')} columns={peopleColumns} rows={people} rowKey={row => row.email} empty={empty} />
        : <DataTable caption={t('lb.title')} columns={divisionColumns} rows={divisionRows} rowKey={row => row.divisi} empty={empty} />}
    </section>
  );
}
