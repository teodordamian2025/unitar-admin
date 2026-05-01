// ==================================================================
// CALEA: app/admin/mobil/contracte/[id]/page.tsx
// DATA: 01.05.2026 (Faza 5c)
// DESCRIERE: Pagină detalii contract mobil — info + etape + facturi asociate.
// FUNCȚIONALITATE: GET /api/rapoarte/contracte?search=ID, găsește exact match.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../../components/MobileTopBar';
import { formatDateRO, formatMoney } from '../../lib/format';

export default function ContractDetailPage() {
  const params = useParams();
  const idParam = params?.id;
  const contractId = decodeURIComponent(Array.isArray(idParam) ? idParam[0] : idParam || '');
  const [user] = useAuthState(auth);

  const [contract, setContract] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/rapoarte/contracte?search=${encodeURIComponent(contractId)}&limit=20`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        const exact = (json.data || []).find((c: any) => c.ID_Contract === contractId);
        if (cancelled) return;
        if (!exact) {
          setError('Contractul nu a fost găsit.');
        } else {
          setContract(exact);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Eroare necunoscută');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  const numar = contract
    ? `${contract.serie_contract || ''}${contract.numar_contract || ''}`.trim()
    : '';

  return (
    <>
      <MobileTopBar title={numar || 'Contract'} showBack userId={user?.uid} />

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
            Se încarcă contractul…
          </div>
        )}
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        {!loading && !error && contract && (
          <>
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>General</div>
              <Row label="Număr" value={numar || contract.ID_Contract} />
              <Row label="Tip" value={contract.tip_document || '—'} />
              <Row label="Status" value={contract.Status || '—'} />
              <Row label="Data semnare" value={formatDateRO(contract.Data_Semnare)} />
              <Row label="Data expirare" value={formatDateRO(contract.Data_Expirare)} />
            </section>

            {contract.proiect_id && (
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>Proiect</div>
                <Row label="ID Proiect" value={contract.proiect_id} />
                <Row label="Client" value={contract.client_nume || '—'} />
                <Link
                  href={`/admin/mobil/proiecte/${encodeURIComponent(contract.proiect_id)}`}
                  style={{
                    display: 'block',
                    marginTop: 8,
                    fontSize: 13,
                    color: '#2563eb',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  → Deschide proiect
                </Link>
              </section>
            )}

            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Valoare</div>
              <Row label="Valoare" value={formatMoney(contract.Valoare, contract.Moneda || 'RON')} />
              {contract.curs_valutar && contract.Moneda !== 'RON' && (
                <>
                  <Row label="Curs valutar" value={contract.curs_valutar} />
                  <Row label="Echivalent RON" value={formatMoney(contract.valoare_ron, 'RON')} />
                </>
              )}
              <Row label="Status facturare" value={contract.status_facturare_filtru || '—'} />
            </section>

            {Array.isArray(contract.etape) && contract.etape.length > 0 && (
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>Etape ({contract.etape.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contract.etape.map((e: any, i: number) => (
                    <div
                      key={e.ID_Etapa || i}
                      style={{
                        padding: 10,
                        border: '1px solid #f1f5f9',
                        borderRadius: 10,
                        background: '#f8fafc',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                        {e.denumire || `Etapa ${i + 1}`}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        <span style={{ color: '#64748b' }}>
                          {e.status_facturare_filtru || '—'}
                        </span>
                        <span style={{ color: '#0f172a', fontWeight: 600 }}>
                          {formatMoney(e.valoare, e.moneda || 'RON')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {Array.isArray(contract.anexe) && contract.anexe.length > 0 && (
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>Anexe ({contract.anexe.length})</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155' }}>
                  {contract.anexe.map((a: any, i: number) => (
                    <li key={a.ID_Anexa || i} style={{ marginBottom: 4 }}>
                      {a.anexa_numar != null ? `#${a.anexa_numar} ` : ''}
                      {a.anexa_denumire || a.ID_Anexa}
                      {a.valoare && (
                        <span style={{ color: '#64748b', marginLeft: 8 }}>
                          {formatMoney(a.valoare, a.moneda || 'RON')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {contract.Observatii && (
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>Observații</div>
                <p style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {contract.Observatii}
                </p>
              </section>
            )}

            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, textAlign: 'center' }}>
              Pentru editarea sau regenerarea contractului, folosește versiunea desktop.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid #f1f5f9',
        fontSize: 14,
      }}
    >
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#0f172a', textAlign: 'right', wordBreak: 'break-word' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  padding: 14,
  marginBottom: 10,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8,
};
