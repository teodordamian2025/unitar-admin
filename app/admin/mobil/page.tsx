// ==================================================================
// CALEA: app/admin/mobil/page.tsx
// DATA: 01.05.2026 (Faza 1 - dashboard real)
// DESCRIERE: Dashboard mobil cu KPI grid + grafic cashflow lunar.
// FUNCȚIONALITATE: Apelează /api/rapoarte/dashboard pentru KPI și
//                  /api/rapoarte/cashflow-monthly pentru grafic.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from './components/MobileTopBar';
import KPICard from './components/KPICard';
import DashboardChart from './components/DashboardChart';

interface DashboardStats {
  proiecte?: { total?: number; active?: number; finalizate?: number; suspendate?: number };
  clienti?: { total?: number };
  contracte?: { total?: number; active?: number };
  facturi?: {
    total?: number;
    valoare_de_incasat?: number;
    valoare_incasata?: number;
    facturePerMoneda?: Record<string, { neplatite: number; subtotal: number }>;
  };
}

function formatRON(v: number | undefined | null): string {
  if (v == null) return '—';
  return `${Number(v).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} RON`;
}

export default function AdminMobilPage() {
  const [user] = useAuthState(auth);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rapoarte/dashboard', { cache: 'no-store' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare la încărcare');
        if (!cancelled) setStats(json.data || {});
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Eroare necunoscută');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <MobileTopBar title="UNITAR Mobil" userId={user?.uid} />

      <div style={{ padding: '12px 12px 0 12px', maxWidth: 640, margin: '0 auto' }}>
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: 12,
              borderRadius: 12,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <KPICard
            icon="📋"
            label="Proiecte active"
            value={stats?.proiecte?.active ?? '—'}
            meta={stats?.proiecte?.total != null ? `din ${stats.proiecte.total} total` : undefined}
            accent="blue"
            href="/admin/mobil/proiecte"
          />
          <KPICard
            icon="👥"
            label="Clienți"
            value={stats?.clienti?.total ?? '—'}
            accent="slate"
            href="/admin/mobil/clienti"
          />
          <KPICard
            icon="💰"
            label="De încasat"
            value={formatRON(stats?.facturi?.valoare_de_incasat)}
            meta={
              stats?.facturi?.total != null
                ? `${stats.facturi.total} facturi neplătite`
                : undefined
            }
            accent="orange"
            href="/admin/mobil/financiar"
          />
          <KPICard
            icon="✅"
            label="Încasat"
            value={formatRON(stats?.facturi?.valoare_incasata)}
            accent="green"
            href="/admin/mobil/financiar"
          />
        </div>

        <DashboardChart />

        <div style={{ height: 12 }} />
      </div>
    </>
  );
}
