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
      <div className="panel glass-card fade-up font-body" style={{
        marginTop: '24px',
        padding: '24px'
      }}>
        <div className="panel-header" style={{ marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
          <h2 className="panel-title font-heading" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            <Server size={20} style={{ color: '#2196F3' }} /> Login &amp; Device Audit Trail (Identity Security)
          </h2>
          <span className="font-mono-data" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', background: 'rgba(33, 150, 243, 0.1)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            {logs.length} logs detected
          </span>
        </div>
        <div className="threat-table-wrap" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <table className="threat-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: '20%', textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Employee</th>
                <th style={{ width: '15%', textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Division</th>
                <th style={{ width: '15%', textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Access Timestamp</th>
                <th style={{ width: '15%', textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Device</th>
                <th style={{ width: '15%', textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Location</th>
                <th style={{ width: '10%', textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Connection</th>
                <th style={{ width: '10%', textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '13px' }}>
                    No login audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log: any, idx: number) => {
                  let badgeBg = 'var(--bg-success)';
                  let badgeColor = 'var(--text-success)';
                  let badgeBorder = 'var(--border-success)';

                  if (log.risk === 'HIGH' || log.risk === 'CRITICAL' || log.risk === 'DANGER') {
                    badgeBg = 'var(--bg-danger)';
                    badgeColor = 'var(--text-danger)';
                    badgeBorder = 'var(--border-danger)';
                  } else if (log.risk === 'MEDIUM' || log.risk === 'WARNING') {
                    badgeBg = 'var(--bg-warning)';
                    badgeColor = 'var(--text-warning)';
                    badgeBorder = 'var(--border-warning)';
                  }

                  return (
                    <tr key={log.id || idx} title={log.reason} style={{ borderBottom: idx < logs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="font-mono-data" style={{ fontWeight: 600, color: 'var(--text-primary)', padding: '12px 16px', fontSize: '13px' }}>{log.email}</td>
                      <td style={{ color: 'var(--text-secondary)', padding: '12px 16px', fontSize: '12px' }}>{log.division}</td>
                      <td className="font-mono-data" style={{ color: 'var(--text-muted)', padding: '12px 16px', fontSize: '12px' }}>{log.login_time}</td>
                      <td style={{ color: 'var(--text-secondary)', padding: '12px 16px', fontSize: '12px' }}>{log.device}</td>
                      <td style={{ color: 'var(--text-secondary)', padding: '12px 16px', fontSize: '12px' }}>{log.location}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{log.network}</span>
                        {log.vpn && (
                          <span className="font-mono-data" style={{ fontSize: '9px', padding: '2px 6px', background: 'var(--bg-success)', color: 'var(--text-success)', border: '1px solid var(--border-success)', borderRadius: '4px', marginLeft: '6px', fontWeight: 700 }}>VPN</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="font-body" style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                          display: 'inline-block'
                        }}>
                          {log.risk}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
