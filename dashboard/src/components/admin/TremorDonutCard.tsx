'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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

export function TremorDonutCard({
  title,
  description,
  data,
  totalLabel = 'Total',
  unit = 'tiket',
  className = '',
}: TremorDonutCardProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  // Calculate percentage shares
  const processedData = data.map(item => ({
    ...item,
    share: totalValue > 0 ? `${((item.value / totalValue) * 100).toFixed(1)}%` : '0%',
  }));

  return (
    <div
      className={`chart-card glass-card ${className}`}
      style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid rgba(13, 71, 161, 0.12)',
        padding: '24px',
        boxShadow: '0 4px 20px -2px rgba(13, 71, 161, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#091b38', margin: 0 }}>
            {title}
          </h3>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#0D47A1',
            background: 'rgba(33, 150, 243, 0.12)',
            padding: '2px 8px',
            borderRadius: '12px',
            border: '1px solid rgba(144, 202, 249, 0.4)'
          }}>
            {totalValue} {unit}
          </span>
        </div>
        {description && (
          <p style={{ fontSize: '12px', color: '#526f99', margin: '4px 0 0 0', lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>

      {/* 2-Column Responsive Layout (Donut Left, Legend Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1fr) minmax(180px, 1.2fr)',
        gap: '20px',
        alignItems: 'center',
      }}>
        {/* Left Column: Donut Chart with Center Metric */}
        <div style={{ position: 'relative', width: '100%', height: '190px' }}>
          {totalValue > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={processedData}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="92%"
                  paddingAngle={4}
                  dataKey="value"
                  isAnimationActive={true}
                  animationDuration={300}
                  animationEasing="ease-out"
                  onMouseEnter={(_, idx) => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {processedData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke="#ffffff"
                      strokeWidth={2}
                      style={{
                        opacity: activeIndex === null || activeIndex === index ? 1 : 0.4,
                        transition: 'opacity 0.2s ease, transform 0.2s ease',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as DonutDataItem & { share: string };
                      return (
                        <div style={{
                          background: '#091b38',
                          color: '#ffffff',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                          fontWeight: 600
                        }}>
                          <span style={{ color: item.color, marginRight: '6px' }}>●</span>
                          {item.name}: <strong>{item.value} {unit}</strong> ({item.share})
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#526f99', fontSize: '12px' }}>
              Belum ada data
            </div>
          )}

          {/* Center metric inside donut */}
          {totalValue > 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#091b38', display: 'block', lineHeight: 1 }}>
                {activeIndex !== null ? processedData[activeIndex]?.value : totalValue}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 600, color: '#526f99', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px', display: 'block' }}>
                {activeIndex !== null ? processedData[activeIndex]?.name : totalLabel}
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Tremor Style Legend List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {processedData.map((item, idx) => {
            const isHovered = activeIndex === idx;
            return (
              <div
                key={item.name}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: isHovered ? '#edf5fd' : 'transparent',
                  transition: 'background 0.15s ease',
                  cursor: 'pointer',
                }}
              >
                {/* Vertical Color Strip Indicator */}
                <span
                  style={{
                    width: '4px',
                    height: '28px',
                    borderRadius: '3px',
                    backgroundColor: item.color,
                    border: item.borderColor ? `1px solid ${item.borderColor}` : 'none',
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '6px' }}>
                    <p style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#091b38',
                      margin: 0,
                    }}>
                      {item.value} <span style={{ fontSize: '11px', fontWeight: 500, color: '#526f99' }}>{unit}</span>
                    </p>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#233b63' }}>
                      ({item.share})
                    </span>
                  </div>
                  <p style={{
                    fontSize: '11px',
                    color: '#526f99',
                    margin: '1px 0 0 0',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {item.name}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TremorDonutCard;
