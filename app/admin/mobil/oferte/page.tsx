// ==================================================================
// CALEA: app/admin/mobil/oferte/page.tsx
// DATA: 01.05.2026 (Faza 5a)
// DESCRIERE: Pagină listă oferte mobil — search + filter status + KPI + cards.
// FUNCȚIONALITATE: GET /api/rapoarte/oferte cu paginare + KPI agregat.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../components/MobileTopBar';
import OfertaCard, { OfertaMinimal } from './components/OfertaCard';

const STATUS_OPTIONS = ['Toate', 'Draft', 'Trimisa', 'Acceptata', 'Refuzata', 'Negociere', 'Expirata'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

interface KPI {
  total?: number;
  acceptate?: number;
  in_asteptare?: number;
  valoare_pipeline?: number | string;
  valoare_totala_acceptate?: number | string;
}

const PAGE_LIMIT = 30;

export default function OferteListPage() {
  const [user] = useAuthState(auth);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('Toate');
  const [oferte, setOferte] = useState<OfertaMinimal[]>([]);
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('per_page', String(PAGE_LIMIT));
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (status !== 'Toate') params.set('status', status);
        const res = await fetch(`/api/rapoarte/oferte?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare la încărcare');
        if (cancelled) return;
        if (page === 1) {
          setOferte(json.data || []);
        } else {
          setOferte((prev) => [...prev, ...(json.data || [])]);
        }
        setKpi(json.kpi || null);
        const total = json?.pagination?.total || 0;
        const loadedSoFar = (page - 1) * PAGE_LIMIT + (json.data?.length || 0);
        setHasMore(loadedSoFar < total);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Eroare necunoscută');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, status, page]);

  return (
    <>
      <MobileTopBar title="Oferte" userId={user?.uid} />

      {/* KPI compact */}
      {kpi && (
        <div
          style={{
            padding: '12px 12px 0 12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
            maxWidth: 640,
            margin: '0 auto',
          }}
        >
          <KpiPill label="În așteptare" value={kpi.in_asteptare ?? 0} accent="blue" />
          <KpiPill label="Acceptate" value={kpi.acceptate ?? 0} accent="green" />
        </div>
      )}

      {/* Search bar */}
      <div
        style={{
          position: 'sticky',
          top: 56,
          zIndex: 30,
          background: '#f8fafc',
          padding: '8px 12px',
          borderBottom: '1px solid #e2e8f0',
          marginTop: kpi ? 12 : 0,
        }}
      >
        <input
          type="search"
          inputMode="search"
          placeholder="Caută număr, client…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            fontSize: 14,
            outline: 'none',
            background: '#fff',
            color: '#0f172a',
            boxSizing: 'border-box',
            marginBottom: 8,
          }}
        />
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {STATUS_OPTIONS.map((opt) => {
            const active = status === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setStatus(opt)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: `1px solid ${active ? '#2563eb' : '#cbd5e1'}`,
                  background: active ? '#2563eb' : '#fff',
                  color: active ? '#fff' : '#475569',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* FAB Ofertă nouă */}
      <Link
        href="/admin/mobil/oferte/nou"
        aria-label="Ofertă nouă"
        style={{
          position: 'fixed',
          right: 'calc(16px + 56px + 12px)',
          bottom: 80,
          zIndex: 40,
          width: 52,
          height: 52,
          borderRadius: 26,
          background: '#2563eb',
          color: '#fff',
          fontSize: 24,
          fontWeight: 700,
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.35)',
        }}
      >
        +
      </Link>

      <div style={{ padding: 12, maxWidth: 640, margin: '0 auto' }}>
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}
        {!loading && !error && oferte.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: 14 }}>
            Nicio ofertă pentru filtrele alese.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {oferte.map((o) => (
            <OfertaCard key={o.id} oferta={o} />
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 16, color: '#64748b', fontSize: 13 }}>
            Se încarcă…
          </div>
        )}
        {!loading && hasMore && (
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 12,
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              background: '#fff',
              color: '#475569',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Încarcă mai multe
          </button>
        )}
      </div>
    </>
  );
}

function KpiPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: 'blue' | 'green';
}) {
  const c =
    accent === 'blue'
      ? { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' }
      : { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' };
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: '8px 12px',
      }}
    >
      <div style={{ fontSize: 11, color: c.fg, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: c.fg }}>{value}</div>
    </div>
  );
}
