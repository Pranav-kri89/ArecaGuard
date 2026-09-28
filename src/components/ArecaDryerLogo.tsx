import React from 'react';

interface ArecaDryerLogoProps {
  className?: string;
  size?: number;
}

export const ArecaDryerLogo: React.FC<ArecaDryerLogoProps> = ({
  className = 'w-7 h-7',
  size = 28,
}) => {
  return (
    <div
      className={`relative rounded-lg bg-gradient-to-br from-amber-500 via-amber-600 to-emerald-700 p-0.5 shadow-md shadow-amber-950/40 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title="Areca Farm Solar Dryer AI"
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="arecaSun" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="arecaLeaf" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id="canopyRoof" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>
        </defs>

        {/* Outer solar glow disk */}
        <circle cx="16" cy="16" r="14" fill="#0f172a" fillOpacity="0.75" />

        {/* Golden Rising Sun in upper half */}
        <path
          d="M9 15 A7 7 0 0 1 23 15 Z"
          fill="url(#arecaSun)"
        />

        {/* Sun Rays */}
        <line x1="16" y1="5" x2="16" y2="7" stroke="#fef08a" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="8" x2="11.5" y2="9.5" stroke="#fef08a" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="22" y1="8" x2="20.5" y2="9.5" stroke="#fef08a" strokeWidth="1.5" strokeLinecap="round" />

        {/* Protective Smart Canopy Arc */}
        <path
          d="M6 16.5 Q16 11 26 16.5"
          stroke="url(#canopyRoof)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Arecanut Palm Leaf / Crop sprout in foreground */}
        <path
          d="M16 27 C16 22 12 18 10 17 C13 21 16 23 16 27 Z"
          fill="url(#arecaLeaf)"
        />
        <path
          d="M16 27 C16 21 20 18 22 17 C19 21 16 23 16 27 Z"
          fill="url(#arecaLeaf)"
        />
        <path
          d="M16 27 L16 16"
          stroke="#4ade80"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Solar Dryer Base Bed */}
        <line x1="7" y1="27" x2="25" y2="27" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};
