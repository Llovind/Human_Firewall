'use client';

import React from 'react';
import { Server } from 'lucide-react';
import { AdminLoginEvent } from '@/components/admin/types';

interface LoginHistorySectionProps {
  readOnly: boolean;
  loginHistory: AdminLoginEvent[];
}

export default function LoginHistorySection({ readOnly, loginHistory }: LoginHistorySectionProps) {
  const logs = Array.isArray(loginHistory)
    ? loginHistory
    : (loginHistory as any)?.logs || (loginHistory as any)?.loginHistory || [];

  return (
    <>
      {/* Central Login & Device Anomaly Audit Log */}
      <div className="panel glass-card fade-up" style={{ marginTop: '24px' }}>
        <div className="panel-header">
          <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={20} /> Audit Riwayat Login & Perangkat (Identity Security)
          </h2>
          <span className="panel-count">{logs.length} log terdeteksi</span>
        </div>
        <div className="threat-table-wrap">
          <table className="threat-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '20%', textAlign: 'left' }}>Karyawan</th>
                <th style={{ width: '15%', textAlign: 'left' }}>Divisi</th>
                <th style={{ width: '15%', textAlign: 'left' }}>Waktu Akses</th>
                <th style={{ width: '15%', textAlign: 'left' }}>Perangkat</th>
                <th style={{ width: '15%', textAlign: 'left' }}>Lokasi</th>
                <th style={{ width: '10%', textAlign: 'left' }}>Koneksi</th>
                <th style={{ width: '10%', textAlign: 'left' }}>Risiko</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    Belum ada log audit login terkumpul.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} title={log.reason}>
                    <td style={{ fontWeight: 600 }}>{log.email}</td>
                    <td>{log.division}</td>
                    <td className="mono">{log.login_time}</td>
                    <td>{log.device}</td>
                    <td>{log.location}</td>
                    <td>
                      {log.network}
                      {log.vpn && (
                        <span style={{ fontSize: '9px', padding: '2px 4px', background: 'rgba(52, 211, 153, 0.15)', color: 'var(--success)', borderRadius: '4px', marginLeft: '6px' }}>VPN</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: log.risk === 'LOW' ? 'rgba(52, 211, 153, 0.12)' : log.risk === 'MEDIUM' ? 'rgba(251, 191, 36, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                        color: log.risk === 'LOW' ? 'var(--success)' : log.risk === 'MEDIUM' ? 'var(--warning)' : 'var(--danger)'
                      }}>
                        {log.risk}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
