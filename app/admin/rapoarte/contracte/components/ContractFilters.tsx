// ==================================================================
// CALEA: app/admin/rapoarte/contracte/components/ContractFilters.tsx
// DATA: 14.01.2025 14:05 (ora României)
// CREAT: Componenta de filtrare pentru contracte
// PATTERN: Identic cu ProiectFilters.tsx - folosește FilterBar generic
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
      placeholder: 'Caută după număr contract, client, denumire...'
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
      placeholder: 'Caută după ID proiect specific...'
    },
    {
      key: 'client',
      label: 'Client',
      type: 'select',
      placeholder: 'Toți clienții',
      options: [
        { value: 'SC T&D PRO ELECTRIC SRL', label: 'SC T&D PRO ELECTRIC SRL' },
        { value: 'SC PROD SRL', label: 'SC PROD SRL' },
        { value: 'SC BUILD SRL', label: 'SC BUILD SRL' },
        { value: 'SC CONSTRUCT SRL', label: 'SC CONSTRUCT SRL' },
        { value: 'SC DEVELOPMENT SRL', label: 'SC DEVELOPMENT SRL' }
      ]
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
