// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/page.tsx
// MODIFICAT: Glassmorphism Premium Layout + Z-index Management + Enhanced UX + TypeScript Fix
// ==================================================================

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProiectFilters from './components/ProiectFilters';
import ProiecteTable from './components/ProiecteTable';
import ProiectNouModal from './components/ProiectNouModal';

interface FilterValues {
  search: string;
  status: string;
  client: string;
  data_start_start: string;
  data_start_end: string;
  valoare_min: string;
  valoare_max: string;
}

export default function ProiectePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showProiectModal, setShowProiectModal] = useState(false);
  
  // Inițializează filtrele din URL
  const [filters, setFilters] = useState<FilterValues>({
    search: searchParams?.get('search') || '',
    status: searchParams?.get('status') || '',
    client: searchParams?.get('client') || '',
    data_start_start: searchParams?.get('data_start_start') || '',
    data_start_end: searchParams?.get('data_start_end') || '',
    valoare_min: searchParams?.get('valoare_min') || '',
    valoare_max: searchParams?.get('valoare_max') || ''
  });

  // Convertește filtrele în searchParams pentru ProiecteTable
  const tableSearchParams = Object.fromEntries(
    Object.entries(filters).filter(([_, value]) => value !== '')
  );

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    
    // Actualizează URL-ul cu noile filtre
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    
    const newUrl = params.toString() 
      ? `/admin/rapoarte/proiecte?${params.toString()}`
      : '/admin/rapoarte/proiecte';
    
    router.push(newUrl);
  };

  const handleFilterReset = () => {
    const emptyFilters: FilterValues = {
      search: '',
      status: '',
      client: '',
      data_start_start: '',
      data_start_end: '',
      valoare_min: '',
      valoare_max: ''
    };
    
    setFilters(emptyFilters);
    router.push('/admin/rapoarte/proiecte');
  };

  const handleProiectAdded = () => {
    // Trigger refresh în ProiecteTable prin schimbarea unui parametru
    window.location.reload();
  };

  return (
    <div style={{ 
      padding: '2rem',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative' as const
    }}>
      {/* ✅ Background Pattern Glassmorphism */}
      <div style={{
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.2) 0%, transparent 50%)
        `,
        pointerEvents: 'none' as const,
        zIndex: 1
      }} />

      <div style={{ position: 'relative' as const, zIndex: 2 }}>
        {/* ✅ Header Glassmorphism Premium */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              color: '#2c3e50',
              fontSize: '2.5rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #2c3e50 0%, #4a6741 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              📋 Management Proiecte
            </h1>
            <p style={{ 
              margin: '0.75rem 0 0 0', 
              color: '#7f8c8d',
              fontSize: '1.1rem',
              fontWeight: '500'
            }}>
              Gestionează și monitorizează toate proiectele din portofoliu
            </p>
          </div>
          
          {/* ✅ Butonul Proiect Nou - Glassmorphism Premium */}
          <button
            onClick={() => setShowProiectModal(true)}
            style={{
              padding: '1rem 2rem',
              background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '700',
              boxShadow: '0 8px 24px rgba(39, 174, 96, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative' as const,
              overflow: 'hidden' as const
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(39, 174, 96, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(39, 174, 96, 0.4)';
            }}
          >
            <span style={{ position: 'relative' as const, zIndex: 1 }}>+ Proiect Nou</span>
            <div style={{
              position: 'absolute' as const,
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
              transition: 'left 0.5s ease'
            }} />
          </button>
        </div>

        {/* ✅ Filtre Glassmorphism */}
        <div style={{ 
          marginBottom: '2rem',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '20px',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          <Suspense fallback={
            <div style={{ 
              padding: '3rem', 
              textAlign: 'center' as const,
              color: '#7f8c8d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: '3px solid #3498db',
                borderTop: '3px solid transparent',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '16px', fontWeight: '500' }}>⏳ Se încarcă filtrele...</span>
              <style>
                {`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}
              </style>
            </div>
          }>
            <ProiectFilters 
              values={filters}
              onChange={handleFilterChange}
              onReset={handleFilterReset}
            />
          </Suspense>
        </div>

        {/* ✅ Tabel Glassmorphism */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '20px',
          overflow: 'hidden' as const,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem'
        }}>
          <Suspense fallback={
            <div style={{ 
              padding: '4rem', 
              textAlign: 'center' as const,
              color: '#7f8c8d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '4px solid #3498db',
                borderTop: '4px solid transparent',
                animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '18px', fontWeight: '500' }}>⏳ Se încarcă proiectele...</span>
            </div>
          }>
            <ProiecteTable 
              searchParams={tableSearchParams}
            />
          </Suspense>
        </div>

        {/* ✅ Footer Info Glassmorphism */}
        <div style={{ 
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          textAlign: 'center' as const
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '14px', 
            color: '#6c757d',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}>
            💡 <strong>Tip:</strong> Folosește filtrele pentru a găsi rapid proiectele dorite. 
            Click pe "Acțiuni" pentru a gestiona fiecare proiect individual.
          </p>
        </div>

        {/* ✅ Modal Proiect Nou cu Z-index Management */}
        {showProiectModal && (
          <div style={{ zIndex: 11000 }}>
            <ProiectNouModal
              isOpen={showProiectModal}
              onClose={() => setShowProiectModal(false)}
              onProiectAdded={handleProiectAdded}
            />
          </div>
        )}
      </div>
    </div>
  );
}
