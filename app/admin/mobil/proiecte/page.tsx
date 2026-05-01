// ==================================================================
// CALEA: app/admin/mobil/proiecte/page.tsx
// DATA: 01.05.2026 (Faza 2)
// DESCRIERE: Pagină listă proiecte mobil — search + filtre status + cards.
// FUNCȚIONALITATE: Folosește /api/rapoarte/proiecte (GET) cu paginare + search.
// ==================================================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../components/MobileTopBar';
import ProiectCard, { ProiectMinimal } from './components/ProiectCard';
import ProiectSearchBar, { StatusFilter } from './components/ProiectSearchBar';

const PAGE_LIMIT = 30;

export default function ProiecteListPage() {
  const [user] = useAuthState(auth);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('Toate');
  const [proiecte, setProiecte] = useState<ProiectMinimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page când se schimbă filtrele
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
        params.set('limit', String(PAGE_LIMIT));
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (status !== 'Toate') params.set('status', status);

        const res = await fetch(`/api/rapoarte/proiecte?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare la încărcare');
        if (cancelled) return;

        if (page === 1) {
          setProiecte(json.data || []);
        } else {
          setProiecte((prev) => [...prev, ...(json.data || [])]);
        }
        const total = json.pagination?.total || 0;
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

  const isEmpty = !loading && !error && proiecte.length === 0;

  return (
    <>
      <MobileTopBar title="Proiecte" userId={user?.uid} />

      <ProiectSearchBar
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
      />

      {/* FAB Proiect nou */}
      <Link
        href="/admin/mobil/proiecte/nou"
        aria-label="Proiect nou"
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

        {isEmpty && (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              color: '#64748b',
              fontSize: 14,
            }}
          >
            Nu s-au găsit proiecte pentru filtrele alese.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {proiecte.map((p) => (
            <ProiectCard key={p.ID_Proiect} proiect={p} />
          ))}
        </div>

        {loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '20px 0',
              color: '#64748b',
              fontSize: 13,
            }}
          >
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
