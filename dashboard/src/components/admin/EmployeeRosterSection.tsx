'use client';

import { useState } from 'react';
import { KeyRound, Plus } from 'lucide-react';
import type { Division, EmployeeAccount } from '@/components/admin/types';
import DataTable, { type Column } from '@/components/ui/DataTable';
import FilterBar from '@/components/ui/FilterBar';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip from '@/components/ui/StatusChip';
import { useI18n } from '@/i18n/I18nProvider';

interface EmployeeRosterSectionProps {
  readOnly: boolean;
  employees: EmployeeAccount[];
  divisions: Division[];
  onOpenAddEmployee: (employee?: EmployeeAccount) => void;
  onOpenEditEmployee: (emp: EmployeeAccount) => void;
  onOpenAddDivision: () => void;
}

export default function EmployeeRosterSection({ readOnly, employees, divisions, onOpenAddEmployee, onOpenEditEmployee, onOpenAddDivision }: EmployeeRosterSectionProps) {
  const { t } = useI18n();
  const [division, setDivision] = useState('ALL');
  const [query, setQuery] = useState('');

  const rows = employees.filter(emp => {
    const text = query.toLowerCase();
    return (emp.email.toLowerCase().includes(text) || (emp.role || '').toLowerCase().includes(text)) && (division === 'ALL' || emp.divisi === division);
  });

  const columns: Column<EmployeeAccount>[] = [
    { key: 'email', header: t('ros.col.email'), sortValue: e => e.email, render: e => <span className="cell-clip" title={e.email}>{e.email}</span> },
    { key: 'divisi', header: t('ros.col.division'), secondary: true, sortValue: e => e.divisi, render: e => e.divisi },
    { key: 'role', header: t('ros.col.role'), secondary: true, render: e => (e.role ? e.role.replace('_', ' ') : t('ros.role.none')) },
    { key: 'login', header: t('ros.col.login'), render: e => <StatusChip tone={e.has_account ? 'ok' : 'warn'}>{e.has_account ? t('ros.login.ready') : t('ros.login.none')}</StatusChip> },
    { key: 'points', header: t('ros.col.points'), align: 'right', secondary: true, sortValue: e => e.points, render: e => e.points },
    { key: 'status', header: t('ros.col.status'), render: e => <StatusChip tone={e.is_active === 1 ? 'ok' : 'bad'}>{e.is_active === 1 ? t('ros.status.active') : t('ros.status.inactive')}</StatusChip> },
    ...(readOnly ? [] : [{
      key: 'actions', header: t('ros.col.actions'), align: 'right' as const, render: (e: EmployeeAccount) => (
        <button type="button" className="btn" onClick={() => (e.has_account ? onOpenEditEmployee(e) : onOpenAddEmployee(e))}>
          {e.has_account ? t('ros.btn.manage') : <><KeyRound size={14} aria-hidden="true" /> {t('ros.btn.create')}</>}
        </button>
      ),
    }]),
  ];

  return (
    <section className="ops-block" aria-labelledby="ros-title">
      <div className="ops-intro">
        <div>
          <h3 id="ros-title" style={{ fontSize: 16, fontWeight: 600 }}>{t('ros.title')}</h3>
          <p className="emp-muted">{t('ros.desc')} · {t('ros.count', { n: rows.length })}</p>
        </div>
        {!readOnly && (
          <span className="ops-actions">
            <button type="button" className="btn" onClick={onOpenAddDivision}><Plus size={14} aria-hidden="true" /> {t('ros.add.division')}</button>
            <button type="button" className="btn btn-primary" onClick={() => onOpenAddEmployee()}><Plus size={14} aria-hidden="true" /> {t('ros.add.account')}</button>
          </span>
        )}
      </div>
      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: t('ros.search') }}
        selects={[{ id: 'division', label: t('ros.filter.division'), value: division, onChange: setDivision, options: [{ value: 'ALL', label: t('ros.division.all') }, ...divisions.map(d => ({ value: d.name, label: d.name }))] }]}
        activeCount={(division !== 'ALL' ? 1 : 0) + (query ? 1 : 0)}
        onClear={() => { setDivision('ALL'); setQuery(''); }}
      />
      <DataTable caption={t('ros.title')} columns={columns} rows={rows} rowKey={e => e.email} empty={<StateMessage variant="empty" title={t('ros.empty.title')} why={t('ros.empty.why')} />} />
    </section>
  );
}
