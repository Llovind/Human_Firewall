'use client';

import React, { useState } from 'react';
import { Sliders, Users, Plus } from 'lucide-react';

interface EmployeeRosterSectionProps {
  readOnly: boolean;
  employees: any[];
  divisions: any[];
  onOpenAddEmployee: () => void;
  onOpenEditEmployee: (emp: any) => void;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', marginBottom: '48px' }}>
      {/* Top Horizontal Filter Bar */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px', width: '100%', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          <Sliders size={16} /> Directory Filters
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            className="filter-select" 
            value={employeeDivisionFilter} 
            onChange={(e) => setEmployeeDivisionFilter(e.target.value)}
            style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '12px' }}
          >
            <option value="ALL">SEMUA DIVISI</option>
            {divisions.map((div) => (
              <option key={div.name} value={div.name}>{div.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Left: Employees List (Full Width) */}
      <div className="panel glass-card" style={{ marginBottom: 0 }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="panel-title"><Users size={20} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Employee Directory</h2>
            <p className="panel-desc" style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
              Tambah, edit, dan kelola status aktif karyawan.
            </p>
          </div>
          {!readOnly && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-action"
                onClick={onOpenAddDivision}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Add Division
              </button>
              <button
                className="btn-action"
                onClick={onOpenAddEmployee}
                style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Add Employee
              </button>
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Cari karyawan berdasarkan email..."
            value={employeeSearchText}
            onChange={(e) => setEmployeeSearchText(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', fontSize: '13px', outline: 'none' }}
          />
        </div>

        <div className="threat-table-wrap">
          <table className="threat-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Email</th>
                <th style={{ width: '25%' }}>Divisi</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Poin</th>
                <th style={{ width: '13%', textAlign: 'center' }}>Status</th>
                {!readOnly && <th style={{ width: '10%', textAlign: 'right' }}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filtered = employees.filter(emp => {
                  const matchesSearch = emp.email.toLowerCase().includes(employeeSearchText.toLowerCase());
                  const matchesDivision = employeeDivisionFilter === 'ALL' || emp.divisi === employeeDivisionFilter;
                  return matchesSearch && matchesDivision;
                });
                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td colSpan={readOnly ? 4 : 5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        Tidak ada karyawan ditemukan.
                      </td>
                    </tr>
                  );
                }
                return filtered.map((emp) => (
                  <tr key={emp.email}>
                    <td className="mono" style={{ fontWeight: 600 }}>{emp.email}</td>
                    <td>{emp.divisi}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: emp.points >= 130 ? 'var(--success)' : emp.points >= 60 ? 'var(--info)' : 'var(--danger)' }}>
                      {emp.points}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${emp.is_active === 1 ? 'badge-allow' : 'badge-danger'}`}>
                        {emp.is_active === 1 ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    {!readOnly && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => onOpenEditEmployee(emp)}
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                        >
                          Edit
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
