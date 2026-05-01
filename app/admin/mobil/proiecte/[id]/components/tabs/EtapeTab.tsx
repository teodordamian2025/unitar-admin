// ==================================================================
// CALEA: app/admin/mobil/proiecte/[id]/components/tabs/EtapeTab.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Tab "Etape" — listă subproiecte + etape din contracte.
// FUNCȚIONALITATE: Folosește /api/rapoarte/subproiecte cu proiect_id.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import { formatDateRO, formatMoney } from '../../../../lib/format';

interface EtapeTabProps {
  proiectId: string;
}

interface Subproiect {
  ID_Subproiect?: string;
  ID_Proiect?: string;
  Denumire?: string | null;
  Status?: string | null;
  Data_Start?: unknown;
  Data_Final?: unknown;
  Valoare_Estimata?: number | string | null;
  moneda?: string | null;
}

export default function EtapeTab({ proiectId }: EtapeTabProps) {
  const [subproiecte, setSubproiecte] = useState<Subproiect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ proiect_id: proiectId, limit: '100' });
        const res = await fetch(`/api/rapoarte/subproiecte?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        if (!cancelled) setSubproiecte(json.data || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Eroare necunoscută');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proiectId]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Se încarcă etapele…</div>;
  }
  if (error) {
    return <div style={{ color: '#b91c1c', fontSize: 13, padding: 12 }}>{error}</div>;
  }
  if (subproiecte.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px', color: '#64748b', fontSize: 14 }}>
        Acest proiect nu are subproiecte/etape.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {subproiecte.map((s, i) => (
        <article
          key={s.ID_Subproiect || `${s.ID_Proiect}-${i}`}
          style={{
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', flex: 1, minWidth: 0 }}>
              {s.Denumire || s.ID_Subproiect}
            </div>
            {s.Status && (
              <span
                style={{
                  fontSize: 11,
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                {s.Status}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
            {formatDateRO(s.Data_Start)} → {formatDateRO(s.Data_Final)}
          </div>
          <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
            {formatMoney(s.Valoare_Estimata, s.moneda || 'RON')}
          </div>
        </article>
      ))}
    </div>
  );
}
