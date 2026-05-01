// ==================================================================
// CALEA: app/admin/mobil/clienti/nou/page.tsx
// DATA: 01.05.2026 (Faza 3)
// DESCRIERE: Form mobil "Client nou" cu ANAF lookup direct prin /api/anaf/company-info.
// FUNCȚIONALITATE: 1) Input CUI + buton "Preia din ANAF" → completează automat câmpurile.
//                  2) Form editabil + Submit POST /api/rapoarte/clienti.
//                  3) Suport ?return=URL pentru a reveni la pagina apelantă (ex: wizard proiect).
// NOTĂ: NU reutilizăm ANAFClientSearch.tsx (511 linii cu DOM-toast desktop).
//       Pattern minim, refolosește același endpoint /api/anaf/company-info.
// ==================================================================

'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../../components/MobileTopBar';

interface FormState {
  nume: string;
  tip_client: 'Juridic' | 'Juridic_TVA' | 'Fizic';
  cui: string;
  nr_reg_com: string;
  adresa: string;
  judet: string;
  oras: string;
  cod_postal: string;
  telefon: string;
  email: string;
  banca: string;
  iban: string;
  observatii: string;
}

const EMPTY_FORM: FormState = {
  nume: '',
  tip_client: 'Juridic',
  cui: '',
  nr_reg_com: '',
  adresa: '',
  judet: '',
  oras: '',
  cod_postal: '',
  telefon: '',
  email: '',
  banca: '',
  iban: '',
  observatii: '',
};

function ClientNouContent() {
  const router = useRouter();
  const search = useSearchParams();
  const returnUrl = search?.get('return');
  const [user] = useAuthState(auth);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [anafLoading, setAnafLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleAnafLookup = async () => {
    const cui = form.cui.trim();
    if (!cui) {
      toast.warn('Introdu CUI-ul mai întâi.');
      return;
    }
    setAnafLoading(true);
    try {
      const res = await fetch(`/api/anaf/company-info?cui=${encodeURIComponent(cui)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'CUI negăsit la ANAF');
      }
      const d = json.data;
      setForm((f) => ({
        ...f,
        nume: d.denumire || f.nume,
        cui: d.cui || f.cui,
        nr_reg_com: d.nrRegCom || f.nr_reg_com,
        adresa: d.adresa || f.adresa,
        judet: d.judet || f.judet,
        oras: d.localitate || f.oras,
        cod_postal: d.codPostal || f.cod_postal,
        telefon: d.telefon || f.telefon,
        tip_client: d.platitorTva === 'Da' ? 'Juridic_TVA' : 'Juridic',
      }));
      toast.success('Date preluate din ANAF.');
    } catch (e: any) {
      toast.error(`ANAF: ${e?.message || 'eroare'}`);
    } finally {
      setAnafLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.nume.trim()) {
      toast.warn('Numele clientului este obligatoriu.');
      return;
    }
    if (
      (form.tip_client === 'Juridic' || form.tip_client === 'Juridic_TVA') &&
      !form.cui.trim()
    ) {
      toast.warn('CUI obligatoriu pentru persoană juridică.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/rapoarte/clienti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nume: form.nume.trim(),
          tip_client: form.tip_client,
          cui: form.cui.trim() || null,
          nr_reg_com: form.nr_reg_com.trim() || null,
          adresa: form.adresa.trim() || null,
          judet: form.judet.trim() || null,
          oras: form.oras.trim() || null,
          cod_postal: form.cod_postal.trim() || null,
          telefon: form.telefon.trim() || null,
          email: form.email.trim() || null,
          banca: form.banca.trim() || null,
          iban: form.iban.trim() || null,
          observatii: form.observatii.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Eroare la salvare');
      }
      toast.success('Client salvat cu succes.');

      // Returnează la pagina apelantă (ex: wizard proiect) cu clientul pre-selectat
      if (returnUrl) {
        const sep = returnUrl.includes('?') ? '&' : '?';
        const target = `${returnUrl}${sep}clientId=${encodeURIComponent(json.clientId)}&clientNume=${encodeURIComponent(form.nume.trim())}`;
        router.replace(target);
      } else {
        router.replace('/admin/mobil/clienti');
      }
    } catch (e: any) {
      toast.error(`Nu s-a putut salva: ${e?.message || 'eroare'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <MobileTopBar title="Client nou" showBack userId={user?.uid} />

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        {/* ANAF lookup */}
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Extrage date din ANAF</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="CUI (ex: RO12345678)"
              value={form.cui}
              onChange={(e) => setField('cui', e.target.value)}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={handleAnafLookup}
              disabled={anafLoading || !form.cui.trim()}
              style={{
                ...primaryBtn,
                background: anafLoading || !form.cui.trim() ? '#94a3b8' : '#2563eb',
                cursor: anafLoading || !form.cui.trim() ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              {anafLoading ? '…' : 'ANAF'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: '#64748b', margin: '6px 0 0 0' }}>
            Introdu CUI-ul și apasă „ANAF". Câmpurile de jos se completează automat.
          </p>
        </section>

        {/* Form */}
        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Date de bază</div>
          <Field label="Tip client *">
            <select
              value={form.tip_client}
              onChange={(e) => setField('tip_client', e.target.value as FormState['tip_client'])}
              style={inputStyle}
            >
              <option value="Juridic">Juridic (fără TVA)</option>
              <option value="Juridic_TVA">Juridic (plătitor TVA)</option>
              <option value="Fizic">Persoană fizică</option>
            </select>
          </Field>
          <Field label="Denumire / Nume *">
            <input
              type="text"
              value={form.nume}
              onChange={(e) => setField('nume', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Nr. Reg. Comerț">
            <input
              type="text"
              value={form.nr_reg_com}
              onChange={(e) => setField('nr_reg_com', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </section>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Adresă</div>
          <Field label="Adresă">
            <input
              type="text"
              value={form.adresa}
              onChange={(e) => setField('adresa', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Județ">
              <input
                type="text"
                value={form.judet}
                onChange={(e) => setField('judet', e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Localitate">
              <input
                type="text"
                value={form.oras}
                onChange={(e) => setField('oras', e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Cod poștal">
            <input
              type="text"
              inputMode="numeric"
              value={form.cod_postal}
              onChange={(e) => setField('cod_postal', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </section>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Contact</div>
          <Field label="Telefon">
            <input
              type="tel"
              inputMode="tel"
              value={form.telefon}
              onChange={(e) => setField('telefon', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              inputMode="email"
              autoCapitalize="off"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </section>

        <section style={cardStyle}>
          <div style={sectionTitleStyle}>Bancă (opțional)</div>
          <Field label="Banca">
            <input
              type="text"
              value={form.banca}
              onChange={(e) => setField('banca', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="IBAN">
            <input
              type="text"
              value={form.iban}
              onChange={(e) => setField('iban', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </section>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            ...primaryBtn,
            width: '100%',
            padding: 14,
            fontSize: 15,
            background: submitting ? '#94a3b8' : '#10b981',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Se salvează…' : 'Salvează clientul'}
        </button>
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

const primaryBtn: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'inherit',
};

export default function ClientNouPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Se încarcă…</div>}>
      <ClientNouContent />
    </Suspense>
  );
}
