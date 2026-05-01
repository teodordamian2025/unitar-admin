// ==================================================================
// CALEA: app/admin/mobil/contracte/page.tsx
// DATA: 01.05.2026 (Faza 5c)
// DESCRIERE: Pagină listă contracte mobil — search + cards + paginare.
// FUNCȚIONALITATE: GET /api/rapoarte/contracte cu paginare offset.
// NOTĂ: Crearea contractelor noi (cu etape, articole, template DOCX) se face pe desktop.
//       Mobil oferă citire + viewing detalii + descărcare DOCX.
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../components/MobileTopBar';
import ContractCard, { ContractMinimal } from './components/ContractCard';

const PAGE_LIMIT = 30;

export default function ContracteListPage() {
  const [user] = useAuthState(auth);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [contracte, setContracte] = useState<ContractMinimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set('limit', String(PAGE_LIMIT));
        params.set('offset', String(offset));
        if (debouncedSearch) params.set('search', debouncedSearch);
        const res = await fetch(`/api/rapoarte/contracte?${params.toString()}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare');
        if (cancelled) return;
        if (offset === 0) {
          setContracte(json.data || []);
        } else {
          setContracte((prev) => [...prev, ...(json.data || [])]);
        }
        setHasMore(!!json.has_more);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Eroare necunoscută');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, offset]);

  return (
    <>
      <MobileTopBar title="Contracte" userId={user?.uid} />

      <div
        style={{
          position: 'sticky',
          top: 56,
          zIndex: 30,
          background: '#f8fafc',
          padding: '8px 12px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <input
          type="search"
          inputMode="search"
          placeholder="Caută număr contract, client, denumire…"
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
          }}
        />
      </div>

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

        {!loading && !error && contracte.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: 14 }}>
            Niciun contract pentru această căutare.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contracte.map((c) => (
            <ContractCard key={c.ID_Contract} contract={c} />
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
            onClick={() => setOffset((o) => o + PAGE_LIMIT)}
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

        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 16, textAlign: 'center' }}>
          Pentru generarea unui contract nou, deschide proiectul pe versiunea desktop.
        </p>
      </div>
    </>
  );
}
