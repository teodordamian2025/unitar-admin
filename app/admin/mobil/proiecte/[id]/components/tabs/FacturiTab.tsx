// ==================================================================
// CALEA: app/admin/mobil/proiecte/[id]/components/tabs/FacturiTab.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Tab "Facturi" — listă facturi (din contracte + directe) pentru proiect.
// SURSĂ DATE: Câmpul `contracte[].facturi_contract` și `facturi_directe[]`
//             returnate de /api/rapoarte/proiecte (deja agregate în query principal).
// ==================================================================

'use client';

import { formatDateRO, formatMoney } from '../../../../lib/format';

interface FacturaRaw {
  etapa_factura_id?: string;
  factura_id?: string;
  numar_factura?: string;
  factura_serie?: string | null;
  factura_numar?: string | null;
  valoare?: number | string | null;
  moneda?: string | null;
  valoare_ron?: number | string | null;
  status_incasare?: string | null;
  data_facturare?: unknown;
  data_incasare?: unknown;
  data_factura?: unknown;
  data_scadenta?: unknown;
  factura_total?: number | string | null;
  valoare_incasata?: number | string | null;
  etapa_denumire?: string | null;
  anexa_denumire?: string | null;
}

interface FacturiTabProps {
  proiect: any;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Achitata: { bg: '#dcfce7', fg: '#166534' },
  achitata: { bg: '#dcfce7', fg: '#166534' },
  Partiala: { bg: '#fef3c7', fg: '#92400e' },
  partiala: { bg: '#fef3c7', fg: '#92400e' },
  Neincasata: { bg: '#fee2e2', fg: '#991b1b' },
  neincasata: { bg: '#fee2e2', fg: '#991b1b' },
  Anulata: { bg: '#e2e8f0', fg: '#475569' },
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

export default function FacturiTab({ proiect }: FacturiTabProps) {
  const facturi: FacturaRaw[] = [];

  // Facturi prin contracte (etape + anexe)
  if (Array.isArray(proiect?.contracte)) {
    for (const c of proiect.contracte) {
      if (Array.isArray(c?.facturi_contract)) {
        for (const f of c.facturi_contract) {
          facturi.push(f);
        }
      }
    }
  }

  // Facturi directe (fără contract)
  if (Array.isArray(proiect?.facturi_directe)) {
    for (const f of proiect.facturi_directe) {
      facturi.push(f);
    }
  }

  // Sortează descrescător după data_facturare
  facturi.sort((a, b) => {
    const da = (a.data_facturare as any)?.value || a.data_facturare || '';
    const db = (b.data_facturare as any)?.value || b.data_facturare || '';
    return String(db).localeCompare(String(da));
  });

  if (facturi.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px', color: '#64748b', fontSize: 14 }}>
        Nu există facturi pentru acest proiect.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {facturi.map((f, i) => (
        <article
          key={f.etapa_factura_id || f.factura_id || i}
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
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
                {f.numar_factura || `${f.factura_serie || ''}${f.factura_numar || ''}` || '—'}
              </div>
              {(f.etapa_denumire || f.anexa_denumire) && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {f.etapa_denumire || f.anexa_denumire}
                </div>
              )}
            </div>
            {statusBadge(f.status_incasare)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: '#64748b' }}>Emitere</span>
            <span style={{ color: '#0f172a' }}>{formatDateRO(f.data_facturare)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: '#64748b' }}>Scadență</span>
            <span style={{ color: '#0f172a' }}>{formatDateRO(f.data_scadenta)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 6,
              paddingTop: 6,
              borderTop: '1px solid #f1f5f9',
              fontSize: 14,
            }}
          >
            <span style={{ color: '#64748b', fontSize: 12 }}>Valoare</span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>
              {formatMoney(f.valoare ?? f.factura_total, f.moneda || 'RON')}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
