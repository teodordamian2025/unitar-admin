// ==================================================================
// CALEA: app/admin/mobil/components/KPICard.tsx
// DATA: 01.05.2026 (Faza 1)
// DESCRIERE: Card KPI pentru dashboard mobil (icon + valoare + etichetă + meta).
// ==================================================================

'use client';

import { ReactNode } from 'react';

interface KPICardProps {
  icon: string;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  accent?: 'blue' | 'green' | 'orange' | 'red' | 'slate';
  href?: string;
  onClick?: () => void;
}

const ACCENTS: Record<NonNullable<KPICardProps['accent']>, { bg: string; fg: string; border: string }> = {
  blue: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  green: { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
  orange: { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' },
  red: { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
  slate: { bg: '#f8fafc', fg: '#334155', border: '#e2e8f0' },
};

export default function KPICard({
  icon,
  label,
  value,
  meta,
  accent = 'slate',
  href,
  onClick,
}: KPICardProps) {
  const colors = ACCENTS[accent];

  const inner = (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 22,
            width: 36,
            height: 36,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            background: colors.bg,
            color: colors.fg,
            border: `1px solid ${colors.border}`,
          }}
        >
          {icon}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{value}</div>
      {meta != null && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{meta}</div>}
    </>
  );

  const baseStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 14,
    padding: 14,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    textAlign: 'left',
    color: '#0f172a',
    display: 'block',
    width: '100%',
  };

  if (href) {
    return (
      <a href={href} style={{ ...baseStyle, textDecoration: 'none' }}>
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} style={{ ...baseStyle, cursor: 'pointer', font: 'inherit' }}>
        {inner}
      </button>
    );
  }
  return <div style={baseStyle}>{inner}</div>;
}
