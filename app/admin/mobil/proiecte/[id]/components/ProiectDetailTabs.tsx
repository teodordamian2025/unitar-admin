// ==================================================================
// CALEA: app/admin/mobil/proiecte/[id]/components/ProiectDetailTabs.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Tab switcher horizontal scrollable pentru detalii proiect mobil.
// ==================================================================

'use client';

export type DetailTabKey = 'info' | 'etape' | 'facturi' | 'contracte' | 'comentarii';

interface DetailTabsProps {
  active: DetailTabKey;
  onChange: (k: DetailTabKey) => void;
  counts?: Partial<Record<DetailTabKey, number>>;
}

const TABS: { key: DetailTabKey; label: string }[] = [
  { key: 'info', label: 'Info' },
  { key: 'etape', label: 'Etape' },
  { key: 'facturi', label: 'Facturi' },
  { key: 'contracte', label: 'Contracte' },
  { key: 'comentarii', label: 'Comentarii' },
];

export default function ProiectDetailTabs({ active, onChange, counts }: DetailTabsProps) {
  return (
    <div
      role="tablist"
      style={{
        position: 'sticky',
        top: 56,
        zIndex: 30,
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '0 8px',
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.key;
        const count = counts?.[t.key];
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            type="button"
            style={{
              flexShrink: 0,
              padding: '12px 14px',
              border: 'none',
              background: 'transparent',
              borderBottom: `2px solid ${isActive ? '#2563eb' : 'transparent'}`,
              color: isActive ? '#1e40af' : '#64748b',
              fontWeight: isActive ? 600 : 500,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {count != null && count > 0 && (
              <span
                style={{
                  fontSize: 11,
                  background: isActive ? '#dbeafe' : '#f1f5f9',
                  color: isActive ? '#1e40af' : '#475569',
                  borderRadius: 999,
                  padding: '0 6px',
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
