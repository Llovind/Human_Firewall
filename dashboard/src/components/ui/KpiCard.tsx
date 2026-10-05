import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  /** A trend always has words ("up 6 in 30 days"), not only an arrow or a colour. */
  trend?: { direction: 'up' | 'down' | 'flat'; text: string; good?: boolean };
  hint?: string;
  href?: string;
}

export default function KpiCard({ label, value, unit, trend, hint, href }: KpiCardProps) {
  const TrendIcon = trend?.direction === 'up' ? ArrowUpRight : trend?.direction === 'down' ? ArrowDownRight : ArrowRight;
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}{unit && <small>{unit}</small>}</span>
      {trend && <span className="kpi-trend" data-good={trend.good === undefined ? undefined : String(trend.good)}><TrendIcon size={14} aria-hidden="true" />{trend.text}</span>}
      {hint && <span className="kpi-hint">{hint}</span>}
    </>
  );
  return href ? <a className="kpi" href={href}>{body}</a> : <div className="kpi">{body}</div>;
}
