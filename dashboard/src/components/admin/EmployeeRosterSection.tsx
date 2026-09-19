'use client';

import React, { useState } from 'react';
import { KeyRound, Search, Sliders, Users, Plus } from 'lucide-react';
import type { Division, EmployeeAccount } from '@/components/admin/types';

interface EmployeeRosterSectionProps {
  readOnly: boolean;
  employees: EmployeeAccount[];
  divisions: Division[];
  onOpenAddEmployee: (employee?: EmployeeAccount) => void;
  onOpenEditEmployee: (emp: EmployeeAccount) => void;
  onOpenAddDivision: () => void;
}

export default function EmployeeRosterSection({
  readOnly,
  employees,
  divisions,
  onOpenAddEmployee,
  onOpenEditEmployee,
  onOpenAddDivision
}: EmployeeRosterSectionProps) {
  const [employeeDivisionFilter, setEmployeeDivisionFilter] = useState('ALL');
  const [employeeSearchText, setEmployeeSearchText] = useState('');

  return (
    <div className="font-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', marginBottom: '48px' }}>
      {/* Top Horizontal Filter Bar */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px', width: '100%', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          <Sliders size={16} /> Directory Filters
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="filter-select font-body" 
            value={employeeDivisionFilter} 
            onChange={(e) => setEmployeeDivisionFilter(e.target.value)}
            style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
          >
            <option value="ALL">ALL DIVISIONS</option>
            {divisions.map((div) => (
              <option key={div.name} value={div.name}>{div.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees List (Full Width) */}
      <div className="panel glass-card" style={{ marginBottom: 0 }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="panel-title font-heading"><Users size={20} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Employee Directory</h2>
            <p className="panel-desc" style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
              Add, modify, and manage organizational employee security rosters.
            </p>
          </div>
          {!readOnly && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-action font-body"
                onClick={onOpenAddDivision}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Add Division
              </button>
              <button
                className="btn-action font-body"
                onClick={() => onOpenAddEmployee()}
                style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Add Employee
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="search"
              aria-label="Search employee directory"
              placeholder="Search by email or access role..."
              value={employeeSearchText}
              onChange={(e) => setEmployeeSearchText(e.target.value)}
              className="font-body"
              style={{ width: '100%', padding: '10px 12px 10px 36px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
            />
          </div>
        </div>

        <div className="threat-table-wrap">
          <table className="threat-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Division</th>
                <th>Access Role</th>
                <th style={{ textAlign: 'center' }}>Login</th>
                <th style={{ textAlign: 'center' }}>Points</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                {!readOnly && <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = employees.filter(emp => {
                  const query = employeeSearchText.toLowerCase();
                  const matchesSearch = emp.email.toLowerCase().includes(query) || (emp.role || '').toLowerCase().includes(query);
                  const matchesDivision = employeeDivisionFilter === 'ALL' || emp.divisi === employeeDivisionFilter;
                  return matchesSearch && matchesDivision;
                });
                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={readOnly ? 6 : 7} style={{ textAlign: 'center', padding: '34px', color: 'var(--text-muted)' }}>
                        No employees found matching the query.
                      </td>
                    </tr>
                  );
                }
                return filtered.map((emp) => (
                  <tr key={emp.email}>
                    <td className="font-mono-data" style={{ fontWeight: 600 }}>{emp.email}</td>
                    <td>{emp.divisi}</td>
                    <td>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-secondary)' }}>
                        {(emp.role || 'not provisioned').replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${emp.has_account ? 'badge-allow' : 'badge-warning'} font-body`}>
                        {emp.has_account ? 'READY' : 'NO ACCOUNT'}
                      </span>
                    </td>
                    <td className="font-mono-data" style={{ textAlign: 'center', fontWeight: 'bold', color: emp.points >= 130 ? 'var(--text-success)' : emp.points >= 60 ? 'var(--accent)' : 'var(--text-danger)' }}>
                      {emp.points}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${emp.is_active === 1 ? 'badge-allow' : 'badge-danger'} font-body`}>
                        {emp.is_active === 1 ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    {!readOnly && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => emp.has_account ? onOpenEditEmployee(emp) : onOpenAddEmployee(emp)}
                          className="font-body"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                        >
                          {emp.has_account ? 'Manage' : <><KeyRound size={12} style={{ marginRight: '4px', verticalAlign: '-2px' }} />Create login</>}
                        </button>
                      </td>
                    )}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
