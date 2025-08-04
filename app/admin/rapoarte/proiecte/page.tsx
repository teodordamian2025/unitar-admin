// ==================================================================
// CALEA: app/admin/rapoarte/proiecte/page.tsx
// MODIFICAT: Adăugat navigație către Facturi în header + păstrează toate funcționalitățile
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
      position: 'relative' as const,
      // ✅ Z-index de bază redus pentru a face loc modalelor
      zIndex: 1
    }}>
      {/* ✅ Background Pattern Glassmorphism - Opacity redusă */}
      <div style={{
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.1) 0%, transparent 50%)
        `,
        pointerEvents: 'none' as const,
        // ✅ Z-index foarte jos pentru background
        zIndex: 0
      }} />

      <div style={{ 
        position: 'relative' as const, 
        // ✅ Z-index moderat pentru conținut
        zIndex: 1
      }}>
        {/* ✅ NOU: Navigație rapidă */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '1.5rem',
          padding: '1rem',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
          position: 'relative' as const,
          zIndex: 15
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#2c3e50',
              marginRight: '0.5rem'
            }}>
              🚀 Navigație rapidă:
            </span>
            
            <button
              onClick={() => router.push('/admin')}
              style={{
                padding: '0.5rem 1rem',
                background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(52, 152, 219, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(52, 152, 219, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(52, 152, 219, 0.3)';
              }}
            >
              🏠 Dashboard
            </button>

            <button
              style={{
                padding: '0.5rem 1rem',
                background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'default',
                fontSize: '12px',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(39, 174, 96, 0.4)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              📋 Proiecte
              <span style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'rgba(255, 255, 255, 0.8)'
              }}></span>
            </button>

            <button
              onClick={() => router.push('/admin/rapoarte/clienti')}
              style={{
                padding: '0.5rem 1rem',
                background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(155, 89, 182, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(155, 89, 182, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(155, 89, 182, 0.3)';
              }}
            >
              👥 Clienți
            </button>

            <button
              onClick={() => router.push('/admin/rapoarte/facturi')}
              style={{
                padding: '0.5rem 1rem',
                background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(231, 76, 60, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.3)';
              }}
            >
              💰 Facturi
            </button>

            <button
              onClick={() => window.open('/admin/actions/contracts/generate', '_blank')}
              style={{
                padding: '0.5rem 1rem',
                background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                boxShadow: '0 2px 8px rgba(243, 156, 18, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(243, 156, 18, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(243, 156, 18, 0.3)';
              }}
            >
              📄 Contracte
            </button>
          </div>
        </div>

        {/* ✅ Header Glassmorphism Premium - Backdrop redus */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.85)',
          // ✅ Backdrop-filter redus pentru a nu concura cu modalele
          backdropFilter: 'blur(8px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          // ✅ Z-index specific pentru header
          position: 'relative' as const,
          zIndex: 10
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
          
          {/* ✅ Butonul Proiect Nou - Z-index optimizat */}
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
              boxShadow: '0 4px 12px rgba(39, 174, 96, 0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative' as const,
              overflow: 'hidden' as const,
              // ✅ Z-index pentru buton
              zIndex: 11
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(39, 174, 96, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.3)';
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

        {/* ✅ Filtre Glassmorphism - Backdrop redus */}
        <div style={{ 
          marginBottom: '2rem',
          background: 'rgba(255, 255, 255, 0.85)',
          // ✅ Backdrop-filter redus
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '20px',
          padding: '2rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          // ✅ Z-index pentru filtre
          position: 'relative' as const,
          zIndex: 10
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

        {/* ✅ Tabel Glassmorphism - Backdrop redus */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.85)',
          // ✅ Backdrop-filter redus
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '20px',
          overflow: 'hidden' as const,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          marginBottom: '2rem',
          // ✅ Z-index pentru tabel
          position: 'relative' as const,
          zIndex: 10
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

        {/* ✅ Footer Info Glassmorphism - Backdrop redus */}
        <div style={{ 
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.75)',
          // ✅ Backdrop-filter redus
          backdropFilter: 'blur(6px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          textAlign: 'center' as const,
          // ✅ Z-index pentru footer
          position: 'relative' as const,
          zIndex: 10
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

        {/* ✅ Modal Proiect Nou cu Z-index Management Universal */}
        {showProiectModal && (
          <div style={{ 
            // ✅ Z-index foarte înalt pentru toate modalele
            zIndex: 50000,
            position: 'relative' as const
          }}>
            <ProiectNouModal
              isOpen={showProiectModal}
              onClose={() => setShowProiectModal(false)}
              onProiectAdded={handleProiectAdded}
            />
          </div>
        )}
      </div>

      {/* ✅ CSS Global pentru Z-index Management Universal */}
      <style jsx global>{`
        /* Z-index Management Universal pentru toate modalele și dropdown-urile */
        
        /* Modalele principale (FacturaHibridModal, ProiectNouModal, etc.) */
        [data-modal="true"],
        .modal-overlay,
        .modal-container,
        div[style*="position: fixed"]:not([data-background]) {
          z-index: 50000 !important;
        }
        
        /* Dropdown-uri și meniuri contextuale */
        [data-dropdown="true"],
        .dropdown-menu,
        .actions-dropdown,
        div[style*="position: absolute"][style*="background"]:not([data-background]) {
          z-index: 40000 !important;
        }
        
        /* Toast-uri și notificări */
        .toast,
        .notification,
        [data-toast="true"] {
          z-index: 60000 !important;
        }
        
        /* Loading overlays */
        .loading-overlay,
        [data-loading="true"] {
          z-index: 45000 !important;
        }
        
        /* Tooltips */
        .tooltip,
        [data-tooltip="true"] {
          z-index: 35000 !important;
        }
        
        /* Backdrop overlay pentru modalele active */
        .modal-backdrop {
          z-index: 49000 !important;
          background: rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: blur(2px) !important;
        }
        
        /* Asigură că elementele din pagina principală rămân în spate */
        .main-content,
        .page-container,
        .glassmorphism-container {
          z-index: 1 !important;
          position: relative;
        }
        
        /* Fix pentru select-uri și input-uri în modale */
        .modal-container select,
        .modal-container input,
        .modal-container textarea,
        .modal-container button {
          z-index: inherit !important;
        }
        
        /* Fix pentru react-select în modale */
        .react-select__menu {
          z-index: 51000 !important;
        }
        
        /* Fix pentru dropdowns în interiorul modalelor */
        .modal-container .dropdown-menu,
        .modal-container .actions-dropdown {
          z-index: 51000 !important;
        }
      `}</style>
    </div>
  );
}
