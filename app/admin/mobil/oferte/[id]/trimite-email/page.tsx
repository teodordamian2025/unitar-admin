// ==================================================================
// CALEA: app/admin/mobil/oferte/[id]/trimite-email/page.tsx
// DATA: 01.05.2026 (Faza 5a)
// DESCRIERE: Form mobil "Trimite ofertă pe email" — slim, cu opțiune attach PDF.
// FUNCȚIONALITATE: POST /api/rapoarte/oferte/send-email cu attach_pdf=true default.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../../../components/MobileTopBar';

const ALLOWED_FROM = [
  { value: 'office@unitarproiect.eu', label: 'office@unitarproiect.eu' },
  { value: 'contact@unitarproiect.eu', label: 'contact@unitarproiect.eu' },
];

export default function OfertaSendEmailPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id;
  const ofertaId = decodeURIComponent(Array.isArray(idParam) ? idParam[0] : idParam || '');
  const [user] = useAuthState(auth);

  const [oferta, setOferta] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [destinatari, setDestinatari] = useState('');
  const [subiect, setSubiect] = useState('');
  const [continut, setContinut] = useState('');
  const [attachPdf, setAttachPdf] = useState(true);
  const [fromAddress, setFromAddress] = useState(ALLOWED_FROM[0].value);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!ofertaId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/rapoarte/oferte?id=${encodeURIComponent(ofertaId)}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        const item = Array.isArray(json.data) ? json.data[0] : json.data;
        if (cancelled) return;
        if (!item) {
          toast.error('Oferta nu a fost găsită.');
          return;
        }
        setOferta(item);
        if (item.client_email) setDestinatari(String(item.client_email));
        setSubiect(`Ofertă ${item.numar_oferta || ofertaId}`);
        setContinut(
          `Bună ziua,\n\nVă transmitem atașat oferta noastră ${item.numar_oferta || ''} pentru proiectul ${item.proiect_denumire || ''}.\n\nVă rugăm să nu ezitați să ne contactați pentru orice clarificare.\n\nCu stimă,\nUNITAR PROIECT`
        );
      } catch (e: any) {
        toast.error(`Nu s-a putut încărca oferta: ${e?.message || 'eroare'}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ofertaId]);

  const handleSubmit = async () => {
    const emails = destinatari
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      toast.warn('Adaugă cel puțin un destinatar.');
      return;
    }
    if (!subiect.trim() || !continut.trim()) {
      toast.warn('Subiectul și mesajul sunt obligatorii.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/rapoarte/oferte/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oferta_id: ofertaId,
          tip_email: 'oferta_mobil',
          subiect: subiect.trim(),
          continut: continut.trim(),
          destinatari: emails,
          attach_pdf: attachPdf,
          attach_docx: false,
          attach_pdf_complet: false,
          trimis_de: user?.uid,
          trimis_de_nume: user?.displayName || user?.email,
          from_address: fromAddress,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Eroare la trimitere');
      toast.success(`Ofertă trimisă către ${emails.length} destinatar(i).`);
      router.replace(`/admin/mobil/oferte/${encodeURIComponent(ofertaId)}`);
    } catch (e: any) {
      toast.error(`Nu s-a putut trimite: ${e?.message || 'eroare'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <MobileTopBar title="Trimite ofertă" showBack userId={user?.uid} />

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Se încarcă…</div>
        )}

        {!loading && oferta && (
          <>
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Ofertă</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                {oferta.numar_oferta || ofertaId}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Client: {oferta.client_nume || '—'}
              </div>
            </section>

            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Expeditor</div>
              <select
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                style={inputStyle}
              >
                {ALLOWED_FROM.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </section>

            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Destinatari (separați prin virgulă)</div>
              <textarea
                value={destinatari}
                onChange={(e) => setDestinatari(e.target.value)}
                rows={2}
                placeholder="email@exemplu.ro"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </section>

            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Subiect</div>
              <input
                type="text"
                value={subiect}
                onChange={(e) => setSubiect(e.target.value)}
                style={inputStyle}
              />
            </section>

            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Mesaj</div>
              <textarea
                value={continut}
                onChange={(e) => setContinut(e.target.value)}
                rows={8}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 140 }}
              />
            </section>

            <section style={cardStyle}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#0f172a',
                }}
              >
                <input
                  type="checkbox"
                  checked={attachPdf}
                  onChange={(e) => setAttachPdf(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                Atașează PDF cu oferta
              </label>
            </section>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending}
              style={{
                width: '100%',
                padding: 14,
                marginTop: 4,
                border: 'none',
                borderRadius: 10,
                background: sending ? '#94a3b8' : '#10b981',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {sending ? 'Se trimite…' : '✉️ Trimite ofertă pe email'}
            </button>
          </>
        )}
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
  color: '#0f172a',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

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
  marginBottom: 10,
};
