'use client';

import { useState, useEffect } from 'react';
import BaseTable, { Column } from '../components/BaseTable';
import FilterBar, { FilterConfig, FilterValues } from '../components/FilterBar';

export default function ClientiPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterValues>({});

  useEffect(() => {
    fetchClienti();
  }, [filters]);

  const fetchClienti = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value as string);
      });

      const response = await fetch(`/api/rapoarte/clienti?${queryParams}`);
      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
      }
    } catch (error) {
      console.error('Eroare la încărcarea clienților:', error);
    } finally {
      setLoading(false);
    }
  };

  const clientFilters: FilterConfig[] = [
    {
      key: 'search',
      label: 'Căutare client',
      type: 'text',
      placeholder: 'Caută după nume, email, telefon...'
    },
    {
      key: 'tip_client',
      label: 'Tip client',
      type: 'select',
      placeholder: 'Toate tipurile',
      options: [
        { value: 'Persoana fizica', label: 'Persoană fizică' },
        { value: 'Firma', label: 'Firmă' }
      ]
    },
    {
      key: 'activ',
      label: 'Status',
      type: 'select',
      placeholder: 'Toate statusurile',
      options: [
        { value: 'true', label: '🟢 Activ' },
        { value: 'false', label: '🔴 Inactiv' }
      ]
    }
  ];

  const columns: Column[] = [
    {
      key: 'nume',
      label: 'Nume Client',
      sortable: true,
      render: (value, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{value}</div>
          <div style={{ fontSize: '12px', color: '#6c757d' }}>
            {row.tip_client}
          </div>
        </div>
      )
    },
    {
      key: 'email',
      label: 'Contact',
      render: (value, row) => (
        <div>
          <div style={{ fontSize: '14px' }}>{value}</div>
          <div style={{ fontSize: '12px', color: '#6c757d' }}>
            {row.telefon}
          </div>
        </div>
      )
    },
    {
      key: 'adresa',
      label: 'Adresa',
      render: (value) => (
        <div style={{ maxWidth: '200px' }}>
          {value?.length > 50 ? `${value.substring(0, 50)}...` : value || '-'}
        </div>
      )
    },
    {
      key: 'data_inregistrare',
      label: 'Data Înregistrare',
      sortable: true,
      render: (value) => {
        if (!value) return '-';
        const date = typeof value === 'object' && value.value ? new Date(value.value) : new Date(value);
        return date.toLocaleDateString('ro-RO');
      }
    },
    {
      key: 'activ',
      label: 'Status',
      render: (value) => (
        <span style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 500,
          background: value ? '#d4edda' : '#f8d7da',
          color: value ? '#155724' : '#721c24'
        }}>
          {value ? '🟢 Activ' : '🔴 Inactiv'}
        </span>
      )
    }
  ];

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>👥 Clienți</h2>
          <p style={{ margin: '0.5rem 0 0 0', color: '#6c757d' }}>
            Gestionează clienții firmei
          </p>
        </div>
        
        <button
          onClick={() => alert('Adăugare client în dezvoltare')}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          + Client Nou
        </button>
      </div>

      <FilterBar
        filters={clientFilters}
        values={filters}
        onChange={setFilters}
        onReset={() => setFilters({})}
        loading={loading}
      />

      <BaseTable
        data={data}
        columns={columns}
        loading={loading}
        emptyMessage="Nu sunt clienți disponibili cu filtrele selectate."
      />
    </div>
  );
}

