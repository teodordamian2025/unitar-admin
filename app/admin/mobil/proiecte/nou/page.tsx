// ==================================================================
// CALEA: app/admin/mobil/proiecte/nou/page.tsx
// DATA: 01.05.2026 (Faza 3)
// DESCRIERE: Wizard mobil "Proiect nou" — 3 pași.
//   Pas 1: Info (ID, Denumire, Descriere, Adresă)
//   Pas 2: Client (search clienți existenți + link "Adaugă client nou")
//   Pas 3: Valoare + Deadline (Valoare_Estimata, moneda, Data_Start, Data_Final)
// FUNCȚIONALITATE: Submit POST /api/rapoarte/proiecte → redirect la detalii.
// ==================================================================

'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../../components/MobileTopBar';
import { ClientMinimal } from '../../clienti/components/ClientCard';

interface FormData {
  ID_Proiect: string;
  Denumire: string;
  Descriere: string;
  Adresa: string;
  client: ClientMinimal | null;
  Valoare_Estimata: string;
  moneda: 'RON' | 'EUR' | 'USD';
  Data_Start: string;
  Data_Final: string;
}

const EMPTY_FORM: FormData = {
  ID_Proiect: '',
  Denumire: '',
  Descriere: '',
  Adresa: '',
  client: null,
  Valoare_Estimata: '',
  moneda: 'RON',
  Data_Start: '',
  Data_Final: '',
};

const STEP_LABELS = ['Info', 'Client', 'Valoare + Deadline'];

function suggestId(denumire: string): string {
  return denumire
    .trim()
    .replace(/\s+/g, ' ')
    .substring(0, 60);
}

function ProiectNouContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [user] = useAuthState(auth);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Pre-completează clientul dacă a venit din /clienti/nou cu ?clientId
  useEffect(() => {
    const cid = sp?.get('clientId');
    const cname = sp?.get('clientNume');
    if (cid && cname && !form.client) {
      setForm((f) => ({
        ...f,
        client: { id: cid, nume: cname },
      }));
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canGoNext = useMemo(() => {
    if (step === 1) {
      return !!form.Denumire.trim() && !!form.ID_Proiect.trim();
    }
    if (step === 2) {
      return !!form.client;
    }
    return true;
  }, [step, form]);

  const handleNext = () => {
    if (step < 3 && canGoNext) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!form.ID_Proiect.trim() || !form.Denumire.trim() || !form.client) {
      toast.warn('ID, denumire și client sunt obligatorii.');
      return;
    }
    setSubmitting(true);
    try {
      const valoareNum = form.Valoare_Estimata.trim()
        ? Number(form.Valoare_Estimata.replace(',', '.'))
        : null;
      const body: any = {
        ID_Proiect: form.ID_Proiect.trim(),
        Denumire: form.Denumire.trim(),
        Client: form.client.nume || form.client.id,
        Adresa: form.Adresa.trim() || null,
        Descriere: form.Descriere.trim() || null,
        Data_Start: form.Data_Start || null,
        Data_Final: form.Data_Final || null,
        Status: 'Activ',
        Valoare_Estimata: valoareNum,
        moneda: form.moneda,
      };
      const res = await fetch('/api/rapoarte/proiecte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Eroare la salvare');
      }
      toast.success('Proiect creat cu succes.');
      router.replace(`/admin/mobil/proiecte/${encodeURIComponent(form.ID_Proiect.trim())}`);
    } catch (e: any) {
      toast.error(`Nu s-a putut salva: ${e?.message || 'eroare'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <MobileTopBar title="Proiect nou" showBack userId={user?.uid} />

      {/* Step indicator */}
      <div
        style={{
          position: 'sticky',
          top: 56,
          zIndex: 30,
          background: '#fff',
          padding: '10px 12px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {STEP_LABELS.map((label, i) => {
          const idx = i + 1;
          const active = step === idx;
          const done = step > idx;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: done ? '#10b981' : active ? '#2563eb' : '#cbd5e1',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {done ? '✓' : idx}
              </div>
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 12,
                  color: active ? '#0f172a' : '#64748b',
                  fontWeight: active ? 600 : 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {label}
              </span>
              {idx < STEP_LABELS.length && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: done ? '#10b981' : '#e2e8f0',
                    margin: '0 8px',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        {step === 1 && (
          <Step1Info
            form={form}
            setField={setField}
            onAutoSuggestId={() =>
              !form.ID_Proiect && setField('ID_Proiect', suggestId(form.Denumire))
            }
          />
        )}
        {step === 2 && (
          <Step2Client form={form} setField={setField} />
        )}
        {step === 3 && <Step3ValoareDeadline form={form} setField={setField} />}

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              style={{
                flex: 1,
                padding: 12,
                border: '1px solid #cbd5e1',
                borderRadius: 10,
                background: '#fff',
                color: '#475569',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Înapoi
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext}
              style={{
                flex: 2,
                padding: 12,
                border: 'none',
                borderRadius: 10,
                background: canGoNext ? '#2563eb' : '#94a3b8',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: canGoNext ? 'pointer' : 'not-allowed',
              }}
            >
              Continuă →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                flex: 2,
                padding: 12,
                border: 'none',
                borderRadius: 10,
                background: submitting ? '#94a3b8' : '#10b981',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Se salvează…' : 'Creează proiect'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ===== Step 1: Info =====
function Step1Info({
  form,
  setField,
  onAutoSuggestId,
}: {
  form: FormData;
  setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
  onAutoSuggestId: () => void;
}) {
  return (
    <section style={cardStyle}>
      <div style={sectionTitleStyle}>Informații proiect</div>
      <Field label="Denumire *">
        <input
          type="text"
          value={form.Denumire}
          onChange={(e) => setField('Denumire', e.target.value)}
          onBlur={onAutoSuggestId}
          style={inputStyle}
          placeholder="ex: Renovare clădire ABC"
        />
      </Field>
      <Field label="ID Proiect *">
        <input
          type="text"
          value={form.ID_Proiect}
          onChange={(e) => setField('ID_Proiect', e.target.value)}
          style={inputStyle}
          placeholder="Identificator unic"
        />
        <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, display: 'block' }}>
          Identificator unic pentru proiect (sugestie din denumire pe blur).
        </span>
      </Field>
      <Field label="Adresă proiect">
        <input
          type="text"
          value={form.Adresa}
          onChange={(e) => setField('Adresa', e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="Descriere">
        <textarea
          value={form.Descriere}
          onChange={(e) => setField('Descriere', e.target.value)}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder="Detalii suplimentare (opțional)"
        />
      </Field>
    </section>
  );
}

// ===== Step 2: Client =====
function Step2Client({
  form,
  setField,
}: {
  form: FormData;
  setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<ClientMinimal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/rapoarte/clienti?search=${encodeURIComponent(debouncedSearch)}`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (!cancelled && json.success) setResults(json.data || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  if (form.client) {
    return (
      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Client selectat</div>
        <div
          style={{
            padding: 12,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 10,
          }}
        >
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{form.client.nume}</div>
          {form.client.cui && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontFamily: 'ui-monospace, monospace' }}>
              {form.client.cui}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setField('client', null)}
          style={{
            marginTop: 8,
            background: 'transparent',
            border: 'none',
            color: '#2563eb',
            fontSize: 13,
            cursor: 'pointer',
            padding: 4,
            fontFamily: 'inherit',
          }}
        >
          Schimbă clientul
        </button>
      </section>
    );
  }

  return (
    <section style={cardStyle}>
      <div style={sectionTitleStyle}>Alege clientul</div>
      <input
        type="search"
        placeholder="Caută client după nume, CUI…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={inputStyle}
      />

      <Link
        href={`/admin/mobil/clienti/nou?return=${encodeURIComponent('/admin/mobil/proiecte/nou')}`}
        style={{
          display: 'block',
          textAlign: 'center',
          marginTop: 8,
          padding: 10,
          border: '1px dashed #cbd5e1',
          borderRadius: 10,
          color: '#2563eb',
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        + Client nou (cu extragere ANAF)
      </Link>

      {loading && (
        <div style={{ textAlign: 'center', padding: 12, color: '#64748b', fontSize: 13 }}>
          Se caută…
        </div>
      )}

      {!loading && debouncedSearch.length >= 2 && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 16, color: '#64748b', fontSize: 13 }}>
          Niciun client găsit. Folosește butonul de mai sus pentru a adăuga unul nou.
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
            {(c.cui || c.oras) && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {[c.cui, c.oras].filter(Boolean).join(' · ')}
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

// ===== Step 3: Valoare + Deadline =====
function Step3ValoareDeadline({
  form,
  setField,
}: {
  form: FormData;
  setField: <K extends keyof FormData>(k: K, v: FormData[K]) => void;
}) {
  return (
    <>
      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Valoare estimată</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
          <Field label="Valoare">
            <input
              type="text"
              inputMode="decimal"
              value={form.Valoare_Estimata}
              onChange={(e) => setField('Valoare_Estimata', e.target.value)}
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
      </section>

      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Termene</div>
        <Field label="Data Start">
          <input
            type="date"
            value={form.Data_Start}
            onChange={(e) => setField('Data_Start', e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Data Final">
          <input
            type="date"
            value={form.Data_Final}
            onChange={(e) => setField('Data_Final', e.target.value)}
            style={inputStyle}
          />
        </Field>
      </section>

      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Recapitulare</div>
        <SummaryRow label="ID" value={form.ID_Proiect} />
        <SummaryRow label="Denumire" value={form.Denumire} />
        <SummaryRow label="Client" value={form.client?.nume || '—'} />
        <SummaryRow
          label="Valoare"
          value={
            form.Valoare_Estimata
              ? `${form.Valoare_Estimata} ${form.moneda}`
              : '—'
          }
        />
        <SummaryRow label="Termen" value={form.Data_Final || '—'} />
      </section>
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13,
        padding: '6px 0',
        borderBottom: '1px solid #f1f5f9',
      }}
    >
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span>
    </div>
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

export default function ProiectNouPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Se încarcă…</div>}>
      <ProiectNouContent />
    </Suspense>
  );
}
