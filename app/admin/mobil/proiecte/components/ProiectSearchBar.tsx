// ==================================================================
// CALEA: app/admin/mobil/proiecte/components/ProiectSearchBar.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Search bar + chips filtre status pentru lista de proiecte.
// ==================================================================

'use client';

import { ChangeEvent } from 'react';

const STATUS_OPTIONS = ['Toate', 'Activ', 'Suspendat', 'Finalizat', 'Arhivat'] as const;
export type StatusFilter = (typeof STATUS_OPTIONS)[number];

interface ProiectSearchBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
}

export default function ProiectSearchBar({
  search,
  onSearchChange,
  status,
  onStatusChange,
}: ProiectSearchBarProps) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 56, // height MobileTopBar
        zIndex: 30,
        background: '#f8fafc',
        padding: '8px 12px 8px 12px',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <div
        style={{
          position: 'relative',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 16,
            color: '#94a3b8',
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          type="search"
          inputMode="search"
          placeholder="Caută denumire, ID, client, CUI…"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px 10px 36px',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            fontSize: 14,
            outline: 'none',
            background: '#fff',
            color: '#0f172a',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {STATUS_OPTIONS.map((opt) => {
          const active = status === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onStatusChange(opt)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 999,
                border: `1px solid ${active ? '#2563eb' : '#cbd5e1'}`,
                background: active ? '#2563eb' : '#fff',
                color: active ? '#fff' : '#475569',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
