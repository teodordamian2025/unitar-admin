// ==================================================================
// CALEA: app/admin/mobil/contracte/components/ContractCard.tsx
// DATA: 01.05.2026 (Faza 5c)
// DESCRIERE: Card mobil pentru un contract.
// ==================================================================

'use client';

import Link from 'next/link';
import { formatDateRO, formatMoney } from '../../lib/format';

export interface ContractMinimal {
  ID_Contract: string;
  numar_contract?: string | number | null;
  serie_contract?: string | null;
  proiect_id?: string | null;
  client_nume?: string | null;
  Valoare?: number | string | null;
  Moneda?: string | null;
  Status?: string | null;
  Data_Semnare?: unknown;
  tip_document?: string | null;
  status_facturare_filtru?: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Draft: { bg: '#f1f5f9', fg: '#475569' },
  Activ: { bg: '#dcfce7', fg: '#166534' },
  Semnat: { bg: '#dcfce7', fg: '#166534' },
  Suspendat: { bg: '#fef3c7', fg: '#92400e' },
  Finalizat: { bg: '#dbeafe', fg: '#1e40af' },
  Anulat: { bg: '#fee2e2', fg: '#991b1b' },
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

export default function ContractCard({ contract }: { contract: ContractMinimal }) {
  const numar = `${contract.serie_contract || ''}${contract.numar_contract || ''}`.trim();

  return (
    <Link
      href={`/admin/mobil/contracte/${encodeURIComponent(contract.ID_Contract)}`}
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
            {numar || contract.ID_Contract}
          </div>
          {contract.tip_document && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {contract.tip_document}
            </div>
          )}
        </div>
        {statusBadge(contract.Status)}
      </div>

      <div style={{ fontSize: 13, color: '#334155', marginBottom: 4 }}>
        <span style={{ color: '#64748b' }}>Client: </span>
        {contract.client_nume || '—'}
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
        <span style={{ color: '#64748b' }}>{formatDateRO(contract.Data_Semnare)}</span>
        <span style={{ color: '#0f172a', fontWeight: 700 }}>
          {formatMoney(contract.Valoare, contract.Moneda || 'RON')}
        </span>
      </div>
    </Link>
  );
}
