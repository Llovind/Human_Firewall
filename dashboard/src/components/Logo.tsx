import React from 'react';
import AnimatedLogo from './AnimatedLogo';

interface LogoProps {
  size?: number;
  variant?: 'full' | 'mark';
  className?: string;
  logoAnimation?: 'hero' | 'navbar' | 'loading';
}

export function Logo({
  size = 32,
  variant = 'full',
  className = '',
  logoAnimation
}: LogoProps) {
  // Determine animation variant:
  // - Admin login / auth (size >= 80) -> 'hero' (pop-in animation)
  // - Other uses -> 'navbar' (subtle float animation)
  const animVariant = logoAnimation || (size >= 80 ? 'hero' : 'navbar');

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
      <AnimatedLogo variant={animVariant} size={size} />

      {variant === 'full' && (
        <span
          className="logo-text font-heading"
          style={{
            fontSize: `${size * 0.55}px`,
            fontWeight: 600,
            letterSpacing: '-0.3px',
            color: 'var(--text-primary)'
          }}
        >
          Afferent <span style={{ color: 'var(--accent)', fontWeight: 700 }}>Platform</span>
        </span>
      )}
    </div>
  );
}

export default Logo;
