'use client';

import React, { useState } from 'react';
import { Fish, RefreshCw, Play, Users, Eye, Trash2, Pencil, Mail, Plus, Globe } from 'lucide-react';
import { GoPhishCampaign, GoPhishResource } from '@/components/admin/types';

interface GophishCampaignSectionProps {
  readOnly: boolean;
  campaigns: GoPhishCampaign[];
  employees: any[];
  divisions: any[];
  resources: GoPhishResource | null;
  selectedEmails: string[];
  onSelectedEmailsChange: (emails: string[]) => void;
  onSyncUsers: () => void;
  onOpenLaunchModal: () => void;
  onDeleteCampaign: (id: number) => void;
  onViewCampaignDetail: (id: number) => void;
  onOpenTemplateBuilder: (mode: 'new' | 'edit', type: 'template' | 'page', item?: any) => void;
  onDeleteTemplate: (id: number) => void;
  onDeletePage: (id: number) => void;
}

export default function GophishCampaignSection({
  readOnly,
  campaigns,
  employees,
  divisions,
  resources,
  selectedEmails,
  onSelectedEmailsChange,
  onSyncUsers,
  onOpenLaunchModal,
  onDeleteCampaign,
  onViewCampaignDetail,
  onOpenTemplateBuilder,
  onDeleteTemplate,
  onDeletePage
}: GophishCampaignSectionProps) {
  const [gpEmployeeFilter, setGpEmployeeFilter] = useState('ALL');

  return (
    <>
      <div className="panel glass-card fade-up" style={{ marginBottom: '0' }}>
        <div className="panel-header">
          <div>
            <h2 className="panel-title"><Fish size={20} style={{ marginRight: "8px", verticalAlign: "text-bottom" }} /> GoPhish Command Center</h2>
            <p className="panel-desc" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Kontrol visual untuk sinkronisasi target dan meluncurkan simulasi phishing via GoPhish API.
            </p>
          </div>
          {!readOnly && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-action" onClick={onSyncUsers} style={{ background: 'rgba(129, 140, 248, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={16} /> Sync Target Group
              </button>
              <button className="btn-action" onClick={onOpenLaunchModal} style={{ background: 'var(--accent)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Play size={16} /> Launch Simulation
              </button>
            </div>
          )}
        </div>

        {/* Target Selection panel for orchestration */}
        <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px', marginBottom: '24px', marginLeft: '24px', marginRight: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> Target Selection ({selectedEmails.length} terpilih)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Pilih target karyawan untuk kampanye simulasi berikutnya.</p>
            </div>
            {!readOnly && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Division Filter */}
                <select
                  value={gpEmployeeFilter}
                  onChange={(e) => setGpEmployeeFilter(e.target.value)}
                  style={{ padding: '6px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white', fontSize: '12px', outline: 'none' }}
                >
                  <option value="ALL">Semua Divisi</option>
                  {divisions.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
                <button
                  onClick={() => {
                    const activeEmps = employees.filter(e => e.is_active === 1 && (gpEmployeeFilter === 'ALL' || e.divisi === gpEmployeeFilter));
                    onSelectedEmailsChange(activeEmps.map(e => e.email));
                  }}
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                >
                  Pilih Semua
                </button>
                <button
                  onClick={() => onSelectedEmailsChange([])}
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                >
                  Bersihkan
                </button>
              </div>
            )}
          </div>

          {/* Target checklist grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', maxHeight: '160px', overflowY: 'auto', padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
            {employees.filter(emp => emp.is_active === 1).filter(emp => gpEmployeeFilter === 'ALL' || emp.divisi === gpEmployeeFilter).map(emp => {
              const isChecked = selectedEmails.includes(emp.email);
              return (
                <label
                  key={emp.email}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.01)',
                    border: isChecked ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: '4px',
                    cursor: readOnly ? 'default' : 'pointer',
                    fontSize: '12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={readOnly}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onSelectedEmailsChange([...selectedEmails, emp.email]);
                      } else {
                        onSelectedEmailsChange(selectedEmails.filter(email => email !== emp.email));
                      }
                    }}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span title={emp.email} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.email}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Ringkasan horizontal — sebelumnya cuma judul + tabel doang */}
        <div className="gophish-summary-strip">
          <div className="policy-summary-item">
            <div className="policy-summary-value">{campaigns.length}</div>
            <div className="policy-summary-label">Kampanye</div>
          </div>
          <div className="policy-summary-item">
            <div className="policy-summary-value">{campaigns.reduce((sum, c) => sum + (c.stats?.sent ?? 0), 0)}</div>
            <div className="policy-summary-label">Terkirim</div>
          </div>
          <div className="policy-summary-item">
            <div className="policy-summary-value">{campaigns.reduce((sum, c) => sum + (c.stats?.clicked ?? 0), 0)}</div>
            <div className="policy-summary-label">Diklik</div>
          </div>
          <div className="policy-summary-item">
            <div className="policy-summary-value">{campaigns.reduce((sum, c) => sum + (c.stats?.submitted_data ?? 0), 0)}</div>
            <div className="policy-summary-label">Leaks Kredensial</div>
          </div>
        </div>

        <div className="threat-table-wrap">
          <table className="threat-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nama Kampanye</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Terkirim</th>
                <th style={{ textAlign: 'center' }}>Dibuka</th>
                <th style={{ textAlign: 'center' }}>Diklik</th>
                <th style={{ textAlign: 'center' }}>Leaks Kredensial</th>
                <th style={{ textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    Belum ada kampanye aktif. {readOnly ? '' : 'Klik "Launch Simulation" untuk memulai.'}
                  </td>
                </tr>
              ) : (
                campaigns.map(c => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td style={{ fontWeight: 600 }}>
                      <span 
                        onClick={() => onViewCampaignDetail(c.id)} 
                        style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent)' }}
                        title="Klik untuk lihat detail"
                      >
                        {c.name}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${c.status === 'In Progress' ? 'badge-warning' : 'badge-allow'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{c.stats?.sent ?? 0}</td>
                    <td style={{ color: 'var(--warning)', textAlign: 'center' }}>{c.stats?.opened ?? 0}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 'bold', textAlign: 'center' }}>{c.stats?.clicked ?? 0}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 'bold', textAlign: 'center' }}>{c.stats?.submitted_data ?? 0}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => onViewCampaignDetail(c.id)}
                        title="Detail kampanye"
                        style={{ padding: '6px', background: 'transparent', border: '1px solid var(--accent)', borderRadius: '6px', cursor: 'pointer', color: 'var(--accent)', marginRight: '6px' }}
                      >
                        <Eye size={14} />
                      </button>
                      {!readOnly && (
                        <button
                          onClick={() => onDeleteCampaign(c.id)}
                          title="Hapus kampanye"
                          style={{ padding: '6px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Koleksi Phishing Sendiri (Template & Landing Page) ── */}
      <div className="panel glass-card fade-up" style={{ marginTop: '24px', marginBottom: '48px' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="panel-title"><Pencil size={20} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Koleksi Phishing Saya</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Bikin email template & landing page sendiri langsung dari sini — gak perlu buka GoPhish.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px' }}>
            {/* Email Templates */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={16} /> Email Templates ({resources?.templates?.length ?? 0})
                </h3>
                {!readOnly && (
                  <button
                    onClick={() => onOpenTemplateBuilder('new', 'template')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    <Plus size={14} /> Buat Baru
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {(resources?.templates?.length ?? 0) === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                    Belum ada template. {readOnly ? '' : 'Klik "Buat Baru" buat mulai.'}
                  </div>
                ) : (
                  resources!.templates.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject || '—'}</div>
                      </div>
                      {!readOnly && (
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => onOpenTemplateBuilder('edit', 'template', t)} title="Edit" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'white' }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => onDeleteTemplate(t.id)} title="Hapus" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Landing Pages */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={16} /> Landing Pages ({resources?.pages?.length ?? 0})
                </h3>
                {!readOnly && (
                  <button
                    onClick={() => onOpenTemplateBuilder('new', 'page')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    <Plus size={14} /> Buat Baru
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {(resources?.pages?.length ?? 0) === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                    Belum ada landing page. {readOnly ? '' : 'Klik "Buat Baru" buat mulai.'}
                  </div>
                ) : (
                  resources!.pages.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {p.capture_credentials ? 'Capture kredensial: Ya' : 'Capture kredensial: Tidak'}
                        </div>
                      </div>
                      {!readOnly && (
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => onOpenTemplateBuilder('edit', 'page', p)} title="Edit" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', color: 'white' }}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => onDeletePage(p.id)} title="Hapus" style={{ padding: '6px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer', color: 'var(--danger)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
    </>
  );
}
