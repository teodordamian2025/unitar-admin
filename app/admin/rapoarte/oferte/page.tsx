// ==================================================================
// CALEA: app/admin/rapoarte/oferte/page.tsx
// DATA: 04.04.2026
// DESCRIERE: Pagina principala management oferte
// PATTERN: Identic cu contracte/page.tsx - glassmorphism + Z-index management
// ==================================================================

'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import ModernLayout from '@/app/components/ModernLayout';
import OferteFilters from './components/OferteFilters';
import OferteTable from './components/OferteTable';
import OfertaKPIs from './components/OfertaKPIs';

interface FilterValues {
  search: string;
  status: string;
  tip_oferta: string;
  client: string;
  data_start: string;
  data_end: string;
  valoare_min: string;
  valoare_max: string;
}

export default function OfertePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, loading] = useAuthState(auth);
  const [displayName, setDisplayName] = useState('Utilizator');
  const [userRole, setUserRole] = useState('admin');
  const [kpiData, setKpiData] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [filters, setFilters] = useState<FilterValues>({
    search: searchParams?.get('search') || '',
    status: searchParams?.get('status') || '',
    tip_oferta: searchParams?.get('tip_oferta') || '',
    client: searchParams?.get('client') || '',
    data_start: searchParams?.get('data_start') || '',
    data_end: searchParams?.get('data_end') || '',
    valoare_min: searchParams?.get('valoare_min') || '',
    valoare_max: searchParams?.get('valoare_max') || '',
  });

  const tableSearchParams = useMemo(() =>
    Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== '')
    ),
    [filters.search, filters.status, filters.tip_oferta, filters.client,
     filters.data_start, filters.data_end, filters.valoare_min, filters.valoare_max]
  );

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const newUrl = params.toString()
      ? `/admin/rapoarte/oferte?${params.toString()}`
      : '/admin/rapoarte/oferte';
    router.push(newUrl);
  };

  const handleFilterReset = () => {
    const emptyFilters: FilterValues = {
      search: '', status: '', tip_oferta: '', client: '',
      data_start: '', data_end: '', valoare_min: '', valoare_max: ''
    };
    setFilters(emptyFilters);
    router.push('/admin/rapoarte/oferte');
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setDisplayName(localStorage.getItem('displayName') || 'Utilizator');
  }, [user, loading, router]);

  if (loading || !user) {
    return <div>Se incarca...</div>;
  }

  return (
    <ModernLayout user={user} displayName={displayName} userRole={userRole}>
      <div style={{ padding: '2rem', position: 'relative' as const, zIndex: 1 }}>
        {/* Header Glassmorphism */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          position: 'relative' as const,
          zIndex: 10
        }}>
          <div>
            <h1 style={{
              margin: 0,
              color: '#2c3e50',
              fontSize: '2.5rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #8e44ad 0%, #3498db 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Management Oferte
            </h1>
            <p style={{
              margin: '0.75rem 0 0 0',
              color: '#7f8c8d',
              fontSize: '1.1rem',
              fontWeight: '500'
            }}>
              Creeaza, trimite si urmareste ofertele comerciale
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <OfertaKPIs data={kpiData} />

        {/* Filtre */}
        <div style={{
          marginBottom: '2rem',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '20px',
          padding: '2rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          position: 'relative' as const,
          zIndex: 10
        }}>
          <Suspense fallback={
            <div style={{ padding: '3rem', textAlign: 'center' as const, color: '#7f8c8d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '3px solid #8e44ad', borderTop: '3px solid transparent', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '16px', fontWeight: '500' }}>Se incarca filtrele...</span>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
          }>
            <OferteFilters
              values={filters}
              onChange={handleFilterChange}
              onReset={handleFilterReset}
            />
          </Suspense>
        </div>

        {/* Tabel */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '20px',
          overflow: 'hidden' as const,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          marginBottom: '2rem',
          position: 'relative' as const,
          zIndex: 10
        }}>
          <Suspense fallback={
            <div style={{ padding: '4rem', textAlign: 'center' as const, color: '#7f8c8d', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '4px solid #8e44ad', borderTop: '4px solid transparent', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '18px', fontWeight: '500' }}>Se incarca ofertele...</span>
            </div>
          }>
            <OferteTable
              searchParams={tableSearchParams}
              onKpiLoaded={setKpiData}
              refreshKey={refreshKey}
              onRefresh={handleRefresh}
              userId={user?.uid || ''}
              userName={displayName}
            />
          </Suspense>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(3px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          textAlign: 'center' as const,
          position: 'relative' as const,
          zIndex: 10
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#6c757d', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <strong>Tip:</strong> Creeaza o oferta noua, genereaza documentul DOCX si trimite-l pe email direct din aplicatie.
          </p>
        </div>

        {/* CSS Global - Z-index Management */}
        <style jsx global>{`
          [data-modal="true"], .modal-overlay, .modal-container, div[style*="position: fixed"]:not([data-background]) { z-index: 50000 !important; }
          [data-dropdown="true"], .dropdown-menu, .actions-dropdown, div[style*="position: absolute"][style*="background"]:not([data-background]) { z-index: 40000 !important; }
          .toast, .notification, [data-toast="true"] { z-index: 60000 !important; }
          .loading-overlay, [data-loading="true"] { z-index: 45000 !important; }
          .modal-backdrop { z-index: 49000 !important; background: rgba(0, 0, 0, 0.5) !important; backdrop-filter: blur(2px) !important; }
          .react-select__menu { z-index: 51000 !important; }
        `}</style>
      </div>
    </ModernLayout>
  );
}
