// ==================================================================
// CALEA: app/admin/mobil/proiecte/components/ProiectCard.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Card mobil pentru un proiect — status, denumire, client, valoare, deadline.
// ==================================================================

'use client';

import Link from 'next/link';
import { formatDateRO, formatMoney, daysUntil } from '../../lib/format';

export interface ProiectMinimal {
  ID_Proiect: string;
  Denumire?: string | null;
  Client?: string | null;
  client_nume?: string | null;
  Status?: string | null;
  Data_Final?: unknown;
  Valoare_Estimata?: number | string | null;
  valoare_ron?: number | string | null;
  moneda?: string | null;
  status_predare?: string | null;
  status_contract?: string | null;
  status_facturare?: string | null;
  status_achitare?: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Activ: { bg: '#dcfce7', fg: '#166534' },
  Suspendat: { bg: '#fef3c7', fg: '#92400e' },
  Finalizat: { bg: '#dbeafe', fg: '#1e40af' },
  Anulat: { bg: '#fee2e2', fg: '#991b1b' },
  Arhivat: { bg: '#e2e8f0', fg: '#475569' },
};

function statusBadge(status: string | null | undefined) {
  const key = status || 'Activ';
  const c = STATUS_COLORS[key] || { bg: '#e2e8f0', fg: '#334155' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {key}
    </span>
  );
}

function deadlineColor(days: number | null): string {
  if (days == null) return '#64748b';
  if (days < 0) return '#b91c1c';
  if (days <= 7) return '#c2410c';
  if (days <= 30) return '#a16207';
  return '#475569';
}

export default function ProiectCard({ proiect }: { proiect: ProiectMinimal }) {
  const clientName = proiect.client_nume || proiect.Client || '—';
  const valoare = proiect.Valoare_Estimata ?? proiect.valoare_ron;
  const moneda = proiect.moneda || 'RON';
  const days = daysUntil(proiect.Data_Final);
  const deadlineLabel =
    days == null
      ? formatDateRO(proiect.Data_Final)
      : days < 0
      ? `Depășit cu ${-days} zile`
      : days === 0
      ? 'Astăzi'
      : `În ${days} zile`;

  return (
    <Link
      href={`/admin/mobil/proiecte/${encodeURIComponent(proiect.ID_Proiect)}`}
      style={{
        display: 'block',
        background: '#ffffff',
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
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#0f172a',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.3,
            }}
          >
            {proiect.Denumire || proiect.ID_Proiect}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#64748b',
              marginTop: 2,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {proiect.ID_Proiect}
          </div>
        </div>
        {statusBadge(proiect.Status)}
      </div>

      <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>
        <span style={{ color: '#64748b' }}>Client: </span>
        {clientName}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          marginTop: 8,
          gap: 8,
        }}
      >
        <span style={{ color: '#0f172a', fontWeight: 600 }}>{formatMoney(valoare, moneda)}</span>
        <span style={{ color: deadlineColor(days), fontWeight: 500 }}>
          {deadlineLabel}
        </span>
      </div>
    </Link>
  );
}
