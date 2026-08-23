'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

export interface TrendBadgeProps {
  type?: 'up' | 'down' | 'neutral' | 'success' | 'danger' | 'warning' | 'info';
  value: string | number;
  prefix?: string;
  suffix?: string;
  iconType?: 'arrow' | 'trend' | 'none';
  className?: string;
  style?: React.CSSProperties;
}

export function TrendBadge({
  type = 'neutral',
  value,
  prefix = '',
  suffix = '',
  iconType = 'arrow',
  className = '',
  style = {},
}: TrendBadgeProps) {
  let bg = 'var(--bg-neutral)';
  let color = 'var(--text-neutral)';
  let border = 'var(--border-neutral)';
  let IconComponent: React.ReactNode = null;

  if (type === 'up' || type === 'success') {
    bg = 'var(--bg-success)';
    color = 'var(--text-success)';
    border = 'var(--border-success)';
    if (iconType === 'arrow') {
      IconComponent = <ArrowUpRight style={{ width: '13px', height: '13px', strokeWidth: 2.4, flexShrink: 0 }} />;
    } else if (iconType === 'trend') {
      IconComponent = <TrendingUp style={{ width: '13px', height: '13px', strokeWidth: 2.4, flexShrink: 0 }} />;
    }
  } else if (type === 'down' || type === 'danger') {
    bg = 'var(--bg-danger)';
    color = 'var(--text-danger)';
    border = 'var(--border-danger)';
    if (iconType === 'arrow') {
      IconComponent = <ArrowDownRight style={{ width: '13px', height: '13px', strokeWidth: 2.4, flexShrink: 0 }} />;
    } else if (iconType === 'trend') {
      IconComponent = <TrendingDown style={{ width: '13px', height: '13px', strokeWidth: 2.4, flexShrink: 0 }} />;
    }
  } else if (type === 'warning') {
    bg = 'var(--bg-warning)';
    color = 'var(--text-warning)';
    border = 'var(--border-warning)';
    if (iconType === 'arrow') {
      IconComponent = <ArrowRight style={{ width: '13px', height: '13px', strokeWidth: 2.4, flexShrink: 0 }} />;
    }
  } else if (type === 'info') {
    bg = 'rgba(33, 150, 243, 0.12)';
    color = 'var(--accent)';
    border = 'var(--border)';
    if (iconType === 'arrow') {
      IconComponent = <ArrowRight style={{ width: '13px', height: '13px', strokeWidth: 2.4, flexShrink: 0 }} />;
    }
  } else {
    if (iconType === 'arrow') {
      IconComponent = <ArrowRight style={{ width: '13px', height: '13px', strokeWidth: 2.4, flexShrink: 0 }} />;
    }
  }

  return (
    <span
      className={`tremor-badge font-mono-data ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.2px',
        lineHeight: 1.2,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        ...style,
      }}
    >
      {IconComponent}
      <span>{prefix}{value}{suffix}</span>
    </span>
  );
}

export default TrendBadge;
