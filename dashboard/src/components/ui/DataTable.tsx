'use client';

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right';
  /** Hide this column in narrow containers. */
  secondary?: boolean;
}

interface DataTableProps<T> {
  /** Names the table for screen readers. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  density?: 'compact' | 'comfortable';
  empty?: ReactNode;
}

/** One table for incidents, traffic, accounts, campaigns and clauses. */
export default function DataTable<T>({ caption, columns, rows, rowKey, onRowClick, selectedKey, density = 'compact', empty }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find(c => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const get = column.sortValue;
    return [...rows].sort((a, b) => {
      const x = get(a); const y = get(b);
      const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return sort.dir === 'asc' ? result : -result;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) => setSort(current => (current?.key === key ? (current.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  const onKey = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRowClick(row); }
  };

  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="table-wrap" data-density={density}>
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map(column => {
              const active = sort?.key === column.key;
              return (
                <th key={column.key} scope="col" data-align={column.align} data-secondary={column.secondary || undefined} aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : column.sortValue ? 'none' : undefined}>
                  {column.sortValue
                    ? <button type="button" className="th-sort" onClick={() => toggle(column.key)}>{column.header}{active && (sort?.dir === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}</button>
                    : column.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => {
            const key = rowKey(row);
            return (
              <tr key={key} data-clickable={onRowClick ? '' : undefined} aria-selected={onRowClick ? selectedKey === key : undefined} tabIndex={onRowClick ? 0 : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined} onKeyDown={event => onKey(event, row)}>
                {columns.map(column => <td key={column.key} data-align={column.align} data-secondary={column.secondary || undefined}>{column.render(row)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
