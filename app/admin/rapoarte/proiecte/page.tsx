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
    <div style={{ padding: '1.5rem' }}>
      {/* Header cu Butonul Proiect Nou */}
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        borderBottom: '2px solid #e9ecef',
        paddingBottom: '1rem'
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            color: '#2c3e50',
            fontSize: '2rem',
            fontWeight: 'bold'
          }}>
            📋 Management Proiecte
          </h1>
          <p style={{ 
            margin: '0.5rem 0 0 0', 
            color: '#7f8c8d',
            fontSize: '1.1rem'
          }}>
            Gestionează și monitorizează toate proiectele din portofoliu
          </p>
        </div>
        
        {/* Butonul Proiect Nou - READĂUGAT */}
        <button
          onClick={() => setShowProiectModal(true)}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#229954';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#27ae60';
          }}
        >
          + Proiect Nou
        </button>
      </div>

      {/* Filtre */}
      <div style={{ 
        marginBottom: '1.5rem',
        background: 'white',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <Suspense fallback={
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center',
            color: '#7f8c8d'
          }}>
            ⏳ Se încarcă filtrele...
          </div>
        }>
          <ProiectFilters 
            values={filters}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
          />
        </Suspense>
      </div>

      {/* Tabel */}
      <div style={{ 
        background: 'white',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <Suspense fallback={
          <div style={{ 
            padding: '3rem', 
            textAlign: 'center',
            color: '#7f8c8d'
          }}>
            ⏳ Se încarcă proiectele...
          </div>
        }>
          <ProiecteTable 
            searchParams={tableSearchParams}
          />
        </Suspense>
      </div>

      {/* Footer info */}
      <div style={{ 
        marginTop: '2rem',
        padding: '1rem',
        background: '#f8f9fa',
        borderRadius: '6px',
        border: '1px solid #e9ecef'
      }}>
        <p style={{ 
          margin: 0, 
          fontSize: '14px', 
          color: '#6c757d',
          textAlign: 'center'
        }}>
          💡 <strong>Tip:</strong> Folosește filtrele pentru a găsi rapid proiectele dorite. 
          Click pe "Acțiuni" pentru a gestiona fiecare proiect individual.
        </p>
      </div>

      {/* Modal Proiect Nou - READĂUGAT */}
      <ProiectNouModal
        isOpen={showProiectModal}
        onClose={() => setShowProiectModal(false)}
        onProiectAdded={handleProiectAdded}
      />
    </div>
  );
}
