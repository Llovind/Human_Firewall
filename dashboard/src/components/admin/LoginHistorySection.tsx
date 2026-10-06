'use client';

import { Server } from 'lucide-react';
import { AdminLoginEvent } from '@/components/admin/types';
import DataTable, { type Column } from '@/components/ui/DataTable';
import SeverityBadge from '@/components/ui/SeverityBadge';
import StateMessage from '@/components/ui/StateMessage';
import { useI18n } from '@/i18n/I18nProvider';

interface LoginHistorySectionProps {
  readOnly: boolean;
  loginHistory: AdminLoginEvent[] | { logs?: AdminLoginEvent[]; loginHistory?: AdminLoginEvent[] };
}

export default function LoginHistorySection({ loginHistory }: LoginHistorySectionProps) {
  const { t } = useI18n();
  const logs = Array.isArray(loginHistory) ? loginHistory : loginHistory?.logs || loginHistory?.loginHistory || [];

  const columns: Column<AdminLoginEvent>[] = [
    { key: 'email', header: t('login.col.person'), render: log => <span className="cell-clip" title={log.reason}>{log.email}</span> },
    { key: 'division', header: t('login.col.division'), secondary: true, render: log => log.division },
    { key: 'time', header: t('login.col.time'), render: log => log.login_time },
    { key: 'device', header: t('login.col.device'), secondary: true, render: log => log.device },
    { key: 'location', header: t('login.col.location'), secondary: true, render: log => log.location },
    { key: 'network', header: t('login.col.network'), secondary: true, render: log => <>{log.network}{log.vpn && <span className="chip" data-tone="ok"><i aria-hidden="true" />{t('login.vpn')}</span>}</> },
    { key: 'risk', header: t('login.col.risk'), render: log => <SeverityBadge value={log.risk} /> },
  ];

  return (
    <section className="ops-block" aria-labelledby="login-history-title">
      <div className="ops-head">
        <h3 id="login-history-title"><Server size={16} aria-hidden="true" /> {t('login.title')}</h3>
        <span className="emp-muted">{t('login.count', { n: logs.length })}</span>
      </div>
      <DataTable
        caption={t('login.title')}
        columns={columns}
        rows={logs}
        rowKey={log => String(log.id)}
        empty={<StateMessage variant="empty" title={t('login.empty.title')} why={t('login.empty.why')} />}
      />
    </section>
  );
}
