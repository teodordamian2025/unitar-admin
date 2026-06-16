// ==================================================================
// CALEA: app/admin/mobil/financiar/page.tsx
// DATA: 01.05.2026 (Faza 4)
// DESCRIERE: Pagină financiară mobilă — grafic 12 luni + listă tranzacții bancare cu filtre.
// FUNCȚIONALITATE: Reuse /api/rapoarte/cashflow-monthly + /api/tranzactii/dashboard.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../components/MobileTopBar';
import FinanciarChart from './components/FinanciarChart';
import TranzactieCard, { TranzactieMinimal } from './components/TranzactieCard';

type DirectieFilter = 'toate' | 'intrare' | 'iesire';

const DIR_OPTIONS: { value: DirectieFilter; label: string }[] = [
  { value: 'toate', label: 'Toate' },
  { value: 'intrare', label: 'Încasări' },
  { value: 'iesire', label: 'Plăți' },
];

const PAGE_LIMIT = 25;

export default function FinanciarPage() {
  const [user] = useAuthState(auth);
  const [directie, setDirectie] = useState<DirectieFilter>('toate');
  const [tranzactii, setTranzactii] = useState<TranzactieMinimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<{ sumaIncasari?: number; sumaPlati?: number } | null>(null);
  const [sold, setSold] = useState<{
    total: number;
    currency: string;
    cacheAgeMinutes?: number;
    stale?: boolean;
  } | null>(null);
  const [soldLoading, setSoldLoading] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [directie]);

  // Sold disponibil — reutilizează endpoint-ul de pe /admin (cache 6h, fără force_refresh)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setSoldLoading(true);
        const res = await fetch('/api/tranzactii/smartfintech/balance');
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.balance) {
          setSold({
            total: json.balance.total,
            currency: json.balance.currency || 'RON',
            cacheAgeMinutes: json.balance.cacheAgeMinutes,
            stale: json.balance.stale,
          });
        } else {
          setSold(null);
        }
      } catch {
        if (!cancelled) setSold(null);
      } finally {
        if (!cancelled) setSoldLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set('data', 'all');
        params.set('limit', String(PAGE_LIMIT));
        params.set('page', String(page));
        if (directie !== 'toate') params.set('directie', directie);
        const res = await fetch(`/api/tranzactii/dashboard?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        if (cancelled) return;
        const txs: TranzactieMinimal[] = json.transactions || [];
        if (page === 1) {
          setTranzactii(txs);
        } else {
          setTranzactii((prev) => [...prev, ...txs]);
        }
        setStats({
          sumaIncasari: json?.stats?.sumaIncasari,
          sumaPlati: json?.stats?.sumaPlati,
        });
        const total = json?.pagination?.total || json?.totalCount || 0;
        const loadedSoFar = (page - 1) * PAGE_LIMIT + txs.length;
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
  }, [directie, page]);

  return (
    <>
      <MobileTopBar title="Financiar" userId={user?.uid} />

      <div style={{ padding: 12, maxWidth: 720, margin: '0 auto' }}>
        <SoldCard sold={sold} loading={soldLoading} />

        <FinanciarChart />

        {/* Quick stats */}
        {stats && (stats.sumaIncasari != null || stats.sumaPlati != null) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <StatCard label="Total încasări" value={stats.sumaIncasari} accent="green" icon="↓" />
            <StatCard label="Total plăți" value={stats.sumaPlati} accent="red" icon="↑" />
          </div>
        )}

        {/* Filtre directie */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 10,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {DIR_OPTIONS.map((opt) => {
            const active = directie === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDirectie(opt.value)}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1px solid ${active ? '#2563eb' : '#cbd5e1'}`,
                  background: active ? '#2563eb' : '#fff',
                  color: active ? '#fff' : '#475569',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

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

        {!loading && !error && tranzactii.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: 14 }}>
            Nicio tranzacție pentru filtrele alese.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tranzactii.map((t) => (
            <TranzactieCard key={t.id} tranzactie={t} />
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
            }}
          >
            Încarcă mai multe
          </button>
        )}
      </div>
    </>
  );
}

function SoldCard({
  sold,
  loading,
}: {
  sold: { total: number; currency: string; cacheAgeMinutes?: number; stale?: boolean } | null;
  loading: boolean;
}) {
  const ageLabel =
    sold?.cacheAgeMinutes != null
      ? sold.cacheAgeMinutes < 60
        ? `acum ${sold.cacheAgeMinutes} min`
        : `acum ${Math.floor(sold.cacheAgeMinutes / 60)} h`
      : null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        color: '#fff',
        boxShadow: '0 2px 8px rgba(30, 58, 138, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.18)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
          }}
        >
          🏦
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
          Sold disponibil
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
        {loading
          ? '…'
          : sold != null
            ? new Intl.NumberFormat('ro-RO', {
                style: 'currency',
                currency: sold.currency || 'RON',
                maximumFractionDigits: 2,
              }).format(sold.total)
            : 'N/A'}
      </div>
      {!loading && sold != null && ageLabel && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
          Actualizat {ageLabel}
          {sold.stale ? ' • necesită reîmprospătare' : ''}
        </div>
      )}
      {!loading && sold == null && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
          Indisponibil momentan
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number | undefined | null;
  accent: 'green' | 'red';
  icon: string;
}) {
  const colors =
    accent === 'green'
      ? { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' }
      : { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' };
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: colors.bg,
            color: colors.fg,
            border: `1px solid ${colors.border}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
        {value != null
          ? `${Number(value).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} RON`
          : '—'}
      </div>
    </div>
  );
}
