'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProiecteTable from './components/ProiecteTable';
import ProiectFilters from './components/ProiectFilters';
import { FilterValues } from '../components/FilterBar';

export default function ProiectePage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterValues>({});
  const [showAddModal, setShowAddModal] = useState(false);

  const handleFiltersChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  const handleFiltersReset = () => {
    setFilters({});
  };

  const handleRowClick = (proiect: any) => {
    router.push(`/admin/rapoarte/proiecte/${proiect.ID_Proiect}`);
  };

  const handleExportExcel = async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value as string);
      });

      const response = await fetch(`/api/rapoarte/proiecte/export?${queryParams}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Proiecte_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert('Eroare la exportul Excel');
      }
    } catch (error) {
      console.error('Eroare export:', error);
      alert('Eroare la exportul Excel');
    }
  };

  const handleSendReport = () => {
    // TODO: Implementare trimitere raport pe email
    alert('Funcționalitate în dezvoltare - Trimitere raport pe email');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>📋 Proiecte</h2>
          <p style={{ margin: '0.5rem 0 0 0', color: '#6c757d' }}>
            Gestionează toate proiectele firmei
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleSendReport}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            📧 Trimite Raport
          </button>
          
          <button
            onClick={handleExportExcel}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            📊 Export Excel
          </button>
          
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            + Proiect Nou
          </button>
        </div>
      </div>

      {/* Filtre */}
      <ProiectFilters
        values={filters}
        onChange={handleFiltersChange}
        onReset={handleFiltersReset}
      />

      {/* Tabel */}
      <ProiecteTable
        filters={filters}
        onRowClick={handleRowClick}
      />

      {/* Modal Adăugare Proiect - TODO: Implementare */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3>+ Proiect Nou</h3>
            <p>Funcționalitate în dezvoltare...</p>
            <button
              onClick={() => setShowAddModal(false)}
              style={{
                padding: '0.5rem 1rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Închide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

