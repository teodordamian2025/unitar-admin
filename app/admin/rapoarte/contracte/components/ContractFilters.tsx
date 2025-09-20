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
