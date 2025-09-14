// ==================================================================
// CALEA: app/admin/rapoarte/contracte/components/ContractFilters.tsx
// DATA: 15.01.2025 10:15 (ora României)
// MODIFICAT: Schimbat dropdown client cu input text pentru căutare LIKE
// REPARAT: Elimină clienții fake din dropdown, folosește căutare liberă
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
    {
      key: 'proiect_id',
      label: 'ID Proiect',
      type: 'text',
      placeholder: 'Caută după ID proiect (căutare parțială)...'
    },
    {
      key: 'client',
      label: 'Client',
      type: 'text', // MODIFICAT: din 'select' în 'text'
      placeholder: 'Caută după numele clientului...' // MODIFICAT: placeholder relevant
      // ELIMINAT: options array cu clienții fake
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
    <FilterBar
      filters={filters}
      values={values}
      onChange={onChange}
      onReset={onReset}
      loading={loading}
    />
  );
}
