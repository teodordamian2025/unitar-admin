// ==================================================================
// CALEA: app/admin/mobil/proiecte/[id]/components/tabs/ContracteTab.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Tab "Contracte" — listă contracte + anexe pentru proiect.
// SURSĂ DATE: Câmpul `contracte[]` returnat de /api/rapoarte/proiecte.
// ==================================================================

'use client';

interface AnexaRaw {
  ID_Anexa?: string;
  anexa_numar?: number;
  anexa_denumire?: string | null;
}

interface ContractRaw {
  ID_Contract?: string;
  serie_contract?: string | null;
  numar_contract?: string | null;
  tip_document?: string | null;
  anexe?: AnexaRaw[] | null;
}

interface ContracteTabProps {
  proiect: any;
}

export default function ContracteTab({ proiect }: ContracteTabProps) {
  const contracte: ContractRaw[] = Array.isArray(proiect?.contracte) ? proiect.contracte : [];

  if (contracte.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px', color: '#64748b', fontSize: 14 }}>
        Nu există contracte pentru acest proiect.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {contracte.map((c, i) => (
        <article
          key={c.ID_Contract || i}
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
                {c.serie_contract || ''} {c.numar_contract || ''}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontFamily: 'ui-monospace, monospace' }}>
                {c.ID_Contract}
              </div>
            </div>
            {c.tip_document && (
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
                {c.tip_document}
              </span>
            )}
          </div>

          {Array.isArray(c.anexe) && c.anexe.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                Anexe ({c.anexe.length})
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155' }}>
                {c.anexe.map((a, ai) => (
                  <li key={a.ID_Anexa || ai} style={{ marginBottom: 2 }}>
                    {a.anexa_numar != null ? `#${a.anexa_numar} ` : ''}
                    {a.anexa_denumire || a.ID_Anexa}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
