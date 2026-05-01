// ==================================================================
// CALEA: app/admin/mobil/proiecte/[id]/components/ActiuniSheet.tsx
// DATA: 01.05.2026 (Faza 4 — email + comentariu activate)
// DESCRIERE: Bottom sheet cu acțiuni rapide pentru proiect.
// STARE: Faza 4 — Trimite email și Adaugă comentariu sunt active.
//        Restul acțiunilor (contract / factură / PV / încasare) urmează în Faza 5.
// ==================================================================

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ActiuniSheetProps {
  open: boolean;
  onClose: () => void;
  proiectId: string;
  /** Callback pentru a comuta la tabul Comentarii și a închide sheet-ul. */
  onAddComment?: () => void;
}

interface ActionItem {
  icon: string;
  label: string;
  description: string;
  available: boolean;
  onClick?: () => void;
}

export default function ActiuniSheet({ open, onClose, proiectId, onAddComment }: ActiuniSheetProps) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const actions: ActionItem[] = [
    {
      icon: '✉️',
      label: 'Trimite email client',
      description: 'Email rapid către client',
      available: true,
      onClick: () => {
        onClose();
        router.push(`/admin/mobil/proiecte/${encodeURIComponent(proiectId)}/trimite-email`);
      },
    },
    {
      icon: '💬',
      label: 'Adaugă comentariu',
      description: 'Deschide tabul Comentarii',
      available: !!onAddComment,
      onClick: () => {
        onClose();
        onAddComment?.();
      },
    },
    { icon: '📄', label: 'Generează contract', description: 'Wizard contract (Faza 5)', available: false },
    { icon: '🧾', label: 'Generează factură', description: 'Wizard factură (Faza 5)', available: false },
    { icon: '📋', label: 'Generează PV', description: 'Proces verbal (Faza 5)', available: false },
    { icon: '💰', label: 'Înregistrează încasare', description: 'În curând (Faza 5)', available: false },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          zIndex: 60,
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 70,
          background: '#fff',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: '12px 12px calc(env(safe-area-inset-bottom, 0px) + 16px) 12px',
          maxHeight: '80dvh',
          overflowY: 'auto',
          boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.12)',
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: '#cbd5e1',
            margin: '4px auto 12px auto',
          }}
        />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 4px 12px 4px' }}>
          Acțiuni proiect
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={!a.available}
              onClick={() => {
                if (a.available) a.onClick?.();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: 12,
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                background: a.available ? '#fff' : '#f8fafc',
                color: a.available ? '#0f172a' : '#94a3b8',
                fontSize: 14,
                cursor: a.available ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{a.icon}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{a.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>
                  {a.description}
                </span>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 12,
            padding: 12,
            background: '#0f172a',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Închide
        </button>
      </div>
    </>
  );
}
