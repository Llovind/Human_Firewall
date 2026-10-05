'use client';

import { Search } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export interface FilterSelect {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface FilterBarProps {
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
  selects?: FilterSelect[];
  /** Number of filters that differ from their default. Shows "Clear filters" when above zero. */
  activeCount?: number;
  onClear?: () => void;
  clearLabel?: string;
}

export default function FilterBar({ search, selects = [], activeCount = 0, onClear, clearLabel }: FilterBarProps) {
  const { t } = useI18n();
  return (
    <div className="filter-bar" role="search">
      {search && (
        <label className="filter-search">
          <Search size={15} aria-hidden="true" />
          <span className="visually-hidden">{search.placeholder}</span>
          <input type="search" value={search.value} placeholder={search.placeholder} onChange={event => search.onChange(event.target.value)} />
        </label>
      )}
      {selects.map(select => (
        <label key={select.id} className="filter-select">
          <span className="visually-hidden">{select.label}</span>
          <select value={select.value} onChange={event => select.onChange(event.target.value)}>
            {select.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ))}
      {activeCount > 0 && onClear && <button type="button" className="btn" onClick={onClear}>{clearLabel ?? t('common.clearFilters')}</button>}
    </div>
  );
}
