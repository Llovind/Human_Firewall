import React from 'react';

interface LogoProps {
  size?: number;
  variant?: 'full' | 'mark';
  className?: string;
}

export function Logo({ size = 32, variant = 'full', className = '' }: LogoProps) {
  return (
    <div 
      className={`logo-container ${className}`} 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '12px',
        userSelect: 'none'
      }}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        {/* Shield Outer Path */}
        <path 
          className="logo-shield"
          d="M50 6 L90 22 L90 55 C90 78 50 94 50 94 C50 94 10 78 10 55 L10 22 Z" 
          stroke="var(--accent)" 
          strokeWidth="6" 
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="rgba(245, 158, 11, 0.05)"
        />
        
        {/* Circuit lines inside the shield */}
        <path 
          className="logo-circuit logo-circuit-1"
          d="M50 28 L50 48 L32 48 L32 64" 
          stroke="var(--accent)" 
          strokeWidth="4" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          className="logo-circuit logo-circuit-2"
          d="M50 48 L68 48 L68 64" 
          stroke="var(--accent)" 
          strokeWidth="4" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path 
          className="logo-circuit logo-circuit-3"
          d="M50 48 L50 78" 
          stroke="var(--accent)" 
          strokeWidth="4" 
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Circuit Nodes (Dots) */}
        <circle className="logo-node logo-node-1" cx="50" cy="28" r="5" fill="var(--accent-bright)" />
        <circle className="logo-node logo-node-2" cx="32" cy="64" r="5" fill="var(--accent-bright)" />
        <circle className="logo-node logo-node-3" cx="68" cy="64" r="5" fill="var(--accent-bright)" />
        <circle className="logo-node logo-node-4" cx="50" cy="78" r="5" fill="var(--accent-bright)" />
      </svg>

      {variant === 'full' && (
        <span 
          className="logo-text"
          style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: `${size * 0.55}px`, 
            fontWeight: 700, 
            letterSpacing: '-0.5px',
            color: 'var(--text-primary)'
          }}
        >
          Human <span style={{ color: 'var(--accent)' }}>Firewall</span>
        </span>
      )}
    </div>
  );
}
export default Logo;
