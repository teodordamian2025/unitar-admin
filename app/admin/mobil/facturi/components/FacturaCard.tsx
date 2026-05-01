// ==================================================================
// CALEA: app/admin/mobil/facturi/components/FacturaCard.tsx
// DATA: 01.05.2026 (Faza 5b)
// DESCRIERE: Card mobil pentru o factură.
// ==================================================================

'use client';

import Link from 'next/link';
import { formatDateRO, formatMoney, daysUntil } from '../../lib/format';

export interface FacturaMinimal {
  id: string;
  serie?: string | null;
  numar?: string | null;
  data_factura?: unknown;
  data_scadenta?: unknown;
  client_nume?: string | null;
  total?: number | string | null;
  valoare_platita?: number | string | null;
  status?: string | null;
  proiect_id?: string | null;
  proiect_denumire?: string | null;
  efactura_status?: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  achitata: { bg: '#dcfce7', fg: '#166534' },
  Achitata: { bg: '#dcfce7', fg: '#166534' },
  partial: { bg: '#fef3c7', fg: '#92400e' },
  Partial: { bg: '#fef3c7', fg: '#92400e' },
  partiala: { bg: '#fef3c7', fg: '#92400e' },
  emisa: { bg: '#dbeafe', fg: '#1e40af' },
  Emisa: { bg: '#dbeafe', fg: '#1e40af' },
  neincasata: { bg: '#fee2e2', fg: '#991b1b' },
  Neincasata: { bg: '#fee2e2', fg: '#991b1b' },
  Anulata: { bg: '#e2e8f0', fg: '#475569' },
  anulata: { bg: '#e2e8f0', fg: '#475569' },
};

function statusBadge(status: string | null | undefined) {
  if (!status) return null;
  const c = STATUS_COLORS[status] || { bg: '#e2e8f0', fg: '#334155' };
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
      {status}
    </span>
  );
}

export default function FacturaCard({ factura }: { factura: FacturaMinimal }) {
  const numar = `${factura.serie || ''}${factura.numar || ''}`.trim() || factura.id;
  const days = daysUntil(factura.data_scadenta);
  const platita = Number(factura.valoare_platita) || 0;
  const total = Number(factura.total) || 0;
  const isPaid = platita >= total - 0.01 && total > 0;
  const isOverdue =
    !isPaid && days != null && days < 0 && (factura.status || '').toLowerCase() !== 'anulata';

  return (
    <Link
      href={`/admin/mobil/facturi/${encodeURIComponent(factura.id)}`}
      style={{
        display: 'block',
        background: '#fff',
        borderRadius: 12,
        border: `1px solid ${isOverdue ? '#fecaca' : '#e2e8f0'}`,
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
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{numar}</div>
          {factura.proiect_denumire && (
            <div
              style={{
                fontSize: 12,
                color: '#64748b',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {factura.proiect_denumire}
            </div>
          )}
        </div>
        {statusBadge(factura.status)}
      </div>

      <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>
        <span style={{ color: '#64748b' }}>Client: </span>
        {factura.client_nume || '—'}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          marginTop: 6,
          gap: 8,
        }}
      >
        <span style={{ color: '#64748b' }}>
          {formatDateRO(factura.data_factura)}
          {factura.data_scadenta != null && (
            <>
              {' · scadent: '}
              <span style={{ color: isOverdue ? '#b91c1c' : '#475569', fontWeight: 500 }}>
                {formatDateRO(factura.data_scadenta)}
              </span>
            </>
          )}
        </span>
        <span style={{ color: '#0f172a', fontWeight: 700 }}>{formatMoney(total, 'RON')}</span>
      </div>
    </Link>
  );
}
