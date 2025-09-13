// CALEA: app/admin/rapoarte/proiecte/components/ProiectFilters.tsx
'use client';

import FilterBar, { FilterConfig, FilterValues } from '../../components/FilterBar';

interface ProiectFiltersProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onReset: () => void;
  loading?: boolean;
}

export default function ProiectFilters({ 
  values, 
  onChange, 
  onReset, 
  loading = false 
}: ProiectFiltersProps) {
  const filters: FilterConfig[] = [
    {
      key: 'search',
      label: 'Căutare generală',
      type: 'text',
      placeholder: 'Caută după nume proiect, client, ID...'
    },
    {
      key: 'status',
      label: 'Status proiect',
      type: 'select',
      placeholder: 'Toate statusurile',
      options: [
        { value: 'Activ', label: '🟢 Activ' },
        { value: 'În lucru', label: '🟡 În lucru' },
        { value: 'Suspendat', label: '🟠 Suspendat' },
        { value: 'Finalizat', label: '✅ Finalizat' },
        { value: 'Anulat', label: '🔴 Anulat' }
      ]
    },
    {
      key: 'client',
      label: 'Client',
      type: 'select',
      placeholder: 'Toți clienții',
      options: [
        { value: 'SC T&D PRO ELECTRIC SRL', label: 'SC T&D PRO ELECTRIC SRL' },
        { value: 'SC PROD SRL', label: 'SC PROD SRL' },
        { value: 'SC BUILD SRL', label: 'SC BUILD SRL' }
      ]
    },
    {
      key: 'data_start',
      label: 'Perioada început',
      type: 'dateRange',
      placeholder: 'Data început'
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

