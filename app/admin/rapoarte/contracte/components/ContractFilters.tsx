// ==================================================================
// CALEA: app/admin/rapoarte/contracte/components/ContractFilters.tsx
// DATA: 15.01.2025 15:45 (ora României)
// MODIFICAT: Adăugat filtru Status Facturare și buton "Șterge toate filtrele"
// PĂSTRATE: Toate filtrele existente cu funcționalitatea de căutare LIKE
// ==================================================================

'use client';

import FilterBar, { FilterConfig, FilterValues } from '../../components/FilterBar';

interface ContractFiltersProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onReset: () => void;
  loading?: boolean;
}

export default function ContractFilters({ 
  values, 
  onChange, 
  onReset, 
  loading = false 
}: ContractFiltersProps) {
  
  // NOU: Handler pentru resetarea completă a filtrelor
  const handleResetAll = () => {
    onReset();
  };

  const filters: FilterConfig[] = [
    {
      key: 'search',
      label: 'Căutare generală',
      type: 'text',
      placeholder: 'Caută după număr contract, client, denumire, ID proiect...'
    },
    {
      key: 'status',
      label: 'Status contract',
      type: 'select',
      placeholder: 'Toate statusurile',
      options: [
        { value: 'Generat', label: '📄 Generat' },
        { value: 'Semnat', label: '✅ Semnat' },
        { value: 'Anulat', label: '🔴 Anulat' },
        { value: 'În așteptare', label: '⏳ În așteptare' },
        { value: 'Expirat', label: '⚠️ Expirat' }
      ]
    },
    // NOU: Filtru pentru status facturare/încasare
    {
      key: 'status_facturare',
      label: 'Status Facturare/Încasare',
      type: 'select',
      placeholder: 'Toate statusurile de facturare',
      options: [
        { value: 'Nefacturat', label: '⚪ Nefacturat' },
        { value: 'Facturat', label: '📝 Facturat (neîncasat)' },
        { value: 'Incasat partial', label: '🟡 Încasat parțial' },
        { value: 'Incasat complet', label: '🟢 Încasat complet' }
      ]
    },
    {
      key: 'proiect_id',
      label: 'ID Proiect',
      type: 'text',
      placeholder: 'Caută după ID proiect (căutare parțială)...'
    },
    {
      key: 'client',
      label: 'Client',
      type: 'text',
      placeholder: 'Caută după numele clientului...'
    },
    {
      key: 'data_creare',
      label: 'Perioada creare',
      type: 'dateRange',
      placeholder: 'Data creare contract'
    },
    {
      key: 'valoare_min',
      label: 'Valoare minimă (RON)',
      type: 'text',
      placeholder: '0'
    },
    {
      key: 'valoare_max',
      label: 'Valoare maximă (RON)',
      type: 'text',
      placeholder: '999999'
    }
  ];

  return (
    <div style={{ position: 'relative' }}>
      <FilterBar
        filters={filters}
        values={values}
        onChange={onChange}
        onReset={onReset}
        loading={loading}
      />
      
      {/* NOU: Buton pentru resetare completă a filtrelor */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)'
      }}>
        <button
          onClick={handleResetAll}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            background: loading ? '#bdc3c7' : 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: loading ? 'none' : '0 4px 12px rgba(149, 165, 166, 0.4)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(149, 165, 166, 0.5)';
            }
          }}
          onMouseOut={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(149, 165, 166, 0.4)';
            }
          }}
        >
          {loading ? '⏳' : '🗑️'} Șterge toate filtrele
        </button>
      </div>
      
      {/* NOU: Indicator pentru filtrele active */}
      {Object.values(values).some(value => value !== '') && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem 1rem',
          background: 'rgba(52, 152, 219, 0.1)',
          border: '1px solid rgba(52, 152, 219, 0.2)',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#3498db',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>ℹ️</span>
          <span>
            {Object.entries(values).filter(([_, value]) => value !== '').length} filtru(e) activ(e)
            {values.status_facturare && ` - inclusiv status facturare: "${values.status_facturare}"`}
          </span>
        </div>
      )}
    </div>
  );
}
