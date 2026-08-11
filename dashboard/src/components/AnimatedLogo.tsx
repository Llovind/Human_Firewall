"use client";

import Image from "next/image";

type LogoVariant = "hero" | "navbar" | "loading";

interface AnimatedLogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
}

// Drop the exported PNGs into /public/logo/ :
//   /public/logo/hf-logo-hero.png     (400w)
//   /public/logo/hf-logo-navbar.png   (120w)
//   /public/logo/hf-logo-loading.png  (160w)
const SRC: Record<LogoVariant, string> = {
  hero: "/logo/hf-logo-hero.png",
  navbar: "/logo/hf-logo-navbar.png",
  loading: "/logo/hf-logo-loading.png",
};

const NATIVE_RATIO = 848 / 898; // height / width from the source export

/**
 * Human Firewall animated logo — wraps the actual logo asset (not a redrawn
 * vector) so it's a guaranteed pixel-perfect match, with CSS-only motion:
 *
 * - "hero": one-shot bouncy pop-in + settle. Landing / login page.
 * - "navbar": static-looking with a very subtle idle float. Header.
 * - "loading": continuous breathing pulse + gentle rock. App boot screen.
 *
 * All animation respects prefers-reduced-motion.
 */
export default function AnimatedLogo({
  variant = "hero",
  size = 180,
  className = "",
}: AnimatedLogoProps) {
  const width = size;
  const height = Math.round(size * NATIVE_RATIO);

  return (
    <span className={`hf-logo-wrap hf-${variant} ${className}`}>
      <Image
        src={SRC[variant]}
        alt="Human Firewall"
        width={width}
        height={height}
        priority={variant === "hero" || variant === "loading"}
        className="hf-logo-img"
      />

      <style>{`
        .hf-logo-wrap { display: inline-block; line-height: 0; }
        .hf-logo-img { display: block; transform-box: fill-box; transform-origin: center; }

        /* Hero: bouncy pop-in, plays once on mount */
        .hf-hero .hf-logo-img {
          opacity: 0;
          transform: scale(0.4) rotate(-12deg);
          animation: hf-pop-in 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        @keyframes hf-pop-in {
          0%   { opacity: 0; transform: scale(0.4) rotate(-12deg); }
          60%  { opacity: 1; transform: scale(1.08) rotate(3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        /* Navbar: subtle continuous float, not distracting */
        .hf-navbar .hf-logo-img {
          animation: hf-float 2.6s ease-in-out infinite;
        }
        @keyframes hf-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-2px) rotate(1.5deg); }
        }

        /* Loading: breathing pulse + gentle rock, signals "working" */
        .hf-loading .hf-logo-img {
          animation: hf-breathe 1.4s ease-in-out infinite,
                     hf-rock 2.8s ease-in-out infinite;
        }
        @keyframes hf-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @keyframes hf-rock {
          0%, 100% { rotate: -3deg; }
          50%      { rotate: 3deg; }
        }

        @media (prefers-reduced-motion: reduce) {
          .hf-logo-img {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </span>
  );
}
