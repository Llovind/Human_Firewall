'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useI18n } from '@/i18n/I18nProvider';

export interface DonutDataItem {
  name: string;
  value: number;
  color: string;
  borderColor?: string;
  share?: string;
}

export interface TremorDonutCardProps {
  title: string;
  description?: string;
  data: DonutDataItem[];
  totalLabel?: string;
  unit?: string;
  className?: string;
}

/** A donut with a legend that carries the numbers, so no value is shown by colour alone. */
export function TremorDonutCard({ title, description, data, totalLabel, unit, className = '' }: TremorDonutCardProps) {
  const { t } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const share = (value: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : '0%');

  return (
    <section className={`exec-card ${className}`.trim()} aria-label={title}>
      <div>
        <h3>{title}</h3>
        {description && <p className="emp-muted">{description}</p>}
      </div>
      {total === 0 ? <p className="emp-muted">{t('ov.donut.empty')}</p> : (
        <div className="donut-row">
          <div className="donut-chart" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="var(--bg-surface)" onMouseEnter={(_, index) => setActive(index)} onMouseLeave={() => setActive(null)} isAnimationActive={false}>
                  {data.map((item, index) => <Cell key={item.name} fill={item.color} opacity={active === null || active === index ? 1 : 0.5} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center"><b>{total}</b><small>{totalLabel ?? t('ov.sev.total')}</small></div>
          </div>
          <ul className="donut-legend">
            {data.map(item => (
              <li key={item.name}>
                <i style={{ background: item.color }} aria-hidden="true" />
                <span>{item.name}</span>
                <b>{item.value}{unit ? ` ${unit}` : ''}</b>
                <small>{share(item.value)}</small>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default TremorDonutCard;
