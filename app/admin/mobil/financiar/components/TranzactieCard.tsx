// ==================================================================
// CALEA: app/admin/mobil/financiar/components/TranzactieCard.tsx
// DATA: 01.05.2026 (Faza 4)
// DESCRIERE: Card mobil pentru o tranzacție bancară (încasare/plată).
// ==================================================================

'use client';

import { formatDateRO } from '../../lib/format';

export interface TranzactieMinimal {
  id: string;
  data_procesare?: unknown;
  suma?: number | string;
  directie?: string; // 'intrare' | 'iesire'
  tip_categorie?: string | null;
  nume_contrapartida?: string | null;
  cui_contrapartida?: string | null;
  detalii_tranzactie?: string | null;
  status?: string | null;
  matching_tip?: string | null;
}

export default function TranzactieCard({ tranzactie }: { tranzactie: TranzactieMinimal }) {
  const isIn = tranzactie.directie === 'intrare';
  const suma = Number(tranzactie.suma) || 0;
  const sumaAbs = Math.abs(suma);

  return (
    <article
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: 12,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: isIn ? '#dcfce7' : '#fee2e2',
          color: isIn ? '#166534' : '#b91c1c',
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isIn ? '↓' : '↑'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#0f172a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {tranzactie.nume_contrapartida || '—'}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: isIn ? '#166534' : '#b91c1c',
              flexShrink: 0,
            }}
          >
            {isIn ? '+' : '−'}
            {sumaAbs.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: '#64748b',
          }}
        >
          <span>{formatDateRO(tranzactie.data_procesare)}</span>
          {tranzactie.tip_categorie && (
            <span
              style={{
                fontSize: 11,
                background: '#f1f5f9',
                color: '#475569',
                padding: '1px 8px',
                borderRadius: 999,
                fontWeight: 500,
              }}
            >
              {tranzactie.tip_categorie}
            </span>
          )}
        </div>
        {tranzactie.detalii_tranzactie && (
          <div
            style={{
              fontSize: 11,
              color: '#94a3b8',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {tranzactie.detalii_tranzactie}
          </div>
        )}
      </div>
    </article>
  );
}
