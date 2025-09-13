// ==================================================================
// CALEA: app/admin/rapoarte/contracte/page.tsx
// DATA: 14.01.2025 14:00 (ora României)
// CREAT: Pagină principală pentru lista contractelor
// PATTERN: Identic cu proiecte/page.tsx - glassmorphism și Z-index management
// ==================================================================

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ContractFilters from './components/ContractFilters';
import ContracteTable from './components/ContracteTable';

interface FilterValues {
  search: string;
  status: string;
  client: string;
  proiect_id: string;
  data_creare_start: string;
  data_creare_end: string;
  valoare_min: string;
  valoare_max: string;
}

export default function ContractePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Inițializează filtrele din URL
  const [filters, setFilters] = useState<FilterValues>({
    search: searchParams?.get('search') || '',
    status: searchParams?.get('status') || '',
    client: searchParams?.get('client') || '',
    proiect_id: searchParams?.get('proiect_id') || '',
    data_creare_start: searchParams?.get('data_creare_start') || '',
    data_creare_end: searchParams?.get('data_creare_end') || '',
    valoare_min: searchParams?.get('valoare_min') || '',
    valoare_max: searchParams?.get('valoare_max') || ''
  });

  // Convertește filtrele în searchParams pentru ContracteTable
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
      ? `/admin/rapoarte/contracte?${params.toString()}`
      : '/admin/rapoarte/contracte';
    
    router.push(newUrl);
  };

  const handleFilterReset = () => {
    const emptyFilters: FilterValues = {
      search: '',
      status: '',
      client: '',
      proiect_id: '',
      data_creare_start: '',
      data_creare_end: '',
      valoare_min: '',
      valoare_max: ''
    };
    
    setFilters(emptyFilters);
    router.push('/admin/rapoarte/contracte');
  };

  return (
    <div style={{ 
      padding: '2rem',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative' as const,
      zIndex: 1
    }}>
      {/* Background Pattern Glassmorphism - Opacity redusă */}
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
        zIndex: 0
      }} />

      <div style={{ 
        position: 'relative' as const, 
        zIndex: 1
      }}>
        {/* Header Glassmorphism Premium - Backdrop redus */}
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(8px)',
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
              background: 'linear-gradient(135deg, #2c3e50 0%, #4a6741 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              📄 Management Contracte
            </h1>
            <p style={{ 
              margin: '0.75rem 0 0 0', 
              color: '#7f8c8d',
              fontSize: '1.1rem',
              fontWeight: '500'
            }}>
              Gestionează și monitorizează toate contractele din portofoliu
            </p>
          </div>
          
          {/* Info contracte - fără buton de adăugare */}
          <div style={{
            padding: '1rem 2rem',
            background: 'linear-gradient(135deg, #3498db 0%, #5dade2 100%)',
            color: 'white',
            borderRadius: '16px',
            fontSize: '16px',
            fontWeight: '700',
            boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)',
            position: 'relative' as const,
            zIndex: 11
          }}>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>Contractele se generează</div>
            <div style={{ fontSize: '14px' }}>din pagina Proiecte</div>
          </div>
        </div>

        {/* Filtre Glassmorphism - Backdrop redus */}
        <div style={{ 
          marginBottom: '2rem',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '20px',
          padding: '2rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
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
            <ContractFilters 
              values={filters}
              onChange={handleFilterChange}
              onReset={handleFilterReset}
            />
          </Suspense>
        </div>

        {/* Tabel Glassmorphism - Backdrop redus */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '20px',
          overflow: 'hidden' as const,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
          marginBottom: '2rem',
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
              <span style={{ fontSize: '18px', fontWeight: '500' }}>⏳ Se încarcă contractele...</span>
            </div>
          }>
            <ContracteTable 
              searchParams={tableSearchParams}
            />
          </Suspense>
        </div>

        {/* Footer Info Glassmorphism - Backdrop redus */}
        <div style={{ 
          padding: '1.5rem',
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(6px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          textAlign: 'center' as const,
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
            💡 <strong>Tip:</strong> Folosește filtrele pentru a găsi rapid contractele dorite. 
            Click pe "Acțiuni" pentru a gestiona fiecare contract individual.
          </p>
        </div>
      </div>

      {/* CSS Global pentru Z-index Management Universal - identic cu proiectele */}
      <style jsx global>{`
        /* Z-index Management Universal pentru toate modalele și dropdown-urile */
        
        /* Modalele principale (FacturaHibridModal, ContractModal, etc.) */
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
