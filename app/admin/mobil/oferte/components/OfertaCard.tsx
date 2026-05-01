// ==================================================================
// CALEA: app/admin/mobil/oferte/components/OfertaCard.tsx
// DATA: 01.05.2026 (Faza 5a)
// DESCRIERE: Card mobil pentru o ofertă — număr, client, valoare, status, expirare.
// ==================================================================

'use client';

import Link from 'next/link';
import { formatDateRO, formatMoney, daysUntil } from '../../lib/format';

export interface OfertaMinimal {
  id: string;
  numar_oferta?: string | null;
  client_nume?: string | null;
  proiect_denumire?: string | null;
  valoare?: number | string | null;
  moneda?: string | null;
  valoare_ron?: number | string | null;
  status?: string | null;
  data_oferta?: unknown;
  data_expirare?: unknown;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Draft: { bg: '#f1f5f9', fg: '#475569' },
  Trimisa: { bg: '#dbeafe', fg: '#1e40af' },
  Negociere: { bg: '#fef3c7', fg: '#92400e' },
  Acceptata: { bg: '#dcfce7', fg: '#166534' },
  Refuzata: { bg: '#fee2e2', fg: '#991b1b' },
  Expirata: { bg: '#e2e8f0', fg: '#64748b' },
  Anulata: { bg: '#e2e8f0', fg: '#64748b' },
};

function statusBadge(status: string | null | undefined) {
  const key = status || 'Draft';
  const c = STATUS_COLORS[key] || { bg: '#e2e8f0', fg: '#334155' };
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontWeight: 600,
      }}
    >
      {key}
    </span>
  );
}

export default function OfertaCard({ oferta }: { oferta: OfertaMinimal }) {
  const days = daysUntil(oferta.data_expirare);
  const expirareLabel =
    days == null
      ? null
      : days < 0
      ? `Expirată acum ${-days} zile`
      : days <= 7
      ? `Expiră în ${days} zile`
      : null;

  return (
    <Link
      href={`/admin/mobil/oferte/${encodeURIComponent(oferta.id)}`}
      style={{
        display: 'block',
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: 12,
        textDecoration: 'none',
        color: 'inherit',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
            {oferta.numar_oferta || oferta.id}
          </div>
          {oferta.proiect_denumire && (
            <div
              style={{
                fontSize: 12,
                color: '#64748b',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {oferta.proiect_denumire}
            </div>
          )}
        </div>
        {statusBadge(oferta.status)}
      </div>

      <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>
        <span style={{ color: '#64748b' }}>Client: </span>
        {oferta.client_nume || '—'}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8,
          fontSize: 12,
          gap: 8,
        }}
      >
        <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 14 }}>
          {formatMoney(oferta.valoare, oferta.moneda || 'RON')}
        </span>
        {expirareLabel ? (
          <span style={{ color: days != null && days < 0 ? '#b91c1c' : '#c2410c' }}>
            {expirareLabel}
          </span>
        ) : (
          <span style={{ color: '#64748b' }}>{formatDateRO(oferta.data_oferta)}</span>
        )}
      </div>
    </Link>
  );
}
