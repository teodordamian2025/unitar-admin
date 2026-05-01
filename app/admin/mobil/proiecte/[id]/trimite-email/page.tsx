// ==================================================================
// CALEA: app/admin/mobil/proiecte/[id]/trimite-email/page.tsx
// DATA: 01.05.2026 (Faza 4)
// DESCRIERE: Form mobil "Trimite email client" — slim, fără atașamente.
// FUNCȚIONALITATE: 1) Fetch proiect cu client_id (pentru pre-completare).
//                  2) Fetch contacte client (/api/rapoarte/clienti/contacte) pentru sugestii.
//                  3) POST /api/client-email/send.
// NOTĂ: NU reutilizăm SendEmailClientModal (1343 linii).
//       Slim form mobile-first care apelează același endpoint.
// ==================================================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../../../components/MobileTopBar';

interface Contact {
  id?: string;
  nume?: string;
  email?: string;
  rol?: string;
}

const ALLOWED_FROM = [
  { value: 'office@unitarproiect.eu', label: 'office@unitarproiect.eu' },
  { value: 'contact@unitarproiect.eu', label: 'contact@unitarproiect.eu' },
];

export default function TrimiteEmailPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id;
  const proiectId = decodeURIComponent(Array.isArray(idParam) ? idParam[0] : idParam || '');
  const [user] = useAuthState(auth);

  const [proiect, setProiect] = useState<any | null>(null);
  const [contacte, setContacte] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [destinatari, setDestinatari] = useState(''); // CSV input
  const [subiect, setSubiect] = useState('');
  const [continut, setContinut] = useState('');
  const [fromAddress, setFromAddress] = useState(ALLOWED_FROM[0].value);
  const [sending, setSending] = useState(false);

  // Fetch proiect
  useEffect(() => {
    if (!proiectId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ search: proiectId, limit: '20' });
        const res = await fetch(`/api/rapoarte/proiecte?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        const exact = (json.data || []).find((p: any) => p.ID_Proiect === proiectId);
        if (cancelled) return;
        if (!exact) {
          setError('Proiectul nu a fost găsit.');
        } else {
          setProiect(exact);
          // Pre-completează subiectul
          setSubiect(`Proiect ${exact.Denumire || exact.ID_Proiect}`);
          // Pre-completează cu emailul clientului direct
          if (exact.client_email) {
            setDestinatari(exact.client_email);
          }
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
  }, [proiectId]);

  // Fetch contacte client (sugestii destinatari)
  useEffect(() => {
    const clientId = proiect?.client_id;
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/rapoarte/clienti/contacte?client_id=${encodeURIComponent(clientId)}`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (cancelled) return;
        if (json?.contacte || json?.data) {
          setContacte(json.contacte || json.data || []);
        }
      } catch {
        // tăcut — contactele sunt opționale
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proiect?.client_id]);

  const suggestedEmails = useMemo(() => {
    const set = new Set<string>();
    if (proiect?.client_email) set.add(String(proiect.client_email).trim());
    for (const c of contacte) {
      if (c.email) set.add(String(c.email).trim());
    }
    return Array.from(set).filter(Boolean);
  }, [proiect, contacte]);

  const addEmailToList = (email: string) => {
    const current = destinatari
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (current.includes(email)) return;
    setDestinatari([...current, email].join(', '));
  };

  const handleSubmit = async () => {
    const emails = destinatari
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      toast.warn('Adaugă cel puțin un destinatar.');
      return;
    }
    if (!subiect.trim()) {
      toast.warn('Subiectul este obligatoriu.');
      return;
    }
    if (!continut.trim()) {
      toast.warn('Mesajul este obligatoriu.');
      return;
    }
    if (!proiect?.client_id) {
      toast.error('Proiectul nu are client asociat. Nu pot trimite email.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/client-email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proiect_id: proiectId,
          client_id: proiect.client_id,
          client_nume: proiect.client_nume || proiect.Client,
          tip_email: 'custom',
          subiect: subiect.trim(),
          continut: continut.trim(),
          destinatari: emails,
          template_folosit: 'mobil_custom',
          trimis_de: user?.uid,
          trimis_de_nume: user?.displayName || user?.email,
          from_address: fromAddress,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Eroare la trimitere');
      }
      toast.success(`Email trimis către ${json.deliveredTo?.length || emails.length} destinatar(i).`);
      router.replace(`/admin/mobil/proiecte/${encodeURIComponent(proiectId)}`);
    } catch (e: any) {
      toast.error(`Nu s-a putut trimite: ${e?.message || 'eroare'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <MobileTopBar title="Trimite email" showBack userId={user?.uid} />

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
            Se încarcă proiectul…
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

        {!loading && !error && proiect && (
          <>
            <section style={cardStyle}>
              <div style={sectionTitleStyle}>Proiect</div>
              <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600 }}>
                {proiect.Denumire || proiectId}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Client: {proiect.client_nume || proiect.Client || '—'}
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
                placeholder="email1@exemplu.ro, email2@exemplu.ro"
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              {suggestedEmails.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                    Sugestii (apasă pentru a adăuga):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {suggestedEmails.map((email) => (
                      <button
                        key={email}
                        type="button"
                        onClick={() => addEmailToList(email)}
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#475569',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {email}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                placeholder="Scrie mesajul…"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
              />
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
              {sending ? 'Se trimite…' : '✉️ Trimite email'}
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
