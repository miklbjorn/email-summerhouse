import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export function Layout({ children }: Props) {
  return (
    <div className="layout">
      <div className="header-banner">
        <svg
          viewBox="0 0 1400 120"
          preserveAspectRatio="none"
          className="header-waves"
        >
          <defs>
            <linearGradient id="wave-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1a2a1a" />
              <stop offset="50%" stopColor="#2a3a2a" />
              <stop offset="100%" stopColor="#1f2f1f" />
            </linearGradient>
            <linearGradient id="wave-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2a1f1f" />
              <stop offset="50%" stopColor="#3a2a2a" />
              <stop offset="100%" stopColor="#2f1f1f" />
            </linearGradient>
            <linearGradient id="wave-gradient-3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1f1f2a" />
              <stop offset="50%" stopColor="#2a2a3a" />
              <stop offset="100%" stopColor="#1f1f2f" />
            </linearGradient>
          </defs>
          <path
            d="M0,60 C200,100 400,20 700,60 C1000,100 1200,20 1400,60 L1400,120 L0,120 Z"
            fill="url(#wave-gradient-1)"
            opacity="0.6"
          />
          <path
            d="M0,80 C300,40 500,100 800,60 C1100,20 1300,80 1400,50 L1400,120 L0,120 Z"
            fill="url(#wave-gradient-2)"
            opacity="0.4"
          />
          <path
            d="M0,90 C150,70 350,110 600,80 C850,50 1050,100 1400,70 L1400,120 L0,120 Z"
            fill="url(#wave-gradient-3)"
            opacity="0.3"
          />
        </svg>
        <h1>Vores regninger</h1>
      </div>
      {children}
    </div>
  );
}
