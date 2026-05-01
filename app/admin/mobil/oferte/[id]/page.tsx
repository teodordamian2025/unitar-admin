// ==================================================================
// CALEA: app/admin/mobil/oferte/[id]/page.tsx
// DATA: 01.05.2026 (Faza 5a)
// DESCRIERE: Pagină detalii ofertă mobil — info + acțiuni status + PDF + email.
// FUNCȚIONALITATE: GET /api/rapoarte/oferte?id=X, PUT /api/rapoarte/oferte/status,
//                  POST /api/actions/oferte/generate-pdf (descărcare PDF).
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../../components/MobileTopBar';
import { formatDateRO, formatMoney } from '../../lib/format';

const STATUS_OPTIONS = ['Draft', 'Trimisa', 'Negociere', 'Acceptata', 'Refuzata', 'Expirata', 'Anulata'];

export default function OfertaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id;
  const ofertaId = decodeURIComponent(Array.isArray(idParam) ? idParam[0] : idParam || '');
  const [user] = useAuthState(auth);

  const [oferta, setOferta] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const refetch = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/rapoarte/oferte?id=${encodeURIComponent(ofertaId)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Eroare');
      const item = Array.isArray(json.data) ? json.data[0] : json.data;
      if (!item) {
        setError('Oferta nu a fost găsită.');
        setOferta(null);
      } else {
        setOferta(item);
        setError(null);
      }
    } catch (e: any) {
      setError(e?.message || 'Eroare necunoscută');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ofertaId) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofertaId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!oferta || newStatus === oferta.status) return;
    setStatusBusy(true);
    try {
      const res = await fetch('/api/rapoarte/oferte/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oferta_id: ofertaId,
          status_nou: newStatus,
          schimbat_de: user?.uid,
          schimbat_de_nume: user?.displayName || user?.email,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Eroare la schimbare status');
      toast.success(`Status: ${newStatus}`);
      await refetch();
    } catch (e: any) {
      toast.error(`Nu s-a putut schimba statusul: ${e?.message || 'eroare'}`);
    } finally {
      setStatusBusy(false);
    }
  };

  const handleDownloadPDF = async () => {
    setPdfBusy(true);
    try {
      const res = await fetch('/api/actions/oferte/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oferta_id: ofertaId }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        (res.headers.get('X-Oferta-Number') || oferta?.numar_oferta || 'oferta') + '.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF descărcat.');
    } catch (e: any) {
      toast.error(`Nu s-a putut genera PDF-ul: ${e?.message || 'eroare'}`);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <>
      <MobileTopBar
        title={oferta?.numar_oferta || 'Ofertă'}
        showBack
        userId={user?.uid}
      />

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Se încarcă oferta…</div>
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
        {!loading && !error && oferta && (
          <>
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>General</div>
              <Row label="Număr" value={oferta.numar_oferta || '—'} />
              <Row label="Status" value={oferta.status || '—'} />
              <Row label="Data oferta" value={formatDateRO(oferta.data_oferta)} />
              <Row label="Data expirare" value={formatDateRO(oferta.data_expirare)} />
              <Row label="Tip" value={oferta.tip_oferta || '—'} />
            </section>

            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Client</div>
              <Row label="Nume" value={oferta.client_nume || '—'} />
              <Row label="CUI" value={oferta.client_cui || '—'} />
              <Row label="Email" value={oferta.client_email || '—'} />
              <Row label="Telefon" value={oferta.client_telefon || '—'} />
            </section>

            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Proiect</div>
              <Row label="Denumire" value={oferta.proiect_denumire || '—'} />
              <Row label="Adresă" value={oferta.proiect_adresa || '—'} />
              {oferta.proiect_descriere && (
                <p style={{ fontSize: 13, color: '#334155', marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {oferta.proiect_descriere}
                </p>
              )}
            </section>

            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Valoare</div>
              <Row label="Valoare" value={formatMoney(oferta.valoare, oferta.moneda || 'RON')} />
              {oferta.moneda && oferta.moneda !== 'RON' && (
                <>
                  <Row label="Curs valutar" value={oferta.curs_valutar ?? '—'} />
                  <Row label="Echivalent RON" value={formatMoney(oferta.valoare_ron, 'RON')} />
                </>
              )}
              {oferta.termen_executie && (
                <Row label="Termen execuție" value={oferta.termen_executie} />
              )}
            </section>

            {oferta.observatii && (
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>Observații</div>
                <p style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {oferta.observatii}
                </p>
              </section>
            )}

            {/* Acțiuni status */}
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Schimbă status</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {STATUS_OPTIONS.map((s) => {
                  const isCurrent = oferta.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={isCurrent || statusBusy}
                      onClick={() => handleStatusChange(s)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 999,
                        border: `1px solid ${isCurrent ? '#10b981' : '#cbd5e1'}`,
                        background: isCurrent ? '#10b981' : '#fff',
                        color: isCurrent ? '#fff' : '#475569',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isCurrent || statusBusy ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Acțiuni mari */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={pdfBusy}
              style={{
                ...primaryBtn,
                background: pdfBusy ? '#94a3b8' : '#0f172a',
                marginBottom: 8,
              }}
            >
              {pdfBusy ? 'Se generează PDF…' : '📄 Descarcă PDF'}
            </button>
            <Link
              href={`/admin/mobil/oferte/${encodeURIComponent(ofertaId)}/trimite-email`}
              style={{
                ...primaryBtn,
                display: 'block',
                textDecoration: 'none',
                background: '#2563eb',
                textAlign: 'center',
              }}
            >
              ✉️ Trimite ofertă pe email
            </Link>
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
        alignItems: 'flex-start',
        gap: 12,
        padding: '8px 0',
        borderBottom: '1px solid #f1f5f9',
        fontSize: 14,
      }}
    >
      <span style={{ color: '#64748b', flexShrink: 0 }}>{label}</span>
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

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: 14,
  border: 'none',
  borderRadius: 10,
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
