// ==================================================================
// CALEA: app/admin/mobil/facturi/[id]/page.tsx
// DATA: 01.05.2026 (Faza 5b)
// DESCRIERE: Pagină detalii factură mobil — info + descărcare PDF.
// FUNCȚIONALITATE: GET /api/actions/invoices/list?search=ID, descărcare PDF
//                  via /api/actions/invoices/download-pdf?fileName=...
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { toast } from 'react-toastify';
import MobileTopBar from '../../components/MobileTopBar';
import { formatDateRO, formatMoney } from '../../lib/format';

export default function FacturaDetailPage() {
  const params = useParams();
  const idParam = params?.id;
  const facturaId = decodeURIComponent(Array.isArray(idParam) ? idParam[0] : idParam || '');
  const [user] = useAuthState(auth);

  const [factura, setFactura] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!facturaId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Folosim search ca să găsim factura după id (id-ul e parte din serie+numar la display)
        const res = await fetch(`/api/actions/invoices/list?search=${encodeURIComponent(facturaId)}&limit=10`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        // Găsim match exact pe id
        const exact = (json.facturi || []).find((f: any) => f.id === facturaId);
        if (cancelled) return;
        if (!exact) {
          setError('Factura nu a fost găsită.');
          setFactura(null);
        } else {
          setFactura(exact);
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
  }, [facturaId]);

  const handleDownloadPDF = () => {
    const url = factura?.url_download;
    if (!url) {
      toast.warn('PDF-ul nu este disponibil pentru această factură.');
      return;
    }
    // url_download poate fi calea relativă (/uploads/facturi/X.pdf) sau /api/...
    if (url.startsWith('/api/actions/invoices/download-pdf')) {
      window.open(url, '_blank');
      return;
    }
    // Extrage doar numele fișierului dacă e cale fizică
    const fileName = url.split('/').pop();
    if (fileName) {
      window.open(`/api/actions/invoices/download-pdf?fileName=${encodeURIComponent(fileName)}`, '_blank');
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <MobileTopBar
        title={
          factura ? `${factura.serie || ''}${factura.numar || ''}`.trim() || 'Factură' : 'Factură'
        }
        showBack
        userId={user?.uid}
      />

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Se încarcă factura…</div>
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
        {!loading && !error && factura && (
          <>
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>General</div>
              <Row label="Serie/Număr" value={`${factura.serie || ''}${factura.numar || ''}`} />
              <Row label="Data factură" value={formatDateRO(factura.data_factura)} />
              <Row label="Scadență" value={formatDateRO(factura.data_scadenta)} />
              <Row label="Status" value={factura.status || '—'} />
              {factura.efactura_status && (
                <Row label="e-Factura ANAF" value={factura.efactura_status} />
              )}
            </section>

            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Client</div>
              <Row label="Nume" value={factura.client_nume || '—'} />
              <Row label="CUI" value={factura.client_cui || '—'} />
            </section>

            {factura.proiect_id && (
              <section style={cardStyle}>
                <div style={sectionTitleStyle}>Proiect</div>
                <Row label="Denumire" value={factura.proiect_denumire || '—'} />
                {factura.subproiect_denumire && (
                  <Row label="Subproiect" value={factura.subproiect_denumire} />
                )}
                <Link
                  href={`/admin/mobil/proiecte/${encodeURIComponent(factura.proiect_id)}`}
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
              <div style={sectionTitleStyle}>Valori</div>
              <Row label="Subtotal" value={formatMoney(factura.subtotal, 'RON')} />
              <Row label="TVA" value={formatMoney(factura.total_tva, 'RON')} />
              <Row label="Total" value={formatMoney(factura.total, 'RON')} />
              <Row label="Plătit" value={formatMoney(factura.valoare_platita, 'RON')} />
            </section>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={!factura.url_download}
              style={{
                width: '100%',
                padding: 14,
                border: 'none',
                borderRadius: 10,
                background: factura.url_download ? '#0f172a' : '#94a3b8',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: factura.url_download ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              📄 Descarcă PDF
            </button>
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
