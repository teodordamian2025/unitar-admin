// ==================================================================
// CALEA: app/admin/mobil/financiar/components/FinanciarChart.tsx
// DATA: 01.05.2026 (Faza 4)
// DESCRIERE: Grafic stacked-bar 12 luni — încasări/plăți/facturi emise.
// FUNCȚIONALITATE: Reuse /api/rapoarte/cashflow-monthly (creat în Faza 1).
// NOTĂ: Variantă similară cu DashboardChart, dar cu grafic stacked (încasări vs plăți)
//       pentru a vizualiza balanța financiară lunară.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface MonthlyRow {
  year_month: string;
  facturi_emise: number;
  incasari: number;
  plati: number;
}

interface ChartPoint {
  label: string;
  incasari: number;
  plati: number;
  facturi_emise: number;
  net: number;
}

const RO_MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];

function formatLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
  return `${RO_MONTHS[idx]} ${y.slice(2)}`;
}

function formatRON(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
}

export default function FinanciarChart() {
  const [data, setData] = useState<ChartPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rapoarte/cashflow-monthly', { cache: 'no-store' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        if (cancelled) return;
        const points: ChartPoint[] = (json.data as MonthlyRow[]).map((r) => ({
          label: formatLabel(r.year_month),
          incasari: Math.round(r.incasari),
          plati: Math.round(r.plati),
          facturi_emise: Math.round(r.facturi_emise),
          net: Math.round(r.incasari - r.plati),
        }));
        setData(points);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Eroare la încărcare');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 14,
        padding: 14,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        marginBottom: 12,
      }}
    >
      <header style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: '#0f172a' }}>
          Cashflow lunar (12 luni)
        </h2>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0 0' }}>
          Bare = încasări/plăți/facturi · Linie = balanța netă (încasări − plăți)
        </p>
      </header>

      <div style={{ width: '100%', height: 260 }}>
        {error ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#b91c1c',
              fontSize: 13,
              padding: 16,
              textAlign: 'center',
            }}
          >
            Nu s-au putut încărca datele: {error}
          </div>
        ) : !data ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: 13,
            }}
          >
            Se încarcă graficul…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" fontSize={10} stroke="#64748b" tickMargin={4} interval="preserveStartEnd" />
              <YAxis fontSize={10} stroke="#64748b" tickFormatter={formatRON} width={42} />
              <Tooltip
                formatter={(v: any) => `${Number(v).toLocaleString('ro-RO')} RON`}
                contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="incasari" name="Încasări" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="plati" name="Plăți" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="facturi_emise" name="Facturi emise" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="net" name="Net" stroke="#0f172a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
