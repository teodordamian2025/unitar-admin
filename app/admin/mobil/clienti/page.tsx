// ==================================================================
// CALEA: app/admin/mobil/clienti/page.tsx
// DATA: 01.05.2026 (Faza 3)
// DESCRIERE: Pagină listă clienți mobil — search + cards + buton "Client nou".
// FUNCȚIONALITATE: GET /api/rapoarte/clienti?search=...
// ==================================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import MobileTopBar from '../components/MobileTopBar';
import ClientCard, { ClientMinimal } from './components/ClientCard';

export default function ClientiListPage() {
  const [user] = useAuthState(auth);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [clienti, setClienti] = useState<ClientMinimal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        const res = await fetch(`/api/rapoarte/clienti?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Eroare la încărcare');
        if (!cancelled) setClienti(json.data || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Eroare necunoscută');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  return (
    <>
      <MobileTopBar title="Clienți" userId={user?.uid} />

      <div
        style={{
          position: 'sticky',
          top: 56,
          zIndex: 30,
          background: '#f8fafc',
          padding: '8px 12px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          gap: 8,
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 16,
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
          <input
            type="search"
            inputMode="search"
            placeholder="Caută nume, CUI…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
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
        <Link
          href="/admin/mobil/clienti/nou"
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            background: '#2563eb',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          + Nou
        </Link>
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

        {loading && (
          <div style={{ textAlign: 'center', padding: 20, color: '#64748b' }}>Se încarcă…</div>
        )}

        {!loading && !error && clienti.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b', fontSize: 14 }}>
            {debouncedSearch ? 'Niciun client pentru această căutare.' : 'Nu există clienți încă.'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clienti.map((c) => (
            <ClientCard key={c.id} client={c} />
          ))}
        </div>
      </div>
    </>
  );
}
