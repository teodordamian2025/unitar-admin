// ==================================================================
// CALEA: app/admin/rapoarte/oferte/components/OferteFilters.tsx
// DATA: 04.04.2026
// DESCRIERE: Componenta filtre pentru oferte
// PATTERN: Identic cu ContractFilters.tsx
// ==================================================================

'use client';

interface FilterValues {
  search: string;
  status: string;
  tip_oferta: string;
  client: string;
  data_start: string;
  data_end: string;
  valoare_min: string;
  valoare_max: string;
}

interface OferteFiltersProps {
  values: FilterValues;
  onChange: (filters: FilterValues) => void;
  onReset: () => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Toate statusurile' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Trimisa', label: 'Trimisa' },
  { value: 'Acceptata', label: 'Acceptata' },
  { value: 'Refuzata', label: 'Refuzata' },
  { value: 'Expirata', label: 'Expirata' },
  { value: 'Negociere', label: 'Negociere' },
  { value: 'Anulata', label: 'Anulata' },
];

const TIP_OPTIONS = [
  { value: '', label: 'Toate tipurile' },
  { value: 'consolidari', label: 'Consolidari' },
  { value: 'constructii_noi', label: 'Constructii Noi' },
  { value: 'expertiza_monument', label: 'Expertiza Monument' },
  { value: 'expertiza_tehnica', label: 'Expertiza Tehnica' },
  { value: 'statie_electrica', label: 'Statie Electrica' },
];

const inputStyle: React.CSSProperties = {
  padding: '0.6rem 1rem',
  borderRadius: '10px',
  border: '1px solid #dee2e6',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  width: '100%',
  background: 'white'
};

export default function OferteFilters({ values, onChange, onReset }: OferteFiltersProps) {
  const handleChange = (field: keyof FilterValues, value: string) => {
    onChange({ ...values, [field]: value });
  };

  const hasFilters = Object.values(values).some(v => v !== '');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>
          Filtre oferte
        </h3>
        {hasFilters && (
          <button
            onClick={onReset}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e74c3c',
              background: 'transparent',
              color: '#e74c3c',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Reseteaza filtrele
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Cautare</label>
          <input
            type="text"
            placeholder="Numar, client, denumire..."
            value={values.search}
            onChange={e => handleChange('search', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Status</label>
          <select
            value={values.status}
            onChange={e => handleChange('status', e.target.value)}
            style={inputStyle}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Tip oferta</label>
          <select
            value={values.tip_oferta}
            onChange={e => handleChange('tip_oferta', e.target.value)}
            style={inputStyle}
          >
            {TIP_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Client</label>
          <input
            type="text"
            placeholder="Numele clientului..."
            value={values.client}
            onChange={e => handleChange('client', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>De la data</label>
          <input
            type="date"
            value={values.data_start}
            onChange={e => handleChange('data_start', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Pana la data</label>
          <input
            type="date"
            value={values.data_end}
            onChange={e => handleChange('data_end', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Valoare min</label>
          <input
            type="number"
            placeholder="0"
            value={values.valoare_min}
            onChange={e => handleChange('valoare_min', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600', color: '#7f8c8d', marginBottom: '4px', display: 'block' }}>Valoare max</label>
          <input
            type="number"
            placeholder="999999"
            value={values.valoare_max}
            onChange={e => handleChange('valoare_max', e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}
