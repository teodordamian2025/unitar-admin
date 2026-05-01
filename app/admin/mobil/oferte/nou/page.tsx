// ==================================================================
// CALEA: app/admin/mobil/oferte/nou/page.tsx
// DATA: 01.05.2026 (Faza 5a)
// DESCRIERE: Form mobil "Ofertă nouă" — fast path, doar câmpurile esențiale.
// FUNCȚIONALITATE: POST /api/rapoarte/oferte cu payload minim.
//                  Pentru oferte complexe (multiple linii, cu produse) → desktop.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../../components/MobileTopBar';
import { ClientMinimal } from '../../clienti/components/ClientCard';

interface FormData {
  client: ClientMinimal | null;
  proiect_denumire: string;
  proiect_descriere: string;
  proiect_adresa: string;
  valoare: string;
  moneda: 'RON' | 'EUR' | 'USD';
  data_expirare: string;
  observatii: string;
}

const EMPTY: FormData = {
  client: null,
  proiect_denumire: '',
  proiect_descriere: '',
  proiect_adresa: '',
  valoare: '',
  moneda: 'RON',
  data_expirare: '',
  observatii: '',
};

export default function OfertaNouaPage() {
  const router = useRouter();
  const [user] = useAuthState(auth);

  const [form, setForm] = useState<FormData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  // Search clienți
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<ClientMinimal[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (form.client) return; // nu mai căutăm dacă e selectat
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setSearching(true);
        const res = await fetch(
          `/api/rapoarte/clienti?search=${encodeURIComponent(debouncedSearch)}`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (!cancelled && json.success) setResults(json.data || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, form.client]);

  const setField = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.client) {
      toast.warn('Selectează clientul.');
      return;
    }
    if (!form.proiect_denumire.trim()) {
      toast.warn('Denumirea proiectului/ofertei este obligatorie.');
      return;
    }
    if (!form.valoare.trim()) {
      toast.warn('Valoarea este obligatorie.');
      return;
    }
    setSubmitting(true);
    try {
      const valoareNum = Number(form.valoare.replace(',', '.'));
      const body = {
        client_nume: form.client.nume,
        client_cui: form.client.cui || null,
        client_email: (form.client as any).email || null,
        client_telefon: (form.client as any).telefon || null,
        proiect_denumire: form.proiect_denumire.trim(),
        proiect_descriere: form.proiect_descriere.trim() || null,
        proiect_adresa: form.proiect_adresa.trim() || null,
        valoare: valoareNum,
        moneda: form.moneda,
        data_expirare: form.data_expirare || null,
        observatii: form.observatii.trim() || null,
        creat_de: user?.uid,
        creat_de_nume: user?.displayName || user?.email,
      };
      const res = await fetch('/api/rapoarte/oferte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Eroare la salvare');
      toast.success('Ofertă creată cu succes.');
      const newId = json?.data?.id;
      if (newId) {
        router.replace(`/admin/mobil/oferte/${encodeURIComponent(newId)}`);
      } else {
        router.replace('/admin/mobil/oferte');
      }
    } catch (e: any) {
      toast.error(`Nu s-a putut salva: ${e?.message || 'eroare'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <MobileTopBar title="Ofertă nouă" showBack userId={user?.uid} />

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Client</div>
          {form.client ? (
            <div
              style={{
                padding: 10,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 10,
              }}
            >
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{form.client.nume}</div>
              {form.client.cui && (
                <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>
                  {form.client.cui}
                </div>
              )}
              <button
                type="button"
                onClick={() => setField('client', null)}
                style={{
                  marginTop: 6,
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                Schimbă
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                placeholder="Caută client după nume, CUI…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={inputStyle}
              />
              {searching && (
                <div style={{ fontSize: 12, color: '#64748b', padding: 8, textAlign: 'center' }}>
                  Se caută…
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setField('client', c)}
                    style={{
                      textAlign: 'left',
                      padding: 10,
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      background: '#fff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{c.nume}</div>
                    {c.cui && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>{c.cui}</div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Proiect / Subiect ofertă</div>
          <Field label="Denumire *">
            <input
              type="text"
              value={form.proiect_denumire}
              onChange={(e) => setField('proiect_denumire', e.target.value)}
              style={inputStyle}
              placeholder="ex: Renovare clădire ABC"
            />
          </Field>
          <Field label="Adresă proiect">
            <input
              type="text"
              value={form.proiect_adresa}
              onChange={(e) => setField('proiect_adresa', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Descriere">
            <textarea
              value={form.proiect_descriere}
              onChange={(e) => setField('proiect_descriere', e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        </section>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Valoare</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
            <Field label="Valoare *">
              <input
                type="text"
                inputMode="decimal"
                value={form.valoare}
                onChange={(e) => setField('valoare', e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </Field>
            <Field label="Monedă">
              <select
                value={form.moneda}
                onChange={(e) => setField('moneda', e.target.value as FormData['moneda'])}
                style={inputStyle}
              >
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>
          <Field label="Data expirare">
            <input
              type="date"
              value={form.data_expirare}
              onChange={(e) => setField('data_expirare', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </section>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Observații</div>
          <textarea
            value={form.observatii}
            onChange={(e) => setField('observatii', e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </section>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%',
            padding: 14,
            border: 'none',
            borderRadius: 10,
            background: submitting ? '#94a3b8' : '#10b981',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? 'Se salvează…' : 'Creează ofertă'}
        </button>

        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, textAlign: 'center' }}>
          Pentru oferte cu mai multe linii sau produse detaliate, folosește versiunea desktop.
        </p>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
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
