// ==================================================================
// CALEA: app/admin/mobil/proiecte/[id]/components/tabs/InfoTab.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Tab "Info" pentru detalii proiect mobil — câmpuri de bază.
// ==================================================================

'use client';

import { ReactNode } from 'react';
import { formatDateRO, formatMoney } from '../../../../lib/format';

interface InfoTabProps {
  proiect: any;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        padding: '10px 0',
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: '4px 14px 4px 14px',
        marginBottom: 12,
      }}
    >
      <h3
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          margin: '12px 0 4px 0',
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function InfoTab({ proiect }: InfoTabProps) {
  if (!proiect) return null;
  const moneda = proiect.moneda || 'RON';
  return (
    <div>
      <Section title="General">
        <Row label="ID Proiect" value={<code>{proiect.ID_Proiect}</code>} />
        <Row label="Status" value={proiect.Status || '—'} />
        <Row label="Data Start" value={formatDateRO(proiect.Data_Start)} />
        <Row label="Data Final" value={formatDateRO(proiect.Data_Final)} />
        <Row label="Adresă" value={proiect.Adresa || '—'} />
      </Section>

      <Section title="Client">
        <Row label="Nume" value={proiect.client_nume || proiect.Client || '—'} />
        <Row label="CUI" value={proiect.client_cui || '—'} />
        <Row label="Reg. Comerț" value={proiect.client_reg_com || '—'} />
        <Row label="Telefon" value={proiect.client_telefon || '—'} />
        <Row label="Email" value={proiect.client_email || '—'} />
      </Section>

      <Section title="Valori">
        <Row label="Valoare estimată" value={formatMoney(proiect.Valoare_Estimata, moneda)} />
        <Row label="Valoare RON" value={formatMoney(proiect.valoare_ron, 'RON')} />
        <Row label="Curs valutar" value={proiect.curs_valutar ?? '—'} />
        <Row label="Progres" value={proiect.progres_procent != null ? `${proiect.progres_procent}%` : '—'} />
      </Section>

      <Section title="Status workflow">
        <Row label="Predare" value={proiect.status_predare || '—'} />
        <Row label="Contract" value={proiect.status_contract || '—'} />
        <Row label="Facturare" value={proiect.status_facturare || '—'} />
        <Row label="Achitare" value={proiect.status_achitare || '—'} />
      </Section>

      {proiect.Descriere && (
        <Section title="Descriere">
          <p style={{ fontSize: 14, color: '#0f172a', margin: '8px 0', whiteSpace: 'pre-wrap' }}>
            {proiect.Descriere}
          </p>
        </Section>
      )}

      {proiect.Observatii && (
        <Section title="Observații">
          <p style={{ fontSize: 14, color: '#0f172a', margin: '8px 0', whiteSpace: 'pre-wrap' }}>
            {proiect.Observatii}
          </p>
        </Section>
      )}
    </div>
  );
}
