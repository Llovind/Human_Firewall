'use client';

import { useState } from 'react';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Dialog from '@/components/ui/Dialog';
import Field from '@/components/ui/Field';
import FilterBar from '@/components/ui/FilterBar';
import KpiCard from '@/components/ui/KpiCard';
import LanguageSwitch from '@/components/ui/LanguageSwitch';
import PageHeader from '@/components/ui/PageHeader';
import SeverityBadge, { type SeverityLevel } from '@/components/ui/SeverityBadge';
import StateMessage from '@/components/ui/StateMessage';
import StatusChip from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import ThemeToggle from '@/components/ThemeToggle';
import '@/app/employee.css';

interface Row { id: string; severity: SeverityLevel; target: string; division: string; age: number }
const ROWS: Row[] = [
  { id: 'INC-2041', severity: 'critical', target: 'secure-payroll-update.example', division: 'Finance', age: 35 },
  { id: 'INC-2040', severity: 'high', target: 'invoice-october.pdf.exe', division: 'Operations', age: 120 },
  { id: 'INC-2039', severity: 'medium', target: 'promo-giftcards.example', division: 'Marketing', age: 420 },
  { id: 'INC-2038', severity: 'low', target: 'git-hub-login.example', division: 'Engineering', age: 1440 },
];

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <section className="emp-card" style={{ display: 'grid', gap: 12 }}><div><h2 style={{ margin: 0 }}>{title}</h2>{note && <p className="emp-muted">{note}</p>}</div>{children}</section>;
}

export default function Gallery() {
  const toast = useToast();
  const [dialog, setDialog] = useState<null | 'normal' | 'danger'>(null);
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const columns: Column<Row>[] = [
    { key: 'sev', header: 'Severity', sortValue: r => r.severity, render: r => <SeverityBadge level={r.severity} /> },
    { key: 'id', header: 'ID', sortValue: r => r.id, render: r => <span className="mono">{r.id}</span> },
    { key: 'target', header: 'Target', render: r => r.target },
    { key: 'division', header: 'Division', render: r => r.division, secondary: true },
    { key: 'age', header: 'Age (min)', sortValue: r => r.age, render: r => r.age, align: 'right' },
  ];
  return (
    <div className="emp-page">
      <header className="emp-top"><span className="brand">AFFERENT · Component gallery</span><span className="emp-top-tools"><LanguageSwitch /><ThemeToggle /></span></header>
      <main className="emp-main" style={{ display: 'grid', gap: 16 }}>
        <PageHeader as="h1" title="Shared parts" description="Every part is shown here in the current theme and language. Use the toggles above to check both themes and both languages." />
        <Section title="Severity badge" note="Symbol, word and colour together. The shape also tells the level without colour."><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(['critical', 'high', 'medium', 'low', 'info', 'unknown'] as SeverityLevel[]).map(l => <SeverityBadge key={l} level={l} />)}</div></Section>
        <Section title="Status chip"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><StatusChip>Neutral</StatusChip><StatusChip tone="open">Open</StatusChip><StatusChip tone="ok">Resolved</StatusChip><StatusChip tone="warn">Needs attention</StatusChip><StatusChip tone="bad">Blocked</StatusChip></div></Section>
        <Section title="Buttons"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-primary">Primary</button><button className="btn">Secondary</button><button className="btn btn-danger">Danger</button><button className="btn" disabled>Disabled</button></div></Section>
        <Section title="KPI card" note="A trend always has words, never only an arrow or a colour."><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}><KpiCard label="Human-risk score" value={57} unit="/ 100" hint="Higher is safer" /><KpiCard label="Open incidents" value={3} trend={{ direction: 'down', text: '2 fewer than last week', good: true }} /><KpiCard label="Click rate" value={38} unit="%" trend={{ direction: 'up', text: '4 points higher', good: false }} /></div></Section>
        <Section title="Filter bar and data table" note="Click a header to sort. Tab to a row and press Enter."><FilterBar search={{ value: query, onChange: setQuery, placeholder: 'Search incidents' }} selects={[{ id: 's', label: 'Severity', value: severity, onChange: setSeverity, options: [{ value: 'all', label: 'All severities' }, { value: 'critical', label: 'Critical' }] }]} activeCount={query || severity !== 'all' ? 1 : 0} onClear={() => { setQuery(''); setSeverity('all'); }} /><DataTable caption="Sample incidents" columns={columns} rows={ROWS.filter(r => (severity === 'all' || r.severity === severity) && r.target.includes(query))} rowKey={r => r.id} onRowClick={r => toast.show({ message: `Opened ${r.id}`, tone: 'ok' })} /></Section>
        <Section title="Form field" note="Label above, hint below, error linked to the field."><div style={{ display: 'grid', gap: 12, maxWidth: 420 }}><Field label="Reason" hint="One or two sentences.">{c => <textarea {...c} rows={2} />}</Field><Field label="Website address" error="Enter the website address that was blocked.">{c => <input {...c} defaultValue="not a site" />}</Field></div></Section>
        <Section title="Empty, error and loading"><div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}><StateMessage variant="empty" title="No incidents here" why="New reports and detections appear in this queue." compact /><StateMessage variant="error" title="We could not load incidents" why="The service did not answer." action={{ label: 'Try again', onClick: () => toast.show({ message: 'Retrying…' }) }} lastUpdated="12:03" compact /><StateMessage variant="loading" lines={3} compact /></div></Section>
        <Section title="Dialog and toast"><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn" onClick={() => setDialog('normal')}>Open dialog</button><button className="btn btn-danger" onClick={() => setDialog('danger')}>Open delete dialog</button><button className="btn" onClick={() => toast.show({ message: 'Incident resolved', tone: 'ok', action: { label: 'Undo', onClick: () => {} } })}>Show toast</button><button className="btn" onClick={() => toast.show({ message: 'The decision was not saved.', tone: 'bad' })}>Show error toast</button></div></Section>
      </main>
      <Dialog open={dialog !== null} onClose={() => setDialog(null)} tone={dialog === 'danger' ? 'danger' : 'default'} size="sm" title={dialog === 'danger' ? 'Delete this email template?' : 'Resolve INC-2041?'} description={dialog === 'danger' ? '“Invoice overdue” will be deleted. Campaigns that already used it are not affected.' : 'It moves to Resolved and leaves the open queue.'}
        footer={<><button className="btn" onClick={() => setDialog(null)}>Cancel</button><button className={dialog === 'danger' ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => setDialog(null)}>{dialog === 'danger' ? 'Delete' : 'Resolve incident'}</button></>} />
    </div>
  );
}
