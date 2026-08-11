'use client';

import React from 'react';
import Image from 'next/image';

type LogoVariant = 'hero' | 'navbar' | 'loading';

interface AnimatedLogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
}

/**
 * AFFERENT Official Logo
 * Exact High-Resolution Asset from 'ChatGPT Image 16 Jul 2026, 22.21.31.png'
 * (Background transparentized for dark mode)
 */
export default function AnimatedLogo({
  variant = 'hero',
  size = 48,
  className = '',
}: AnimatedLogoProps) {
  return (
    <span className={`afferent-logo-wrap afferent-${variant} ${className}`} style={{ width: size, height: size, display: 'inline-block' }}>
      <Image
        src="/logo/afferent-logo.png"
        alt="AFFERENT Logo"
        width={size * 2}
        height={size * 2}
        priority
        unoptimized
        className="afferent-logo-img"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <style jsx>{`
        .afferent-logo-wrap {
          display: inline-block;
          line-height: 0;
          vertical-align: middle;
        }

        /* Hero Entrance animation */
        .afferent-hero :global(.afferent-logo-img) {
          opacity: 0;
          transform: scale(0.6) rotate(-5deg);
          animation: aff-official-pop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes aff-official-pop {
          0%   { opacity: 0; transform: scale(0.6) rotate(-5deg); }
          70%  { opacity: 1; transform: scale(1.05) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        /* Navbar Idle Float */
        .afferent-navbar :global(.afferent-logo-img) {
          animation: aff-official-float 3s ease-in-out infinite;
        }
        @keyframes aff-official-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }

        /* Loading Pulse */
        .afferent-loading :global(.afferent-logo-img) {
          animation: aff-official-pulse 1.5s ease-in-out infinite;
        }
        @keyframes aff-official-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </span>
  );
}
